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

function franjaHorariaFrom(horaInicio: string): string {
  const hour = Number(horaInicio.split(':')[0]);
  return `${hour.toString().padStart(2, '0')}:00`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

  // ---------- Dashboard por periodo (semanal/mensual/trimestral/anual) ----------

  async getDashboard(period: 'week' | 'month' | 'quarter' | 'year', from?: string, to?: string) {
    // La semana usa una ventana por defecto más corta (12 semanas) que el resto (12 meses):
    // mostrar 12 meses de puntos semanales sería un gráfico ilegible de ~52 barras.
    const desde = from
      ? new Date(from)
      : period === 'week'
        ? new Date(new Date().setDate(new Date().getDate() - 12 * 7))
        : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    // Se cuenta directo de Appointment (en vez de la tabla DailyStats, que solo se agrega
    // una vez al día con un cron a las 2am): así una cita recién completada aparece en el
    // reporte al instante, sin esperar a la agregación nocturna del día siguiente.
    const citas = await this.prisma.appointment.findMany({
      where: { fecha: { gte: desde, lte: hasta }, estado: { in: ['COMPLETADA', 'NO_ASISTIO'] } },
      select: { fecha: true, estado: true, waitTimeHistory: { select: { tiempoEsperaMinutosReal: true } } },
      orderBy: { fecha: 'asc' },
    });

    const bucketKey = (fecha: Date): string => {
      const y = fecha.getUTCFullYear();
      if (period === 'year') return `${y}`;
      if (period === 'quarter') return `${y}-Q${Math.floor(fecha.getUTCMonth() / 3) + 1}`;
      if (period === 'week') return this.mondayOfWeek(fecha).toISOString().split('T')[0];
      return `${y}-${(fecha.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    };

    const buckets = new Map<
      string,
      { periodo: string; totalCompletadas: number; totalNoShow: number; sumaTiempo: number; conteoTiempo: number }
    >();

    for (const cita of citas) {
      const key = bucketKey(cita.fecha);
      if (!buckets.has(key)) {
        buckets.set(key, { periodo: key, totalCompletadas: 0, totalNoShow: 0, sumaTiempo: 0, conteoTiempo: 0 });
      }
      const bucket = buckets.get(key)!;
      if (cita.estado === 'COMPLETADA') {
        bucket.totalCompletadas += 1;
        if (cita.waitTimeHistory) {
          bucket.sumaTiempo += cita.waitTimeHistory.tiempoEsperaMinutosReal;
          bucket.conteoTiempo += 1;
        }
      } else {
        bucket.totalNoShow += 1;
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

  // ---------- Horarios con más/menos pacientes, por especialidad ----------
  // Se calculan ambas vistas (por franja horaria y por semana) en una sola pasada sobre
  // las citas completadas, para que el frontend pueda alternar entre ellas sin pedir de
  // nuevo al backend.

  async getScheduleOccupancyReport() {
    const citas = await this.prisma.appointment.findMany({
      where: { estado: 'COMPLETADA' },
      select: { horaInicio: true, fecha: true, doctor: { select: { specialty: { select: { nombre: true } } } } },
    });

    const porHoraMap = new Map<string, Map<string, number>>();
    const porSemanaMap = new Map<string, Map<string, number>>();

    for (const cita of citas) {
      const especialidad = cita.doctor.specialty.nombre;
      const hora = franjaHorariaFrom(cita.horaInicio);
      if (!porHoraMap.has(hora)) porHoraMap.set(hora, new Map());
      const bucketHora = porHoraMap.get(hora)!;
      bucketHora.set(especialidad, (bucketHora.get(especialidad) ?? 0) + 1);

      const semana = this.mondayOfWeek(cita.fecha).toISOString().split('T')[0];
      if (!porSemanaMap.has(semana)) porSemanaMap.set(semana, new Map());
      const bucketSemana = porSemanaMap.get(semana)!;
      bucketSemana.set(especialidad, (bucketSemana.get(especialidad) ?? 0) + 1);
    }

    const porHora: { franjaHoraria: string; especialidad: string; totalPacientes: number }[] = [];
    for (const [franjaHoraria, porEspecialidad] of porHoraMap) {
      for (const [especialidad, totalPacientes] of porEspecialidad) {
        porHora.push({ franjaHoraria, especialidad, totalPacientes });
      }
    }
    porHora.sort((a, b) => a.franjaHoraria.localeCompare(b.franjaHoraria));

    const porSemana: { semana: string; especialidad: string; totalPacientes: number }[] = [];
    for (const [semana, porEspecialidad] of porSemanaMap) {
      for (const [especialidad, totalPacientes] of porEspecialidad) {
        porSemana.push({ semana, especialidad, totalPacientes });
      }
    }
    porSemana.sort((a, b) => a.semana.localeCompare(b.semana));

    return { porHora, porSemana };
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

  // ---------- Tiempo de espera semanal por especialidad ----------

  // Lunes de la semana ISO a la que pertenece `fecha` (fecha viene de DailyStats.fecha,
  // que Prisma devuelve como medianoche UTC — por eso se opera todo en UTC).
  private mondayOfWeek(fecha: Date): Date {
    const date = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
    const dia = date.getUTCDay(); // 0=domingo .. 6=sábado
    const diffALunes = (dia + 6) % 7;
    date.setUTCDate(date.getUTCDate() - diffALunes);
    return date;
  }

  async getWaitTimeWeeklyBySpecialty(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 12 * 7));
    const hasta = to ? new Date(to) : new Date();

    const stats = await this.prisma.dailyStats.findMany({
      where: { fecha: { gte: desde, lte: hasta }, tiempoEsperaPromedioMinutos: { not: null } },
      include: { doctor: { include: { specialty: true } } },
      orderBy: { fecha: 'asc' },
    });

    const buckets = new Map<string, Map<string, { suma: number; conteo: number }>>();

    for (const stat of stats) {
      const semana = this.mondayOfWeek(stat.fecha).toISOString().split('T')[0];
      const especialidad = stat.doctor.specialty.nombre;
      if (!buckets.has(semana)) buckets.set(semana, new Map());
      const porEspecialidad = buckets.get(semana)!;
      if (!porEspecialidad.has(especialidad)) porEspecialidad.set(especialidad, { suma: 0, conteo: 0 });
      const bucket = porEspecialidad.get(especialidad)!;
      bucket.suma += stat.tiempoEsperaPromedioMinutos!;
      bucket.conteo += 1;
    }

    const resultado: { semana: string; especialidad: string; tiempoEsperaPromedioMinutos: number }[] = [];
    for (const [semana, porEspecialidad] of buckets) {
      for (const [especialidad, { suma, conteo }] of porEspecialidad) {
        resultado.push({
          semana,
          especialidad,
          tiempoEsperaPromedioMinutos: Math.round((suma / conteo) * 10) / 10,
        });
      }
    }

    return resultado.sort((a, b) => a.semana.localeCompare(b.semana));
  }

  // ---------- Indicador de retención de ingresos (política de cancelación) ----------

  async getRetencionIngresos(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const citas = await this.prisma.appointment.findMany({
      where: { pagado: true, fecha: { gte: desde, lte: hasta }, reembolso: { not: 'NO_APLICA' } },
      select: { monto: true, reembolso: true },
    });

    let montoRetenido = 0;
    let montoReembolsado = 0;
    let citasConDineroPerdido = 0;
    let citasReembolsadas = 0;

    for (const cita of citas) {
      const monto = cita.monto ?? 0;
      if (cita.reembolso === 'PERDIDO') {
        montoRetenido += monto;
        citasConDineroPerdido++;
      } else if (cita.reembolso === 'REEMBOLSADO') {
        montoReembolsado += monto;
        citasReembolsadas++;
      }
    }

    return { montoRetenido, montoReembolsado, citasConDineroPerdido, citasReembolsadas };
  }

  // ---------- Reporte de costos: ingresos por especialidad ----------

  async getCostosPorEspecialidad(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const citas = await this.prisma.appointment.findMany({
      where: { pagado: true, fecha: { gte: desde, lte: hasta } },
      select: { monto: true, doctor: { select: { specialty: { select: { nombre: true } } } } },
    });

    const porEspecialidad = new Map<string, { totalCitas: number; ingresoTotal: number }>();
    for (const cita of citas) {
      const especialidad = cita.doctor.specialty.nombre;
      if (!porEspecialidad.has(especialidad)) {
        porEspecialidad.set(especialidad, { totalCitas: 0, ingresoTotal: 0 });
      }
      const bucket = porEspecialidad.get(especialidad)!;
      bucket.totalCitas += 1;
      bucket.ingresoTotal += cita.monto ?? 0;
    }

    return Array.from(porEspecialidad.entries())
      .map(([especialidad, v]) => ({
        especialidad,
        totalCitas: v.totalCitas,
        ingresoTotal: Math.round(v.ingresoTotal * 100) / 100,
      }))
      .sort((a, b) => b.ingresoTotal - a.ingresoTotal);
  }

  // ---------- Citas más concurridas: combinación día de semana + franja horaria ----------

  async getCitasMasConcurridas(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const citas = await this.prisma.appointment.findMany({
      where: { estado: 'COMPLETADA', fecha: { gte: desde, lte: hasta } },
      select: { fecha: true, horaInicio: true },
    });

    const conteo = new Map<string, number>();
    for (const cita of citas) {
      const dia = DIAS_SEMANA[cita.fecha.getUTCDay()];
      const franja = franjaHorariaFrom(cita.horaInicio);
      const key = `${dia}|${franja}`;
      conteo.set(key, (conteo.get(key) ?? 0) + 1);
    }

    return Array.from(conteo.entries())
      .map(([key, totalCitas]) => {
        const [dia, franjaHoraria] = key.split('|');
        return { dia, franjaHoraria, totalCitas };
      })
      .sort((a, b) => b.totalCitas - a.totalCitas)
      .slice(0, 15);
  }

  // ---------- Especialidad más solicitada: total de citas registradas por especialidad
  // (cualquier estado, para reflejar demanda real, no solo lo efectivamente atendido) ----------

  async getCitasPorEspecialidad(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const citas = await this.prisma.appointment.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      select: { doctor: { select: { specialty: { select: { nombre: true } } } } },
    });

    const conteo = new Map<string, number>();
    for (const cita of citas) {
      const especialidad = cita.doctor.specialty.nombre;
      conteo.set(especialidad, (conteo.get(especialidad) ?? 0) + 1);
    }

    return Array.from(conteo.entries())
      .map(([especialidad, totalCitas]) => ({ especialidad, totalCitas }))
      .sort((a, b) => b.totalCitas - a.totalCitas);
  }

  // ---------- Tiempo de consulta promedio por especialidad (duración real de la atención,
  // no el tiempo de espera previo): horaAtencionFinReal - horaAtencionInicioReal ----------

  async getTiempoConsultaPorEspecialidad(from?: string, to?: string) {
    const desde = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const hasta = to ? new Date(to) : new Date();

    const citas = await this.prisma.appointment.findMany({
      where: {
        estado: 'COMPLETADA',
        horaAtencionInicioReal: { not: null },
        horaAtencionFinReal: { not: null },
        fecha: { gte: desde, lte: hasta },
      },
      select: {
        horaAtencionInicioReal: true,
        horaAtencionFinReal: true,
        doctor: { select: { specialty: { select: { nombre: true } } } },
      },
    });

    const porEspecialidad = new Map<string, { suma: number; conteo: number }>();
    for (const cita of citas) {
      const minutos = (cita.horaAtencionFinReal!.getTime() - cita.horaAtencionInicioReal!.getTime()) / 60000;
      if (minutos < 0) continue;
      const especialidad = cita.doctor.specialty.nombre;
      if (!porEspecialidad.has(especialidad)) porEspecialidad.set(especialidad, { suma: 0, conteo: 0 });
      const bucket = porEspecialidad.get(especialidad)!;
      bucket.suma += minutos;
      bucket.conteo += 1;
    }

    return Array.from(porEspecialidad.entries())
      .map(([especialidad, { suma, conteo }]) => ({
        especialidad,
        tiempoConsultaPromedioMinutos: Math.round((suma / conteo) * 10) / 10,
        totalConsultas: conteo,
      }))
      .sort((a, b) => b.tiempoConsultaPromedioMinutos - a.tiempoConsultaPromedioMinutos);
  }
}
