import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

const SLOT_GENERATION_DAYS_AHEAD = 30;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// El loop de generateSlots construye `fecha` en medianoche LOCAL, mientras que los campos
// @db.Date que devuelve Prisma (ej. DoctorTimeOff.fechaInicio/fechaFin) vuelven como
// medianoche UTC. Para comparar "¿este día cae dentro del rango de descanso?" sin repetir
// el bug de desfase de día por zona horaria, ambos se normalizan a una clave "YYYY-MM-DD"
// usando los getters que corresponden a cómo se construyó cada Date (local vs UTC).
function dateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Disponibilidad semanal (HU-04) ----------

  async createAvailability(dto: CreateAvailabilityDto) {
    if (toMinutes(dto.horaInicio) >= toMinutes(dto.horaFin)) {
      throw new BadRequestException('horaInicio debe ser anterior a horaFin');
    }
    return this.prisma.doctorWeeklyAvailability.create({
      data: {
        doctorId: dto.doctorId,
        diaSemana: dto.diaSemana,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        duracionSlotMinutos: dto.duracionSlotMinutos ?? 20,
      },
    });
  }

  findAvailabilityByDoctor(doctorId: number) {
    return this.prisma.doctorWeeklyAvailability.findMany({
      where: { doctorId, activo: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async updateAvailability(id: number, dto: UpdateAvailabilityDto) {
    const existing = await this.prisma.doctorWeeklyAvailability.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Disponibilidad ${id} no encontrada`);
    }
    if (dto.horaInicio && dto.horaFin && toMinutes(dto.horaInicio) >= toMinutes(dto.horaFin)) {
      throw new BadRequestException('horaInicio debe ser anterior a horaFin');
    }
    return this.prisma.doctorWeeklyAvailability.update({ where: { id }, data: dto });
  }

  async deactivateAvailability(id: number) {
    const existing = await this.prisma.doctorWeeklyAvailability.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Disponibilidad ${id} no encontrada`);
    }
    return this.prisma.doctorWeeklyAvailability.update({ where: { id }, data: { activo: false } });
  }

  // ---------- Generación automática de cupos (HU-05) ----------

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleNightlySlotGeneration() {
    this.logger.log('Ejecutando generación nocturna de cupos...');
    const created = await this.generateSlots(SLOT_GENERATION_DAYS_AHEAD);
    this.logger.log(`Generación nocturna completada: ${created} cupos nuevos.`);
  }

  async generateSlots(daysAhead: number = SLOT_GENERATION_DAYS_AHEAD): Promise<number> {
    const availabilities = await this.prisma.doctorWeeklyAvailability.findMany({
      where: { activo: true },
    });
    const timeOff = await this.prisma.doctorTimeOff.findMany();

    let createdCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysAhead; i++) {
      const fecha = addDays(today, i);
      const diaSemana = fecha.getDay();
      const fechaKey = dateKeyLocal(fecha);

      const dayAvailabilities = availabilities.filter((a) => a.diaSemana === diaSemana);

      for (const avail of dayAvailabilities) {
        const enDescanso = timeOff.some(
          (t) => t.doctorId === avail.doctorId && fechaKey >= dateKeyUTC(t.fechaInicio) && fechaKey <= dateKeyUTC(t.fechaFin),
        );
        if (enDescanso) continue;

        const start = toMinutes(avail.horaInicio);
        const end = toMinutes(avail.horaFin);
        const step = avail.duracionSlotMinutos;

        for (let t = start; t + step <= end; t += step) {
          const horaInicio = toHHMM(t);
          const horaFin = toHHMM(t + step);

          const exists = await this.prisma.appointmentSlot.findFirst({
            where: { doctorId: avail.doctorId, fecha, horaInicio },
          });
          if (exists) continue;

          await this.prisma.appointmentSlot.create({
            data: { doctorId: avail.doctorId, fecha, horaInicio, horaFin, estado: 'DISPONIBLE' },
          });
          createdCount++;
        }
      }
    }

    return createdCount;
  }

  async findSlots(doctorId?: number, fecha?: string) {
    return this.prisma.appointmentSlot.findMany({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(fecha ? { fecha: new Date(fecha) } : {}),
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      include: { doctor: true },
    });
  }

  async blockSlot(id: number) {
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException(`Cupo ${id} no encontrado`);
    }
    if (slot.estado === 'RESERVADO') {
      throw new BadRequestException('No se puede bloquear un cupo ya reservado');
    }
    return this.prisma.appointmentSlot.update({ where: { id }, data: { estado: 'BLOQUEADO' } });
  }

  // ---------- Días no laborables: descansos y vacaciones ----------

  async createTimeOff(dto: CreateTimeOffDto) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);
    if (fechaInicio > fechaFin) {
      throw new BadRequestException('fechaInicio debe ser anterior o igual a fechaFin');
    }

    const timeOff = await this.prisma.doctorTimeOff.create({
      data: { doctorId: dto.doctorId, fechaInicio, fechaFin, motivo: dto.motivo },
    });

    // Los cupos ya generados y aún libres en ese rango dejan de tener sentido: se eliminan
    // (no simplemente se bloquean) para que, si el descanso se cancela después, basten con
    // volver a generar cupos para que reaparezcan.
    await this.prisma.appointmentSlot.deleteMany({
      where: { doctorId: dto.doctorId, estado: 'DISPONIBLE', fecha: { gte: fechaInicio, lte: fechaFin } },
    });

    // Las citas que ya estaban agendadas en ese rango no se tocan automáticamente: requieren
    // reprogramación manual. Se devuelven para que la interfaz pueda advertir sobre ellas.
    const citasEnConflicto = await this.prisma.appointment.findMany({
      where: {
        doctorId: dto.doctorId,
        estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'] },
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
      include: { patient: true },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    return { timeOff, citasEnConflicto };
  }

  findTimeOffByDoctor(doctorId: number) {
    return this.prisma.doctorTimeOff.findMany({
      where: { doctorId },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  async deleteTimeOff(id: number) {
    const existing = await this.prisma.doctorTimeOff.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Registro de descanso ${id} no encontrado`);
    }
    await this.prisma.doctorTimeOff.delete({ where: { id } });
  }

  // ---------- Recomendación de horario por demanda (HU-06) ----------

  async getOccupancyRecommendation() {
    const slots = await this.prisma.appointmentSlot.groupBy({
      by: ['doctorId', 'estado'],
      _count: { _all: true },
    });

    const doctors = await this.prisma.doctor.findMany({ where: { activo: true } });

    return doctors.map((doctor) => {
      const doctorSlots = slots.filter((s) => s.doctorId === doctor.id);
      const total = doctorSlots.reduce((sum, s) => sum + s._count._all, 0);
      const reservados = doctorSlots.find((s) => s.estado === 'RESERVADO')?._count._all ?? 0;
      const ocupacionPorcentaje = total > 0 ? Math.round((reservados / total) * 100) : 0;

      return {
        doctorId: doctor.id,
        nombre: `${doctor.nombres} ${doctor.apellidos}`,
        totalCupos: total,
        cuposReservados: reservados,
        ocupacionPorcentaje,
        nivel: ocupacionPorcentaje >= 80 ? 'saturado' : ocupacionPorcentaje <= 30 ? 'subutilizado' : 'normal',
      };
    });
  }
}
