import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { upsertTriage, type Appointment, type Triage, type TriagePrioridad } from '../api/appointments';
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

function formatHora(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function TriageModal({ appointment, onClose }: TriageModalProps) {
  const queryClient = useQueryClient();
  const existing = appointment.triage;

  // "Iniciar triaje" marca el momento en que empieza a tomarse los signos vitales; el fin
  // lo pone el servidor al Guardar, así la duración no depende del reloj del navegador.
  const [inicioTriaje, setInicioTriaje] = useState<string | null>(existing?.inicioTriajeEn ?? null);
  // Al guardar, el modal ya no se cierra solo: se queda mostrando la confirmación y la
  // hora de inicio/fin reales que devolvió el servidor, hasta que el usuario lo cierre.
  const [guardado, setGuardado] = useState<Triage | null>(null);

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
        inicioTriajeEn: inicioTriaje ?? undefined,
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
    onSuccess: (triage) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setGuardado(triage);
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
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', marginBottom: 14,
        }}
      >
        {inicioTriaje ? (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Triaje iniciado a las {new Date(inicioTriaje).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no se marcó el inicio del triaje.</span>
        )}
        <button
          type="button"
          disabled={!!inicioTriaje}
          onClick={() => setInicioTriaje(new Date().toISOString())}
          style={{ ...ui.secondaryButton, ...(inicioTriaje ? { opacity: 0.5 } : {}) }}
        >
          {inicioTriaje ? '✓ Iniciado' : 'Iniciar triaje'}
        </button>
      </div>
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

        {guardado && (
          <div
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--color-good-tint)',
              borderRadius: 'var(--radius-md)', padding: '0.7rem 0.9rem', marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'var(--color-good)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
              }}
            >
              ✓
            </div>
            <span style={{ fontSize: 13.5, color: 'var(--color-good)', fontWeight: 600 }}>Se terminó el triaje.</span>
          </div>
        )}

        <div
          style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12,
          }}
        >
          <span>Hora inicio: {formatHora(guardado?.inicioTriajeEn ?? existing?.inicioTriajeEn ?? inicioTriaje)}</span>
          <span>Hora fin: {formatHora(guardado?.finTriajeEn ?? existing?.finTriajeEn)}</span>
        </div>

        {guardado ? (
          <button type="button" onClick={onClose} style={{ ...ui.primaryButton, width: '100%' }}>
            Cerrar
          </button>
        ) : (
          <button type="submit" disabled={saveMutation.isPending} style={{ ...ui.primaryButton, width: '100%' }}>
            Guardar triaje
          </button>
        )}
      </form>
    </Modal>
  );
}
