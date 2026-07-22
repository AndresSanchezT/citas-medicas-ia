import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';
import { AssignWaitlistEntryDto } from './dto/assign-waitlist-entry.dto';

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictionService: PredictionService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async create(dto: CreateWaitlistEntryDto) {
    if (!dto.doctorId && !dto.specialtyId) {
      throw new BadRequestException('Debe especificar al menos un médico o una especialidad');
    }

    const now = new Date();
    const prediction = await this.predictionService.predictWaitTime({
      doctorId: dto.doctorId,
      specialtyId: dto.specialtyId,
      diaSemana: now.getDay(),
      hora: now.getHours(),
    });

    return this.prisma.waitlistEntry.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        specialtyId: dto.specialtyId,
        prioridad: dto.prioridad ?? 'NORMAL',
        tiempoEsperaEstimadoMinutos: prediction.tiempoEstimadoMinutos,
      },
      include: { patient: true, doctor: true, specialty: true },
    });
  }

  findAll(filters: { estado?: string; doctorId?: number; specialtyId?: number }) {
    return this.prisma.waitlistEntry.findMany({
      where: {
        ...(filters.estado ? { estado: filters.estado as any } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.specialtyId ? { specialtyId: filters.specialtyId } : {}),
      },
      include: { patient: true, doctor: true, specialty: true },
      orderBy: [{ prioridad: 'desc' }, { fechaSolicitud: 'asc' }],
    });
  }

  async findOne(id: number) {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      include: { patient: true, doctor: true, specialty: true },
    });
    if (!entry) {
      throw new NotFoundException(`Entrada de lista de espera ${id} no encontrada`);
    }
    return entry;
  }

  async assign(id: number, dto: AssignWaitlistEntryDto) {
    const entry = await this.findOne(id);
    if (entry.estado !== 'ESPERANDO' && entry.estado !== 'NOTIFICADO') {
      throw new BadRequestException(`No se puede asignar una entrada en estado ${entry.estado}`);
    }

    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id: dto.slotId } });
    if (!slot) {
      throw new NotFoundException(`Cupo ${dto.slotId} no encontrado`);
    }
    if (entry.doctorId && slot.doctorId !== entry.doctorId) {
      throw new BadRequestException('El cupo no corresponde al médico solicitado en la lista de espera');
    }

    const appointment = await this.appointmentsService.create({
      patientId: entry.patientId,
      doctorId: slot.doctorId,
      slotId: slot.id,
      motivoConsulta: dto.motivoConsulta,
    });

    await this.prisma.waitlistEntry.update({ where: { id }, data: { estado: 'ASIGNADO' } });

    return appointment;
  }

  async expire(id: number) {
    const entry = await this.findOne(id);
    if (entry.estado === 'ASIGNADO') {
      throw new BadRequestException('No se puede expirar una entrada ya asignada');
    }
    return this.prisma.waitlistEntry.update({ where: { id }, data: { estado: 'EXPIRADO' } });
  }

  // ---------- Ranking de demanda por médico (HU-11) ----------
  async getDemandRanking() {
    const counts = await this.prisma.appointment.groupBy({
      by: ['doctorId'],
      where: { estado: { not: 'CANCELADA' } },
      _count: { _all: true },
    });

    const doctors = await this.prisma.doctor.findMany({ where: { activo: true }, include: { specialty: true } });
    const totalPromedio =
      counts.length > 0 ? counts.reduce((s, c) => s + c._count._all, 0) / doctors.length : 0;

    return doctors
      .map((doctor) => {
        const totalCitas = counts.find((c) => c.doctorId === doctor.id)?._count._all ?? 0;
        return {
          doctorId: doctor.id,
          nombre: `${doctor.nombres} ${doctor.apellidos}`,
          especialidad: doctor.specialty.nombre,
          totalCitas,
          demanda: totalCitas > totalPromedio ? 'alta' : totalCitas < totalPromedio ? 'baja' : 'normal',
        };
      })
      .sort((a, b) => b.totalCitas - a.totalCitas);
  }
}
