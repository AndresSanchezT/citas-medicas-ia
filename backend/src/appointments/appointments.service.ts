import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { EmailService } from '../common/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteAppointmentDto } from './dto/complete-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateTriageDto } from './dto/create-triage.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { StartConsultationDto } from './dto/start-consultation.dto';

// Un médico solo puede cancelar o marcar no-asistió en sus propias citas; los demás
// roles (ADMIN, RECEPCIONISTA) gestionan la agenda de cualquier médico.
function verificarPropiaCita(appointment: { doctorId: number }, user: AuthenticatedUser) {
  if (user.rol === Role.MEDICO && appointment.doctorId !== user.doctorId) {
    throw new ForbiddenException('Solo puedes gestionar tus propias citas');
  }
}

function franjaHorariaFrom(horaInicio: string): string {
  const hour = Number(horaInicio.split(':')[0]);
  return `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
}

// Se emite cuando un cupo vuelve a DISPONIBLE por una acción del personal (cancelación o
// no-asistencia) — en ambos casos hay que avisarle a quien esté primero en la lista de espera.
export interface AppointmentSlotFreedEvent {
  appointmentId: number;
  doctorId: number;
  slotId: number | null;
  fecha: Date;
  horaInicio: string;
}

export interface AppointmentNoShowEvent {
  appointmentId: number;
  patientId: number;
  doctorId: number;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateAppointmentDto) {
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id: dto.slotId } });
    if (!slot) {
      throw new NotFoundException(`Cupo ${dto.slotId} no encontrado`);
    }
    if (slot.estado !== 'DISPONIBLE') {
      throw new BadRequestException('El cupo seleccionado ya no está disponible');
    }
    if (slot.doctorId !== dto.doctorId) {
      throw new BadRequestException('El cupo no corresponde al médico indicado');
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          slotId: dto.slotId,
          fecha: slot.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          motivoConsulta: dto.motivoConsulta,
          notas: dto.notas,
          estado: 'PENDIENTE',
          pagado: dto.pagado ?? false,
          monto: dto.pagado ? dto.monto : undefined,
        },
      });
      await tx.appointmentSlot.update({ where: { id: slot.id }, data: { estado: 'RESERVADO' } });
      return created;
    });

    const [patient, doctor] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId } }),
      this.prisma.doctor.findUnique({ where: { id: dto.doctorId } }),
    ]);
    if (patient?.email && doctor) {
      const fecha = appointment.fecha.toISOString().split('T')[0];
      await this.emailService.send(
        patient.email,
        'Confirmación de tu cita — Clínica Amazonas',
        `Hola ${patient.nombres}, tu cita con ${doctor.nombres} ${doctor.apellidos} quedó agendada para el ${fecha} a las ${appointment.horaInicio}. ` +
          `${dto.motivoConsulta ? `Motivo: ${dto.motivoConsulta}. ` : ''}Si necesitas cancelarla o reprogramarla, comunícate con recepción. ` +
          'Importante: si faltas o cancelas esta cita, tienes un máximo de 24 horas desde ese momento para reprogramarla sin perder tu pago; ' +
          'pasado ese plazo (o si vuelve a ocurrir una segunda vez), el pago ya no se puede recuperar.',
      );
    }

    return appointment;
  }

  async findAll(filters: {
    doctorId?: number;
    patientId?: number;
    specialtyId?: number;
    fecha?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    estado?: string;
    page?: number;
    pageSize?: number;
  }) {
    const fechaFiltro = filters.fecha
      ? { fecha: new Date(filters.fecha) }
      : filters.fechaDesde || filters.fechaHasta
        ? {
            fecha: {
              ...(filters.fechaDesde ? { gte: new Date(filters.fechaDesde) } : {}),
              ...(filters.fechaHasta ? { lte: new Date(filters.fechaHasta) } : {}),
            },
          }
        : {};

    const where = {
      ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
      ...(filters.specialtyId ? { doctor: { specialtyId: filters.specialtyId } } : {}),
      ...fechaFiltro,
      ...(filters.estado ? { estado: filters.estado as any } : {}),
    };

    // pageSize por defecto alto: las pantallas que no paginan (Mi agenda del día,
    // historial de un paciente) siguen trayendo todo en una sola página.
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 1000;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          doctor: { include: { specialty: true } },
          waitTimeHistory: true,
          triage: true,
        },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, doctor: { include: { specialty: true } }, triage: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }
    return appointment;
  }

  async checkIn(id: number) {
    const appointment = await this.findOne(id);
    if (appointment.estado !== 'PENDIENTE' && appointment.estado !== 'CONFIRMADA') {
      throw new BadRequestException(`No se puede hacer check-in de una cita en estado ${appointment.estado}`);
    }
    return this.prisma.appointment.update({
      where: { id },
      data: { horaLlegadaReal: new Date(), estado: 'CONFIRMADA' },
    });
  }

  async startConsultation(id: number, dto: StartConsultationDto = {}) {
    const appointment = await this.findOne(id);
    if (!appointment.horaLlegadaReal) {
      throw new BadRequestException('El paciente aún no ha hecho check-in');
    }
    if (appointment.estado !== 'CONFIRMADA') {
      throw new BadRequestException(`No se puede iniciar la consulta desde el estado ${appointment.estado}`);
    }
    // El médico puede asignar la hora real de inicio (ej. si empezó a atender unos
    // minutos antes/después de tocar el botón); si no la manda, se usa la hora actual.
    const horaAtencionInicioReal = dto.horaAtencionInicioReal ? new Date(dto.horaAtencionInicioReal) : new Date();
    return this.prisma.appointment.update({
      where: { id },
      data: { horaAtencionInicioReal, estado: 'EN_CURSO' },
    });
  }

  async complete(id: number, dto: CompleteAppointmentDto = {}) {
    const appointment = await this.findOne(id);
    if (appointment.estado !== 'EN_CURSO') {
      throw new BadRequestException(`No se puede completar una cita en estado ${appointment.estado}`);
    }
    if (!appointment.horaLlegadaReal || !appointment.horaAtencionInicioReal) {
      throw new BadRequestException('Faltan los tiempos reales de llegada o inicio de atención');
    }

    // El médico puede asignar la hora real de fin de la consulta; si no la manda, se usa
    // la hora actual (comportamiento anterior).
    const horaAtencionFinReal = dto.horaAtencionFinReal ? new Date(dto.horaAtencionFinReal) : new Date();
    const tiempoEsperaMinutosReal = Math.max(
      0,
      Math.round(
        (appointment.horaAtencionInicioReal.getTime() - appointment.horaLlegadaReal.getTime()) / 60000,
      ),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { horaAtencionFinReal, estado: 'COMPLETADA' },
      });

      await tx.waitTimeHistory.create({
        data: {
          appointmentId: id,
          doctorId: appointment.doctorId,
          // .getUTCDay() (no .getDay()): las columnas @db.Date vuelven de Prisma como
          // medianoche UTC; usar el método local aquí desfasaría el día en zonas UTC-negativas.
          diaSemana: appointment.fecha.getUTCDay(),
          franjaHoraria: franjaHorariaFrom(appointment.horaInicio),
          tiempoEsperaMinutosReal,
          fechaRegistro: appointment.fecha,
        },
      });

      return updated;
    });
  }

  // Política "reprogramación única con plazo de 24h": se evalúa igual sea por cancelación
  // o por inasistencia. Si la cita no está pagada, no hay nada que resolver. Si está pagada
  // y todavía no había usado su oportunidad, esta falla la consume: el pago queda a salvo
  // y se abre una ventana de 24h para reprogramar (ver reschedule()). Si ya la había usado
  // (esta es la segunda falla, o el plazo anterior ya había vencido), se pierde el pago.
  private resolverPoliticaFalla(appointment: { pagado: boolean; reprogramacionGratuitaUsada: boolean }) {
    if (!appointment.pagado) {
      return { reembolso: 'NO_APLICA' as const, reprogramacionGratuitaUsada: appointment.reprogramacionGratuitaUsada, plazoReprogramacionHasta: null as Date | null };
    }
    if (appointment.reprogramacionGratuitaUsada) {
      return { reembolso: 'PERDIDO' as const, reprogramacionGratuitaUsada: true, plazoReprogramacionHasta: null as Date | null };
    }
    return {
      reembolso: 'REEMBOLSADO' as const,
      reprogramacionGratuitaUsada: true,
      plazoReprogramacionHasta: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async cancel(id: number, user: AuthenticatedUser) {
    const appointment = await this.findOne(id);
    verificarPropiaCita(appointment, user);
    if (appointment.estado === 'COMPLETADA' || appointment.estado === 'CANCELADA' || appointment.estado === 'REPROGRAMADA') {
      throw new BadRequestException(`No se puede cancelar una cita en estado ${appointment.estado}`);
    }

    const politica = this.resolverPoliticaFalla(appointment);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({
        where: { id },
        data: { estado: 'CANCELADA', ...politica },
      });
      if (appointment.slotId) {
        await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { estado: 'DISPONIBLE' } });
      }
      return result;
    });

    if (appointment.slotId) {
      this.eventEmitter.emit('appointment.slot_freed', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        slotId: appointment.slotId,
        fecha: appointment.fecha,
        horaInicio: appointment.horaInicio,
      } satisfies AppointmentSlotFreedEvent);
    }

    return updated;
  }

  async markNoShow(id: number, user: AuthenticatedUser) {
    const appointment = await this.findOne(id);
    verificarPropiaCita(appointment, user);
    if (appointment.estado !== 'PENDIENTE' && appointment.estado !== 'CONFIRMADA') {
      throw new BadRequestException(`No se puede marcar como no-asistió una cita en estado ${appointment.estado}`);
    }

    const politica = this.resolverPoliticaFalla(appointment);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({ where: { id }, data: { estado: 'NO_ASISTIO', ...politica } });
      if (appointment.slotId) {
        await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { estado: 'DISPONIBLE' } });
      }
      return result;
    });

    this.eventEmitter.emit('appointment.no_show', {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
    } satisfies AppointmentNoShowEvent);

    if (appointment.slotId) {
      this.eventEmitter.emit('appointment.slot_freed', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        slotId: appointment.slotId,
        fecha: appointment.fecha,
        horaInicio: appointment.horaInicio,
      } satisfies AppointmentSlotFreedEvent);
    }

    return updated;
  }

  // Una cita ya cancelada/no-asistida solo puede "recuperarse" (reprogramarse de nuevo) si
  // la falla anterior le dejó el pago a salvo y todavía está dentro de su ventana de 24h.
  private tieneDerechoARecuperar(appointment: {
    estado: string;
    reembolso: string;
    plazoReprogramacionHasta: Date | null;
  }): boolean {
    return (
      (appointment.estado === 'CANCELADA' || appointment.estado === 'NO_ASISTIO') &&
      appointment.reembolso === 'REEMBOLSADO' &&
      appointment.plazoReprogramacionHasta != null &&
      appointment.plazoReprogramacionHasta.getTime() >= Date.now()
    );
  }

  // Reagendar NUNCA muta la cita existente: la cancela (si corresponde) y crea una fila
  // nueva enlazada a ella, para que quede un historial de auditoría real de quién
  // reprogramó, cuándo y por qué. Dos casos:
  //  - Proactivo ("Derivar"): la cita todavía está Pendiente/Confirmada; es un movimiento
  //    administrativo (ej. el médico no va a estar disponible) y no consume la política.
  //  - De recuperación: la cita ya está Cancelada/No-asistió y el paciente todavía tiene
  //    su ventana de 24h vigente (ver resolverPoliticaFalla en cancel/markNoShow).
  async reschedule(id: number, dto: RescheduleAppointmentDto, user: AuthenticatedUser) {
    const appointment = await this.findOne(id);
    const esProactiva = appointment.estado === 'PENDIENTE' || appointment.estado === 'CONFIRMADA';
    const esRecuperacion = !esProactiva && this.tieneDerechoARecuperar(appointment);

    if (!esProactiva && !esRecuperacion) {
      if (appointment.estado === 'CANCELADA' || appointment.estado === 'NO_ASISTIO') {
        throw new BadRequestException(
          appointment.reembolso === 'PERDIDO'
            ? 'Esta cita ya no tiene derecho a reprogramación: se perdió esa oportunidad.'
            : 'El plazo de 24 horas para reprogramar esta cita ya venció.',
        );
      }
      throw new BadRequestException(`No se puede reagendar una cita en estado ${appointment.estado}`);
    }

    const newSlot = await this.prisma.appointmentSlot.findUnique({ where: { id: dto.newSlotId } });
    if (!newSlot) {
      throw new NotFoundException(`Cupo ${dto.newSlotId} no encontrado`);
    }
    if (newSlot.estado !== 'DISPONIBLE') {
      throw new BadRequestException('El nuevo cupo seleccionado ya no está disponible');
    }

    const nuevaCita = await this.prisma.$transaction(async (tx) => {
      if (esProactiva) {
        // 1) Liberación inmediata: solo aplica acá — en la recuperación el cupo original
        //    ya se liberó cuando se canceló/faltó, y la cita ya quedó en estado terminal.
        if (appointment.slotId) {
          await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { estado: 'DISPONIBLE' } });
        }
        // REPROGRAMADA (no CANCELADA): la cita no se canceló por sí sola, se movió a otro
        // horario/médico — dejarla como "Cancelada" confundía en la tabla de Citas.
        await tx.appointment.update({ where: { id }, data: { estado: 'REPROGRAMADA' } });
      }

      // 2) Creación del nuevo registro: fila nueva con la fecha/hora elegida, en Pendiente.
      await tx.appointmentSlot.update({ where: { id: newSlot.id }, data: { estado: 'RESERVADO' } });
      return tx.appointment.create({
        data: {
          patientId: appointment.patientId,
          doctorId: newSlot.doctorId,
          slotId: newSlot.id,
          fecha: newSlot.fecha,
          horaInicio: newSlot.horaInicio,
          horaFin: newSlot.horaFin,
          motivoConsulta: appointment.motivoConsulta,
          estado: 'PENDIENTE',
          pagado: appointment.pagado,
          monto: appointment.monto,
          // La recuperación ya venía con reprogramacionGratuitaUsada=true (la puso el
          // cancel()/markNoShow() anterior); una derivación proactiva no cambia nada.
          reprogramacionGratuitaUsada: appointment.reprogramacionGratuitaUsada,
          // 3) Historial de auditoría: queda enlazada a la cita original, con quién y por qué.
          citaOrigenId: appointment.id,
          motivoReprogramacion: dto.motivo,
          reprogramadaPorUserId: user.userId,
        },
      });
    });

    if (esProactiva && appointment.slotId) {
      this.eventEmitter.emit('appointment.slot_freed', {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        slotId: appointment.slotId,
        fecha: appointment.fecha,
        horaInicio: appointment.horaInicio,
      } satisfies AppointmentSlotFreedEvent);
    }

    return this.findOne(nuevaCita.id);
  }

  // Si el paciente deja pasar las 24h sin reprogramar, pierde el derecho: el pago pasa de
  // "a salvo" a "perdido" automáticamente, sin que nadie tenga que intervenir a mano.
  @Cron(CronExpression.EVERY_HOUR)
  async handleVencimientoPlazoReprogramacion() {
    const vencidas = await this.prisma.appointment.updateMany({
      where: { reembolso: 'REEMBOLSADO', plazoReprogramacionHasta: { lt: new Date() } },
      data: { reembolso: 'PERDIDO' },
    });
    if (vencidas.count > 0) {
      this.logger.log(
        `${vencidas.count} cita(s) perdieron el reembolso por no reprogramarse dentro de las 24 horas.`,
      );
    }
  }

  async upsertTriage(appointmentId: number, dto: CreateTriageDto) {
    await this.findOne(appointmentId);
    const existing = await this.prisma.triage.findUnique({ where: { appointmentId } });
    const { inicioTriajeEn: inicioTriajeEnDto, ...datosTriaje } = dto;
    // El inicio queda fijo la primera vez que se marca (o se conserva el que ya había); el
    // fin siempre se pone con la hora del servidor al guardar, para que la duración del
    // triaje no dependa del reloj del navegador.
    const inicioTriajeEn = inicioTriajeEnDto ? new Date(inicioTriajeEnDto) : (existing?.inicioTriajeEn ?? undefined);
    const finTriajeEn = new Date();
    return this.prisma.triage.upsert({
      where: { appointmentId },
      create: { appointmentId, ...datosTriaje, inicioTriajeEn, finTriajeEn },
      update: { ...datosTriaje, inicioTriajeEn, finTriajeEn },
    });
  }
}
