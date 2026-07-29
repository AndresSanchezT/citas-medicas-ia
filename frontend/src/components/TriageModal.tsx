import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { upsertTriage, type Appointment, type TriagePrioridad } from '../api/appointments';
import { PRIORIDAD_LABEL } from './AppointmentActions';
import { Modal } from './Modal';
import * as ui from './ui';

interface TriageForm {
  presionSistolica?: string;
  presionDiastolica?: string;
  frecuenciaCardiaca?: string;
  temperatura?: string;
  frecuenciaRespiratoria?: string;
  saturacionOxigeno?: string;
  peso?: string;
  talla?: string;
  prioridad?: TriagePrioridad | '';
  notas?: string;
}

interface TriageModalProps {
  appointment: Appointment;
  onClose: () => void;
}

function toNumberOrUndefined(value?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// Rangos de referencia para un adulto en reposo (guía visual, no diagnóstico): permiten
// que quien registra el triaje note de un vistazo si un valor luce inusual, sin bloquear
// el guardado — el criterio clínico final siempre es del personal de salud.
const RANGOS_NORMALES: Partial<Record<keyof TriageForm, { min: number; max: number }>> = {
  presionSistolica: { min: 90, max: 140 },
  presionDiastolica: { min: 60, max: 90 },
  frecuenciaCardiaca: { min: 60, max: 100 },
  temperatura: { min: 36, max: 37.5 },
  frecuenciaRespiratoria: { min: 12, max: 20 },
  saturacionOxigeno: { min: 95, max: 100 },
};

function fueraDeRango(campo: keyof TriageForm, valor?: string): boolean {
  const rango = RANGOS_NORMALES[campo];
  if (!rango || !valor) return false;
  const n = Number(valor);
  if (Number.isNaN(n)) return false;
  return n < rango.min || n > rango.max;
}

export function TriageModal({ appointment, onClose }: TriageModalProps) {
  const queryClient = useQueryClient();
  const existing = appointment.triage;

  const { register, handleSubmit, watch } = useForm<TriageForm>({
    defaultValues: {
      presionSistolica: existing?.presionSistolica?.toString() ?? '',
      presionDiastolica: existing?.presionDiastolica?.toString() ?? '',
      frecuenciaCardiaca: existing?.frecuenciaCardiaca?.toString() ?? '',
      temperatura: existing?.temperatura?.toString() ?? '',
      frecuenciaRespiratoria: existing?.frecuenciaRespiratoria?.toString() ?? '',
      saturacionOxigeno: existing?.saturacionOxigeno?.toString() ?? '',
      peso: existing?.peso?.toString() ?? '',
      talla: existing?.talla?.toString() ?? '',
      prioridad: existing?.prioridad ?? '',
      notas: existing?.notas ?? '',
    },
  });

  const valores = watch();

  const saveMutation = useMutation({
    mutationFn: (values: TriageForm) =>
      upsertTriage(appointment.id, {
        presionSistolica: toNumberOrUndefined(values.presionSistolica),
        presionDiastolica: toNumberOrUndefined(values.presionDiastolica),
        frecuenciaCardiaca: toNumberOrUndefined(values.frecuenciaCardiaca),
        temperatura: toNumberOrUndefined(values.temperatura),
        frecuenciaRespiratoria: toNumberOrUndefined(values.frecuenciaRespiratoria),
        saturacionOxigeno: toNumberOrUndefined(values.saturacionOxigeno),
        peso: toNumberOrUndefined(values.peso),
        talla: toNumberOrUndefined(values.talla),
        prioridad: values.prioridad || undefined,
        notas: values.notas || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
  });

  function campoStyle(campo: keyof TriageForm) {
    return fueraDeRango(campo, valores[campo])
      ? { ...ui.input, borderColor: 'var(--color-critical)', background: 'var(--color-critical-tint)' }
      : ui.input;
  }

  function Aviso({ campo }: { campo: keyof TriageForm }) {
    if (!fueraDeRango(campo, valores[campo])) return null;
    const r = RANGOS_NORMALES[campo]!;
    return (
      <small style={{ color: 'var(--color-critical)' }}>Fuera del rango normal ({r.min}–{r.max})</small>
    );
  }

  return (
    <Modal
      title={`Triaje — ${appointment.patient.nombres} ${appointment.patient.apellidos}`}
      onClose={onClose}
      width={520}
    >
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <div>
            <label>Presión sistólica (mmHg) — normal 90-140</label>
            <input type="number" placeholder="Ej. 120" {...register('presionSistolica')} style={campoStyle('presionSistolica')} />
            <Aviso campo="presionSistolica" />
          </div>
          <div>
            <label>Presión diastólica (mmHg) — normal 60-90</label>
            <input type="number" placeholder="Ej. 80" {...register('presionDiastolica')} style={campoStyle('presionDiastolica')} />
            <Aviso campo="presionDiastolica" />
          </div>
          <div>
            <label>Frecuencia cardíaca (lpm) — normal 60-100</label>
            <input type="number" placeholder="Ej. 75" {...register('frecuenciaCardiaca')} style={campoStyle('frecuenciaCardiaca')} />
            <Aviso campo="frecuenciaCardiaca" />
          </div>
          <div>
            <label>Temperatura (°C) — normal 36-37.5</label>
            <input type="number" step="0.1" placeholder="Ej. 36.5" {...register('temperatura')} style={campoStyle('temperatura')} />
            <Aviso campo="temperatura" />
          </div>
          <div>
            <label>Frecuencia respiratoria (rpm) — normal 12-20</label>
            <input type="number" placeholder="Ej. 16" {...register('frecuenciaRespiratoria')} style={campoStyle('frecuenciaRespiratoria')} />
            <Aviso campo="frecuenciaRespiratoria" />
          </div>
          <div>
            <label>Saturación de O₂ (%) — normal 95-100</label>
            <input type="number" placeholder="Ej. 98" {...register('saturacionOxigeno')} style={campoStyle('saturacionOxigeno')} />
            <Aviso campo="saturacionOxigeno" />
          </div>
          <div>
            <label>Peso (kg)</label>
            <input type="number" step="0.1" placeholder="Ej. 70.5" {...register('peso')} style={ui.input} />
          </div>
          <div>
            <label>Talla (cm)</label>
            <input type="number" step="0.1" placeholder="Ej. 165" {...register('talla')} style={ui.input} />
          </div>
        </div>

        <label>Prioridad de atención</label>
        <select {...register('prioridad')} style={ui.input}>
          <option value="">Sin clasificar</option>
          {Object.entries(PRIORIDAD_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <label>Notas de enfermería</label>
        <textarea placeholder="Observaciones adicionales del triaje..." {...register('notas')} style={{ ...ui.input, minHeight: 70 }} />

        {saveMutation.isError && (
          <p style={{ color: 'var(--color-critical)' }}>No se pudo guardar el triaje. Verifica los valores ingresados.</p>
        )}

        <button type="submit" disabled={saveMutation.isPending} style={{ ...ui.primaryButton, width: '100%' }}>
          Guardar triaje
        </button>
      </form>
    </Modal>
  );
}
