import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Construye la medianoche UTC que representa una fecha calendario LOCAL (y, m, d con
// m 0-indexado, d puede ser 0 o negativo para restar días). Evita mezclar getters locales
// con extracción UTC, que desfasaba el día en zonas UTC-negativas (mismo tipo de bug ya
// corregido antes en appointments.service.ts).
function localDateAsUtcMidnight(baseDate: Date, dayOffset: number): Date {
  return new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + dayOffset));
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Agregación diaria (DailyStats) ----------

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleNightlyAggregation() {
    const ayer = localDateAsUtcMidnight(new Date(), -1);
    const total = await this.generateDailyStatsFor(ayer);
    this.logger.log(`Agregación nocturna de DailyStats completada: ${total} médicos actualizados.`);
  }

  generateDailyStatsForDateOrToday(fecha?: string): Promise<number> {
    return this.generateDailyStatsFor(fecha ? new Date(fecha) : localDateAsUtcMidnight(new Date(), 0));
  }

  async generateDailyStatsFor(fecha: Date): Promise<number> {
    const doctors = await this.prisma.doctor.findMany({ where: { activo: true } });
    let count = 0;

    for (const doctor of doctors) {
      const citas = await this.prisma.appointment.findMany({
        where: { doctorId: doctor.id, fecha },
      });
      if (citas.length === 0) continue;

      const completadas = citas.filter((c) => c.estado === 'COMPLETADA').length;
      const noShow = citas.filter((c) => c.estado === 'NO_ASISTIO').length;

      const historial = await this.prisma.waitTimeHistory.findMany({
        where: { doctorId: doctor.id, fechaRegistro: fecha },
      });
      const tiempos = historial.map((h) => h.tiempoEsperaMinutosReal);
      const promedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
      const maximo = tiempos.length > 0 ? Math.max(...tiempos) : null;

      await this.prisma.dailyStats.upsert({
        where: { doctorId_fecha: { doctorId: doctor.id, fecha } },
        create: {
          doctorId: doctor.id,
          fecha,
          totalCitasProgramadas: citas.length,
          totalCitasCompletadas: completadas,
          totalNoShow: noShow,
          tiempoEsperaPromedioMinutos: promedio,
          tiempoEsperaMaxMinutos: maximo,
        },
        update: {
          totalCitasProgramadas: citas.length,
          totalCitasCompletadas: completadas,
          totalNoShow: noShow,
          tiempoEsperaPromedioMinutos: promedio,
          tiempoEsperaMaxMinutos: maximo,
        },
      });
      count++;
    }

    return count;
  }

  // ---------- Dashboard por periodo (mensual/trimestral/anual) ----------

  async getDashboard(period: 'month' | 'quarter' | 'year', from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const stats = await this.prisma.dailyStats.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
    });

    const bucketKey = (fecha: Date): string => {
      const y = fecha.getUTCFullYear();
      if (period === 'year') return `${y}`;
      if (period === 'quarter') return `${y}-Q${Math.floor(fecha.getUTCMonth() / 3) + 1}`;
      return `${y}-${(fecha.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    };

    const buckets = new Map<
      string,
      { periodo: string; totalCompletadas: number; totalNoShow: number; sumaTiempo: number; conteoTiempo: number }
    >();

    for (const stat of stats) {
      const key = bucketKey(stat.fecha);
      if (!buckets.has(key)) {
        buckets.set(key, { periodo: key, totalCompletadas: 0, totalNoShow: 0, sumaTiempo: 0, conteoTiempo: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.totalCompletadas += stat.totalCitasCompletadas;
      bucket.totalNoShow += stat.totalNoShow;
      if (stat.tiempoEsperaPromedioMinutos != null) {
        bucket.sumaTiempo += stat.tiempoEsperaPromedioMinutos;
        bucket.conteoTiempo += 1;
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .map((b) => ({
        periodo: b.periodo,
        totalCitasCompletadas: b.totalCompletadas,
        totalNoShow: b.totalNoShow,
        tiempoEsperaPromedioMinutos: b.conteoTiempo > 0 ? Math.round(b.sumaTiempo / b.conteoTiempo) : null,
        porcentajeNoShow:
          b.totalCompletadas + b.totalNoShow > 0
            ? Math.round((b.totalNoShow / (b.totalCompletadas + b.totalNoShow)) * 100)
            : 0,
      }));
  }

  // ---------- Horarios con más/menos pacientes ----------

  async getScheduleOccupancyReport() {
    const citas = await this.prisma.appointment.findMany({
      where: { estado: 'COMPLETADA' },
      select: { horaInicio: true },
    });

    const porHora = new Map<number, number>();
    for (const cita of citas) {
      const hora = Number(cita.horaInicio.split(':')[0]);
      porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
    }

    return Array.from(porHora.entries())
      .map(([hora, total]) => ({ franjaHoraria: `${hora.toString().padStart(2, '0')}:00`, totalPacientes: total }))
      .sort((a, b) => a.franjaHoraria.localeCompare(b.franjaHoraria));
  }

  // ---------- Médico con más/menos pacientes ----------

  async getDoctorRankingReport(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const counts = await this.prisma.appointment.groupBy({
      by: ['doctorId'],
      where: { estado: 'COMPLETADA', fecha: { gte: desde, lte: hasta } },
      _count: { _all: true },
    });

    const doctors = await this.prisma.doctor.findMany({ where: { activo: true }, include: { specialty: true } });

    return doctors
      .map((doctor) => ({
        doctorId: doctor.id,
        nombre: `${doctor.nombres} ${doctor.apellidos}`,
        especialidad: doctor.specialty.nombre,
        totalPacientesAtendidos: counts.find((c) => c.doctorId === doctor.id)?._count._all ?? 0,
      }))
      .sort((a, b) => b.totalPacientesAtendidos - a.totalPacientesAtendidos);
  }
}
