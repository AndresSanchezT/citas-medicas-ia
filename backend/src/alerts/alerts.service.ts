import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import type { AppointmentCancelledEvent, AppointmentNoShowEvent } from '../appointments/appointments.service';

const UMBRAL_INASISTENCIAS_FRECUENTES = 3;
const DIAS_VENTANA_INASISTENCIAS = 60;
const UMBRAL_OCUPACION_SOBRECARGA = 0.8; // 80%

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ---------- Consulta / gestión de alertas ----------

  findAll(filters: { estado?: string; destinatarioTipo?: string; destinatarioId?: number }) {
    return this.prisma.alert.findMany({
      where: {
        ...(filters.estado ? { estado: filters.estado as any } : {}),
        ...(filters.destinatarioTipo ? { destinatarioTipo: filters.destinatarioTipo as any } : {}),
        ...(filters.destinatarioId ? { destinatarioId: filters.destinatarioId } : {}),
      },
      orderBy: { fechaGeneracion: 'desc' },
    });
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

  @OnEvent('appointment.cancelled')
  async handleAppointmentCancelled(payload: AppointmentCancelledEvent) {
    const candidatos = await this.prisma.waitlistEntry.findMany({
      where: { doctorId: payload.doctorId, estado: 'ESPERANDO' },
      orderBy: [{ prioridad: 'desc' }, { fechaSolicitud: 'asc' }],
      take: 1,
      include: { patient: true },
    });

    for (const entry of candidatos) {
      await this.crearAlerta({
        tipo: 'SLOT_LIBRE_DISPONIBLE',
        destinatarioTipo: 'PACIENTE',
        destinatarioId: entry.patientId,
        referenciaEntidadId: entry.id,
        mensaje: `Se liberó un cupo el ${payload.fecha.toISOString().split('T')[0]} a las ${payload.horaInicio} con el médico solicitado. Contactar a ${entry.patient.nombres} ${entry.patient.apellidos} para confirmar.`,
      });
      await this.prisma.waitlistEntry.update({ where: { id: entry.id }, data: { estado: 'NOTIFICADO' } });
      this.logger.log(`Alerta de cupo disponible generada para lista de espera ${entry.id}`);
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

      const mensaje = `Recordatorio: tiene una cita el ${cita.fecha.toISOString().split('T')[0]} a las ${cita.horaInicio}.`;
      await this.crearAlerta({
        tipo: 'RECORDATORIO_CITA',
        destinatarioTipo: 'PACIENTE',
        destinatarioId: cita.patientId,
        referenciaEntidadId: cita.id,
        mensaje,
        canal: cita.patient.email ? 'EMAIL' : 'SISTEMA',
      });

      if (cita.patient.email) {
        await this.emailService.send(cita.patient.email, 'Recordatorio de cita', mensaje);
      }
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
