import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MIN_RECORDS_ESPECIFICO = 3;
const MIN_RECORDS_ESPECIALIDAD = 3;
const VENTANA_DIAS_HISTORICO = 90;
const VIDA_MEDIA_DIAS = 30; // los registros pierden la mitad de su peso cada 30 días
const LAMBDA = Math.log(2) / VIDA_MEDIA_DIAS;
const TIEMPO_DEFECTO_MINUTOS = 20;
const AI_SERVICE_TIMEOUT_MS = 2500;

interface AiWaitTimeResponse {
  tiempo_estimado_minutos: number;
  confianza: 'alta' | 'media' | 'baja';
  basado_en: string;
}

export interface PredictionParams {
  doctorId?: number;
  specialtyId?: number;
  diaSemana: number;
  hora: number;
}

export interface PredictionResult {
  tiempoEstimadoMinutos: number;
  confianza: 'alta' | 'media' | 'baja';
  basadoEn: string;
}

function franjaHorariaFrom(hora: number): string {
  return `${hora.toString().padStart(2, '0')}:00-${(hora + 1).toString().padStart(2, '0')}:00`;
}

function weightedAverage(records: { tiempoEsperaMinutosReal: number; fechaRegistro: Date }[]): number {
  const now = Date.now();
  let sumWeighted = 0;
  let sumWeights = 0;
  for (const r of records) {
    const daysSince = Math.max(0, (now - r.fechaRegistro.getTime()) / (1000 * 60 * 60 * 24));
    const weight = Math.exp(-LAMBDA * daysSince);
    sumWeighted += weight * r.tiempoEsperaMinutosReal;
    sumWeights += weight;
  }
  return sumWeights > 0 ? Math.round(sumWeighted / sumWeights) : TIEMPO_DEFECTO_MINUTOS;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async predictWaitTime(params: PredictionParams): Promise<PredictionResult> {
    // El servicio de IA (Python/FastAPI + scikit-learn) es la fuente primaria cuando hay un
    // médico puntual: entrenó un modelo de regresión sobre el histórico real. Si no responde
    // (apagado, timeout, sin modelo entrenado todavía) se cae en la heurística de respaldo
    // de abajo, que nunca depende de un servicio externo.
    if (params.doctorId) {
      const specialtyIdParaIa = params.specialtyId ?? (await this.getSpecialtyIdForDoctor(params.doctorId));
      if (specialtyIdParaIa) {
        const aiResult = await this.tryAiPrediction({ ...params, specialtyId: specialtyIdParaIa });
        if (aiResult) return aiResult;
      }
    }

    return this.predictWithHeuristic(params);
  }

  private async tryAiPrediction(
    params: PredictionParams & { specialtyId: number },
  ): Promise<PredictionResult | null> {
    const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${baseUrl}/predict/wait-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: params.doctorId,
          specialty_id: params.specialtyId,
          dia_semana: params.diaSemana,
          hora: params.hora,
        }),
        signal: AbortSignal.timeout(AI_SERVICE_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Servicio de IA respondió ${res.status}; se usa la heurística de respaldo.`);
        return null;
      }
      const data = (await res.json()) as AiWaitTimeResponse;
      return {
        tiempoEstimadoMinutos: data.tiempo_estimado_minutos,
        confianza: data.confianza,
        basadoEn: `[IA] ${data.basado_en}`,
      };
    } catch (err) {
      this.logger.warn(
        `Servicio de IA no disponible (${(err as Error).message}); se usa la heurística de respaldo.`,
      );
      return null;
    }
  }

  private async predictWithHeuristic(params: PredictionParams): Promise<PredictionResult> {
    const franjaHoraria = franjaHorariaFrom(params.hora);
    const desde = new Date();
    desde.setDate(desde.getDate() - VENTANA_DIAS_HISTORICO);

    // Nivel 1: histórico específico del médico, mismo día de semana y franja horaria.
    if (params.doctorId) {
      const registros = await this.prisma.waitTimeHistory.findMany({
        where: {
          doctorId: params.doctorId,
          diaSemana: params.diaSemana,
          franjaHoraria,
          fechaRegistro: { gte: desde },
        },
        orderBy: { fechaRegistro: 'desc' },
        take: 60,
      });

      if (registros.length >= MIN_RECORDS_ESPECIFICO) {
        return {
          tiempoEstimadoMinutos: weightedAverage(registros),
          confianza: 'alta',
          basadoEn: `Histórico del médico ${params.doctorId}, mismo día de la semana y franja horaria (${registros.length} registros)`,
        };
      }
    }

    // Nivel 2: histórico de la especialidad (todos los médicos de esa especialidad), mismo día/franja.
    const specialtyId = params.specialtyId ?? (await this.getSpecialtyIdForDoctor(params.doctorId));
    if (specialtyId) {
      const doctorIds = await this.prisma.doctor.findMany({
        where: { specialtyId },
        select: { id: true },
      });
      const ids = doctorIds.map((d) => d.id);

      if (ids.length > 0) {
        const registros = await this.prisma.waitTimeHistory.findMany({
          where: {
            doctorId: { in: ids },
            diaSemana: params.diaSemana,
            franjaHoraria,
            fechaRegistro: { gte: desde },
          },
          orderBy: { fechaRegistro: 'desc' },
          take: 90,
        });

        if (registros.length >= MIN_RECORDS_ESPECIALIDAD) {
          return {
            tiempoEstimadoMinutos: weightedAverage(registros),
            confianza: 'media',
            basadoEn: `Histórico de la especialidad ${specialtyId}, mismo día de la semana y franja horaria (${registros.length} registros)`,
          };
        }
      }
    }

    // Nivel 3: promedio general de toda la clínica (último recurso).
    const generales = await this.prisma.waitTimeHistory.findMany({
      where: { fechaRegistro: { gte: desde } },
      orderBy: { fechaRegistro: 'desc' },
      take: 200,
    });

    if (generales.length > 0) {
      return {
        tiempoEstimadoMinutos: weightedAverage(generales),
        confianza: 'baja',
        basadoEn: `Sin historial suficiente para el médico/especialidad; promedio general de la clínica (${generales.length} registros)`,
      };
    }

    return {
      tiempoEstimadoMinutos: TIEMPO_DEFECTO_MINUTOS,
      confianza: 'baja',
      basadoEn: 'Sin histórico disponible todavía; valor por defecto',
    };
  }

  private async getSpecialtyIdForDoctor(doctorId?: number): Promise<number | undefined> {
    if (!doctorId) return undefined;
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    return doctor?.specialtyId;
  }
}
