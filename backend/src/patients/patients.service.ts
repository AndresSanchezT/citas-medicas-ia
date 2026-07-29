import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const PRIORIDAD_ORDEN: Record<string, number> = { LEVE: 0, MODERADO: 1, URGENTE: 2, CRITICO: 3 };
const PRIORIDAD_LABEL: Record<string, string> = { LEVE: 'leve', MODERADO: 'moderada', URGENTE: 'urgente', CRITICO: 'crítica' };

export interface TriageSummaryHallazgo {
  campo: string;
  tendencia: 'mejora' | 'empeora' | 'estable';
  detalle: string;
}

export interface TriageSummaryResponse {
  disponible: boolean;
  mensaje: string;
  hallazgos: TriageSummaryHallazgo[];
  totalTriajesConsiderados: number;
  primerTriaje?: string;
  ultimoTriaje?: string;
  disclaimer: string;
}

const DISCLAIMER =
  'Resumen generado automáticamente comparando los valores registrados en el triaje; no reemplaza el criterio clínico del médico.';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    const existing = await this.prisma.patient.findUnique({
      where: { documentoIdentidad: dto.documentoIdentidad },
    });
    if (existing) {
      throw new ConflictException('Ya existe un paciente registrado con ese documento de identidad');
    }

    return this.prisma.patient.create({
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      },
    });
  }

  async findAll(search?: string) {
    return this.prisma.patient.findMany({
      where: search
        ? {
            activo: true,
            OR: [
              { nombres: { contains: search } },
              { apellidos: { contains: search } },
              { documentoIdentidad: { contains: search } },
            ],
          }
        : { activo: true },
      orderBy: { apellidos: 'asc' },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Paciente ${id} no encontrado`);
    }
    return patient;
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.patient.update({ where: { id }, data: { activo: false } });
  }

  // ---------- Resumen de evolución del triaje (comparación primer vs. último registro) ----------

  async getTriageSummary(id: number): Promise<TriageSummaryResponse> {
    await this.findOne(id);

    const appointments = await this.prisma.appointment.findMany({
      where: { patientId: id, triage: { isNot: null } },
      include: { triage: true },
      orderBy: { fecha: 'asc' },
    });

    const triajes = appointments
      .filter((a) => a.triage)
      .map((a) => ({ fecha: a.fecha, ...a.triage! }));

    if (triajes.length < 2) {
      return {
        disponible: false,
        mensaje:
          triajes.length === 0
            ? 'Este paciente todavía no tiene ningún triaje registrado.'
            : 'Solo hay un triaje registrado; se necesitan al menos dos para comparar una evolución.',
        hallazgos: [],
        totalTriajesConsiderados: triajes.length,
        disclaimer: DISCLAIMER,
      };
    }

    const primero = triajes[0];
    const ultimo = triajes[triajes.length - 1];
    const diasTranscurridos = Math.max(
      1,
      Math.round((ultimo.fecha.getTime() - primero.fecha.getTime()) / 86_400_000),
    );
    const semanas = Math.max(1, Math.round(diasTranscurridos / 7));

    const hallazgos: TriageSummaryHallazgo[] = [];

    if (primero.peso != null && ultimo.peso != null) {
      const delta = Math.round((ultimo.peso - primero.peso) * 10) / 10;
      if (Math.abs(delta) < 0.3) {
        hallazgos.push({ campo: 'Peso', tendencia: 'estable', detalle: `mantuvo su peso (${ultimo.peso} kg)` });
      } else if (delta < 0) {
        hallazgos.push({
          campo: 'Peso',
          tendencia: 'mejora',
          detalle: `bajó ${Math.abs(delta)} kg de peso (de ${primero.peso} a ${ultimo.peso} kg)`,
        });
      } else {
        hallazgos.push({
          campo: 'Peso',
          tendencia: 'empeora',
          detalle: `subió ${delta} kg de peso (de ${primero.peso} a ${ultimo.peso} kg)`,
        });
      }
    }

    if (primero.presionSistolica != null && ultimo.presionSistolica != null) {
      const distanciaANormal = (sist: number, diast: number | null) =>
        Math.abs(sist - 120) + Math.abs((diast ?? 80) - 80);
      const distPrimero = distanciaANormal(primero.presionSistolica, primero.presionDiastolica);
      const distUltimo = distanciaANormal(ultimo.presionSistolica, ultimo.presionDiastolica);
      const pPrimero = `${primero.presionSistolica}/${primero.presionDiastolica ?? '—'}`;
      const pUltimo = `${ultimo.presionSistolica}/${ultimo.presionDiastolica ?? '—'}`;
      if (Math.abs(distPrimero - distUltimo) < 5) {
        hallazgos.push({ campo: 'Presión arterial', tendencia: 'estable', detalle: `se mantuvo estable (${pUltimo})` });
      } else if (distUltimo < distPrimero) {
        hallazgos.push({ campo: 'Presión arterial', tendencia: 'mejora', detalle: `mejoró (de ${pPrimero} a ${pUltimo})` });
      } else {
        hallazgos.push({
          campo: 'Presión arterial',
          tendencia: 'empeora',
          detalle: `empeoró (de ${pPrimero} a ${pUltimo}) — conviene vigilarla`,
        });
      }
    }

    if (primero.frecuenciaCardiaca != null && ultimo.frecuenciaCardiaca != null) {
      const enRango = (v: number) => v >= 60 && v <= 100;
      const fcPrimero = primero.frecuenciaCardiaca;
      const fcUltimo = ultimo.frecuenciaCardiaca;
      if (enRango(fcUltimo) && !enRango(fcPrimero)) {
        hallazgos.push({
          campo: 'Ritmo cardíaco',
          tendencia: 'mejora',
          detalle: `mejoró su ritmo cardíaco (de ${fcPrimero} a ${fcUltimo} lpm, ahora dentro de rango normal)`,
        });
      } else if (!enRango(fcUltimo) && enRango(fcPrimero)) {
        hallazgos.push({
          campo: 'Ritmo cardíaco',
          tendencia: 'empeora',
          detalle: `su ritmo cardíaco salió del rango normal (de ${fcPrimero} a ${fcUltimo} lpm)`,
        });
      } else if (Math.abs(fcUltimo - fcPrimero) > 3) {
        hallazgos.push({
          campo: 'Ritmo cardíaco',
          tendencia: fcUltimo < fcPrimero ? 'mejora' : 'empeora',
          detalle: `pasó de ${fcPrimero} a ${fcUltimo} lpm`,
        });
      } else {
        hallazgos.push({ campo: 'Ritmo cardíaco', tendencia: 'estable', detalle: `se mantuvo estable (${fcUltimo} lpm)` });
      }
    }

    if (primero.saturacionOxigeno != null && ultimo.saturacionOxigeno != null) {
      const delta = ultimo.saturacionOxigeno - primero.saturacionOxigeno;
      if (Math.abs(delta) <= 1) {
        hallazgos.push({
          campo: 'Saturación de oxígeno',
          tendencia: 'estable',
          detalle: `se mantuvo estable (${ultimo.saturacionOxigeno}%)`,
        });
      } else if (delta > 0) {
        hallazgos.push({
          campo: 'Saturación de oxígeno',
          tendencia: 'mejora',
          detalle: `mejoró (de ${primero.saturacionOxigeno}% a ${ultimo.saturacionOxigeno}%)`,
        });
      } else {
        hallazgos.push({
          campo: 'Saturación de oxígeno',
          tendencia: 'empeora',
          detalle: `bajó (de ${primero.saturacionOxigeno}% a ${ultimo.saturacionOxigeno}%)`,
        });
      }
    }

    if (primero.temperatura != null && ultimo.temperatura != null) {
      const fiebre = (v: number) => v > 37.5;
      if (fiebre(primero.temperatura) && !fiebre(ultimo.temperatura)) {
        hallazgos.push({
          campo: 'Temperatura',
          tendencia: 'mejora',
          detalle: `la fiebre cedió (de ${primero.temperatura}°C a ${ultimo.temperatura}°C)`,
        });
      } else if (!fiebre(primero.temperatura) && fiebre(ultimo.temperatura)) {
        hallazgos.push({
          campo: 'Temperatura',
          tendencia: 'empeora',
          detalle: `presenta fiebre nueva (de ${primero.temperatura}°C a ${ultimo.temperatura}°C)`,
        });
      }
    }

    if (primero.prioridad && ultimo.prioridad && primero.prioridad !== ultimo.prioridad) {
      const antes = PRIORIDAD_ORDEN[primero.prioridad];
      const despues = PRIORIDAD_ORDEN[ultimo.prioridad];
      hallazgos.push({
        campo: 'Prioridad clínica',
        tendencia: despues < antes ? 'mejora' : 'empeora',
        detalle: `su prioridad clínica pasó de ${PRIORIDAD_LABEL[primero.prioridad]} a ${PRIORIDAD_LABEL[ultimo.prioridad]}`,
      });
    }

    const mejoras = hallazgos.filter((h) => h.tendencia === 'mejora').map((h) => h.detalle);
    const empeoramientos = hallazgos.filter((h) => h.tendencia === 'empeora').map((h) => h.detalle);

    let mensaje = `En estas ${semanas} semana${semanas === 1 ? '' : 's'} desde tu triaje anterior, `;
    const frases: string[] = [];
    if (mejoras.length) frases.push(mejoras.join(', '));
    if (empeoramientos.length) frases.push(`${mejoras.length ? 'aunque' : ''} ${empeoramientos.join(', ')}`.trim());
    if (!mejoras.length && !empeoramientos.length) frases.push('los valores registrados se mantuvieron estables');
    mensaje += `${frases.join('; ')}.`;

    if (empeoramientos.length > 0) {
      mensaje += ' Se recomienda seguimiento médico de los valores que empeoraron.';
    } else if (mejoras.length > 0) {
      mensaje += ' Se observa una evolución favorable.';
    }

    return {
      disponible: true,
      mensaje,
      hallazgos,
      totalTriajesConsiderados: triajes.length,
      primerTriaje: primero.fecha.toISOString().split('T')[0],
      ultimoTriaje: ultimo.fecha.toISOString().split('T')[0],
      disclaimer: DISCLAIMER,
    };
  }
}
