import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import type { AppointmentSlotFreedEvent, AppointmentNoShowEvent } from '../appointments/appointments.service';

const UMBRAL_INASISTENCIAS_FRECUENTES = 3;
const DIAS_VENTANA_INASISTENCIAS = 60;
const UMBRAL_OCUPACION_SOBRECARGA = 0.8; // 80%
const AI_SERVICE_TIMEOUT_MS = 2500;

interface AiNoShowResponse {
  probabilidad_no_show: number;
  nivel_riesgo: 'alto' | 'medio' | 'bajo';
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ---------- Consulta / gestión de alertas ----------

  findAll(filters: {
    estado?: string;
    destinatarioTipo?: string;
    destinatarioId?: number;
    fechaDesde?: string;
    fechaHasta?: string;
  }) {
    return this.prisma.alert.findMany({
      where: {
        ...(filters.estado ? { estado: filters.estado as any } : {}),
        ...(filters.destinatarioTipo ? { destinatarioTipo: filters.destinatarioTipo as any } : {}),
        ...(filters.destinatarioId ? { destinatarioId: filters.destinatarioId } : {}),
        ...(filters.fechaDesde || filters.fechaHasta
          ? {
              fechaGeneracion: {
                ...(filters.fechaDesde ? { gte: new Date(filters.fechaDesde) } : {}),
                ...(filters.fechaHasta ? { lte: new Date(`${filters.fechaHasta}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { fechaGeneracion: 'desc' },
    });
  }

  async getResumen(filters: { fechaDesde?: string; fechaHasta?: string }) {
    const where = {
      ...(filters.fechaDesde || filters.fechaHasta
        ? {
            fechaGeneracion: {
              ...(filters.fechaDesde ? { gte: new Date(filters.fechaDesde) } : {}),
              ...(filters.fechaHasta ? { lte: new Date(`${filters.fechaHasta}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [porTipo, porEstado, total, pendientes] = await Promise.all([
      this.prisma.alert.groupBy({ by: ['tipo'], where, _count: { _all: true } }),
      this.prisma.alert.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.alert.count({ where }),
      this.prisma.alert.count({ where: { ...where, estado: 'PENDIENTE' } }),
    ]);

    return {
      total,
      pendientes,
      porTipo: porTipo.map((r) => ({ tipo: r.tipo, total: r._count._all })),
      porEstado: porEstado.map((r) => ({ estado: r.estado, total: r._count._all })),
    };
  }

  markAsRead(id: number) {
    return this.prisma.alert.update({ where: { id }, data: { estado: 'LEIDA' } });
  }

  private crearAlerta(data: {
    tipo: string;
    destinatarioTipo: string;
    destinatarioId: number;
    referenciaEntidadId?: number;
    mensaje: string;
    canal?: string;
  }) {
    return this.prisma.alert.create({
      data: {
        tipo: data.tipo as any,
        destinatarioTipo: data.destinatarioTipo as any,
        destinatarioId: data.destinatarioId,
        referenciaEntidadId: data.referenciaEntidadId,
        mensaje: data.mensaje,
        canal: (data.canal ?? 'SISTEMA') as any,
        estado: 'PENDIENTE',
      },
    });
  }

  // ---------- Eventos de dominio (reactivos) ----------

  // Un cupo puede liberarse por cancelación o por no-asistencia; en ambos casos hay que
  // avisarle al primero en la lista de espera de ese médico.
  @OnEvent('appointment.slot_freed')
  async handleSlotFreed(payload: AppointmentSlotFreedEvent) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: payload.doctorId },
      select: { specialtyId: true },
    });

    // Además de quien pidió ESTE médico puntual, también puede haber gente anotada solo por
    // especialidad (sin médico específico) — a esos también hay que avisarles cuando se
    // libera un cupo de cualquier médico de esa especialidad.
    const candidatos = await this.prisma.waitlistEntry.findMany({
      where: {
        estado: 'ESPERANDO',
        OR: [
          { doctorId: payload.doctorId },
          ...(doctor ? [{ doctorId: null, specialtyId: doctor.specialtyId }] : []),
        ],
      },
      orderBy: [{ prioridad: 'desc' }, { fechaSolicitud: 'asc' }],
      take: 1,
      include: { patient: true },
    });

    for (const entry of candidatos) {
      const fecha = payload.fecha.toISOString().split('T')[0];
      await this.crearAlerta({
        tipo: 'SLOT_LIBRE_DISPONIBLE',
        destinatarioTipo: 'PACIENTE',
        destinatarioId: entry.patientId,
        referenciaEntidadId: entry.id,
        mensaje: `Se liberó un cupo el ${fecha} a las ${payload.horaInicio} con el médico solicitado. Contactar a ${entry.patient.nombres} ${entry.patient.apellidos} para confirmar.`,
      });
      await this.prisma.waitlistEntry.update({ where: { id: entry.id }, data: { estado: 'NOTIFICADO' } });
      this.logger.log(`Alerta de cupo disponible generada para lista de espera ${entry.id}`);

      if (entry.patient.email) {
        await this.emailService.send(
          entry.patient.email,
          'Se liberó un cupo — Clínica Amazonas',
          `Hola ${entry.patient.nombres}, se liberó un cupo el ${fecha} a las ${payload.horaInicio} con el médico que solicitaste. ` +
            'Comunícate con recepción lo antes posible para confirmar tu cita, ya que este cupo puede ser tomado por otro paciente.',
        );
      }
    }
  }

  @OnEvent('appointment.no_show')
  async handleAppointmentNoShow(payload: AppointmentNoShowEvent) {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_VENTANA_INASISTENCIAS);

    const totalNoShows = await this.prisma.appointment.count({
      where: { patientId: payload.patientId, estado: 'NO_ASISTIO', updatedAt: { gte: desde } },
    });

    if (totalNoShows >= UMBRAL_INASISTENCIAS_FRECUENTES) {
      await this.crearAlerta({
        tipo: 'INASISTENCIA_FRECUENTE',
        destinatarioTipo: 'ADMIN',
        destinatarioId: payload.patientId,
        referenciaEntidadId: payload.patientId,
        mensaje: `El paciente ${payload.patientId} acumula ${totalNoShows} inasistencias en los últimos ${DIAS_VENTANA_INASISTENCIAS} días.`,
      });
      this.logger.log(`Alerta de inasistencia frecuente generada para el paciente ${payload.patientId}`);
    }
  }

  // ---------- Tareas programadas (proactivas) ----------

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkAppointmentReminders() {
    const now = new Date();
    const en24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const proximas = await this.prisma.appointment.findMany({
      where: { estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
      include: { patient: true },
    });

    for (const cita of proximas) {
      const [h, m] = cita.horaInicio.split(':').map(Number);
      const inicio = new Date(cita.fecha);
      inicio.setUTCHours(h, m, 0, 0);

      if (inicio < now || inicio > en24h) continue;

      const yaAlertada = await this.prisma.alert.findFirst({
        where: { tipo: 'RECORDATORIO_CITA', referenciaEntidadId: cita.id },
      });
      if (yaAlertada) continue;

      const riesgo = await this.getNoShowRisk(cita);
      const esAltoRiesgo = riesgo === 'alto';
      const mensaje = esAltoRiesgo
        ? `Recordatorio IMPORTANTE: tiene una cita el ${cita.fecha.toISOString().split('T')[0]} a las ${cita.horaInicio}. Por favor confirme su asistencia.`
        : `Recordatorio: tiene una cita el ${cita.fecha.toISOString().split('T')[0]} a las ${cita.horaInicio}.`;

      await this.crearAlerta({
        tipo: 'RECORDATORIO_CITA',
        destinatarioTipo: 'PACIENTE',
        destinatarioId: cita.patientId,
        referenciaEntidadId: cita.id,
        mensaje,
        canal: cita.patient.email ? 'EMAIL' : 'SISTEMA',
      });

      if (cita.patient.email) {
        const asunto = esAltoRiesgo ? 'Recordatorio de cita — confirme su asistencia' : 'Recordatorio de cita';
        await this.emailService.send(cita.patient.email, asunto, mensaje);
      }
    }
  }

  // Consulta el modelo de clasificación del servicio de IA (riesgo de inasistencia) para
  // reforzar el recordatorio de los pacientes con mayor probabilidad de no-show (HU-13/HU-14).
  // Si el servicio no responde, simplemente no se refuerza el mensaje (no bloquea el recordatorio).
  private async getNoShowRisk(cita: { patientId: number; doctorId: number; fecha: Date; createdAt: Date }) {
    const inasistenciasPrevias = await this.prisma.appointment.count({
      where: { patientId: cita.patientId, estado: 'NO_ASISTIO', updatedAt: { lt: cita.createdAt } },
    });
    const diasAnticipacion = Math.max(
      0,
      Math.round((cita.fecha.getTime() - cita.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${baseUrl}/predict/no-show-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: cita.patientId,
          doctor_id: cita.doctorId,
          // .getUTCDay(): fecha viene de Prisma como medianoche UTC (columna @db.Date).
          dia_semana: cita.fecha.getUTCDay(),
          dias_anticipacion: diasAnticipacion,
          inasistencias_previas: inasistenciasPrevias,
        }),
        signal: AbortSignal.timeout(AI_SERVICE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AiNoShowResponse;
      return data.nivel_riesgo;
    } catch {
      return null;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkAgendaOverload() {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);

    const doctors = await this.prisma.doctor.findMany({ where: { activo: true } });

    for (const doctor of doctors) {
      const slots = await this.prisma.appointmentSlot.findMany({
        where: { doctorId: doctor.id, fecha: manana },
      });
      if (slots.length === 0) continue;

      const reservados = slots.filter((s) => s.estado === 'RESERVADO').length;
      const ocupacion = reservados / slots.length;

      if (ocupacion >= UMBRAL_OCUPACION_SOBRECARGA) {
        const yaAlertada = await this.prisma.alert.findFirst({
          where: {
            tipo: 'SOBRECARGA_AGENDA',
            destinatarioId: doctor.id,
            fechaGeneracion: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });
        if (yaAlertada) continue;

        await this.crearAlerta({
          tipo: 'SOBRECARGA_AGENDA',
          destinatarioTipo: 'ADMIN',
          destinatarioId: doctor.id,
          mensaje: `La agenda del médico ${doctor.nombres} ${doctor.apellidos} para mañana está al ${Math.round(ocupacion * 100)}% de ocupación.`,
        });
        this.logger.log(`Alerta de sobrecarga generada para el médico ${doctor.id}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async checkLongWaitlist() {
    const entries = await this.prisma.waitlistEntry.findMany({ where: { estado: 'ESPERANDO' } });
    const now = Date.now();

    for (const entry of entries) {
      const minutosEsperando = (now - entry.fechaSolicitud.getTime()) / 60000;
      const umbral = (entry.tiempoEsperaEstimadoMinutos ?? 30) * 2;

      if (minutosEsperando > umbral) {
        const yaAlertada = await this.prisma.alert.findFirst({
          where: { tipo: 'LISTA_ESPERA_LARGA', referenciaEntidadId: entry.id },
        });
        if (yaAlertada) continue;

        await this.crearAlerta({
          tipo: 'LISTA_ESPERA_LARGA',
          destinatarioTipo: 'ADMIN',
          destinatarioId: entry.patientId,
          referenciaEntidadId: entry.id,
          mensaje: `La entrada de lista de espera ${entry.id} lleva ${Math.round(minutosEsperando)} minutos esperando, superando el doble de lo estimado.`,
        });
        this.logger.log(`Alerta de lista de espera larga generada para la entrada ${entry.id}`);
      }
    }
  }
}
