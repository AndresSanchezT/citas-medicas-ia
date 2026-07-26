import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateTriageDto } from './dto/create-triage.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
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
        },
      });
      await tx.appointmentSlot.update({ where: { id: slot.id }, data: { estado: 'RESERVADO' } });
      return appointment;
    });
  }

  findAll(filters: {
    doctorId?: number;
    patientId?: number;
    specialtyId?: number;
    fecha?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    estado?: string;
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

    return this.prisma.appointment.findMany({
      where: {
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.specialtyId ? { doctor: { specialtyId: filters.specialtyId } } : {}),
        ...fechaFiltro,
        ...(filters.estado ? { estado: filters.estado as any } : {}),
      },
      include: { patient: true, doctor: true, waitTimeHistory: true, triage: true },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, doctor: true, triage: true },
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

  async startConsultation(id: number) {
    const appointment = await this.findOne(id);
    if (!appointment.horaLlegadaReal) {
      throw new BadRequestException('El paciente aún no ha hecho check-in');
    }
    if (appointment.estado !== 'CONFIRMADA') {
      throw new BadRequestException(`No se puede iniciar la consulta desde el estado ${appointment.estado}`);
    }
    return this.prisma.appointment.update({
      where: { id },
      data: { horaAtencionInicioReal: new Date(), estado: 'EN_CURSO' },
    });
  }

  async complete(id: number) {
    const appointment = await this.findOne(id);
    if (appointment.estado !== 'EN_CURSO') {
      throw new BadRequestException(`No se puede completar una cita en estado ${appointment.estado}`);
    }
    if (!appointment.horaLlegadaReal || !appointment.horaAtencionInicioReal) {
      throw new BadRequestException('Faltan los tiempos reales de llegada o inicio de atención');
    }

    const horaAtencionFinReal = new Date();
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

  async cancel(id: number, user: AuthenticatedUser) {
    const appointment = await this.findOne(id);
    verificarPropiaCita(appointment, user);
    if (appointment.estado === 'COMPLETADA' || appointment.estado === 'CANCELADA') {
      throw new BadRequestException(`No se puede cancelar una cita en estado ${appointment.estado}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({ where: { id }, data: { estado: 'CANCELADA' } });
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({ where: { id }, data: { estado: 'NO_ASISTIO' } });
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

  async reschedule(id: number, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(id);
    if (appointment.estado === 'COMPLETADA' || appointment.estado === 'CANCELADA') {
      throw new BadRequestException(`No se puede reagendar una cita en estado ${appointment.estado}`);
    }

    const newSlot = await this.prisma.appointmentSlot.findUnique({ where: { id: dto.newSlotId } });
    if (!newSlot) {
      throw new NotFoundException(`Cupo ${dto.newSlotId} no encontrado`);
    }
    if (newSlot.estado !== 'DISPONIBLE') {
      throw new BadRequestException('El nuevo cupo seleccionado ya no está disponible');
    }

    return this.prisma.$transaction(async (tx) => {
      if (appointment.slotId) {
        await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { estado: 'DISPONIBLE' } });
      }
      await tx.appointmentSlot.update({ where: { id: newSlot.id }, data: { estado: 'RESERVADO' } });
      return tx.appointment.update({
        where: { id },
        data: {
          slotId: newSlot.id,
          doctorId: newSlot.doctorId,
          fecha: newSlot.fecha,
          horaInicio: newSlot.horaInicio,
          horaFin: newSlot.horaFin,
          estado: 'PENDIENTE',
        },
      });
    });
  }

  async upsertTriage(appointmentId: number, dto: CreateTriageDto) {
    await this.findOne(appointmentId);
    return this.prisma.triage.upsert({
      where: { appointmentId },
      create: { appointmentId, ...dto },
      update: { ...dto },
    });
  }
}
