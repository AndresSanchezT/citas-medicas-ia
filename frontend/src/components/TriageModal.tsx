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

export function TriageModal({ appointment, onClose }: TriageModalProps) {
  const queryClient = useQueryClient();
  const existing = appointment.triage;

  const { register, handleSubmit } = useForm<TriageForm>({
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

  return (
    <Modal
      title={`Triaje — ${appointment.patient.nombres} ${appointment.patient.apellidos}`}
      onClose={onClose}
      width={520}
    >
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <div>
            <label>Presión sistólica (mmHg)</label>
            <input type="number" {...register('presionSistolica')} style={ui.input} />
          </div>
          <div>
            <label>Presión diastólica (mmHg)</label>
            <input type="number" {...register('presionDiastolica')} style={ui.input} />
          </div>
          <div>
            <label>Frecuencia cardíaca (lpm)</label>
            <input type="number" {...register('frecuenciaCardiaca')} style={ui.input} />
          </div>
          <div>
            <label>Temperatura (°C)</label>
            <input type="number" step="0.1" {...register('temperatura')} style={ui.input} />
          </div>
          <div>
            <label>Frecuencia respiratoria (rpm)</label>
            <input type="number" {...register('frecuenciaRespiratoria')} style={ui.input} />
          </div>
          <div>
            <label>Saturación de O₂ (%)</label>
            <input type="number" {...register('saturacionOxigeno')} style={ui.input} />
          </div>
          <div>
            <label>Peso (kg)</label>
            <input type="number" step="0.1" {...register('peso')} style={ui.input} />
          </div>
          <div>
            <label>Talla (cm)</label>
            <input type="number" step="0.1" {...register('talla')} style={ui.input} />
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
        <textarea {...register('notas')} style={{ ...ui.input, minHeight: 70 }} />

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
