import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createTimeOff, deleteTimeOff, fetchTimeOffByDoctor, type CreateTimeOffResult } from '../api/schedules';
import type { Doctor } from '../api/doctors';
import { Modal } from './Modal';
import * as ui from './ui';

interface TimeOffForm {
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
}

interface DoctorTimeOffModalProps {
  doctor: Doctor;
  onClose: () => void;
}

export function DoctorTimeOffModal({ doctor, onClose }: DoctorTimeOffModalProps) {
  const queryClient = useQueryClient();
  const [conflictos, setConflictos] = useState<CreateTimeOffResult['citasEnConflicto']>([]);

  const { data: timeOffs = [], isLoading } = useQuery({
    queryKey: ['time-off', doctor.id],
    queryFn: () => fetchTimeOffByDoctor(doctor.id),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TimeOffForm>();

  const createMutation = useMutation({
    mutationFn: (values: TimeOffForm) => createTimeOff({ ...values, doctorId: doctor.id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['time-off', doctor.id] });
      setConflictos(result.citasEnConflicto);
      reset({ fechaInicio: '', fechaFin: '', motivo: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimeOff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-off', doctor.id] }),
  });

  return (
    <Modal title={`Descansos y vacaciones — ${doctor.nombres} ${doctor.apellidos}`} onClose={onClose} width={640}>
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <div>
          <label>Desde</label>
          <input type="date" {...register('fechaInicio', { required: true })} style={{ ...ui.input, width: 160 }} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" {...register('fechaFin', { required: true })} style={{ ...ui.input, width: 160 }} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Motivo (opcional)</label>
          <input placeholder="Vacaciones, descanso médico..." {...register('motivo')} style={ui.input} />
        </div>
        <button type="submit" disabled={createMutation.isPending} style={{ ...ui.primaryButton, marginBottom: '1rem' }}>
          Agregar
        </button>
      </form>
      {(errors.fechaInicio || errors.fechaFin) && (
        <small style={{ color: 'var(--color-critical)' }}>Debes indicar fecha de inicio y fin.</small>
      )}
      {createMutation.isError && (
        <p style={{ color: 'var(--color-critical)' }}>No se pudo registrar el descanso. Verifica las fechas.</p>
      )}

      {conflictos.length > 0 && (
        <div style={{ background: 'var(--color-warning-tint)', border: '1px solid var(--color-warning)', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <strong>Atención:</strong> hay {conflictos.length} cita(s) ya agendada(s) en ese rango que deben reprogramarse o cancelarse manualmente:
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {conflictos.map((c) => (
              <li key={c.id}>
                {c.fecha.split('T')[0]} {c.horaInicio} — {c.patient.nombres} {c.patient.apellidos}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table style={ui.table}>
        <thead>
          <tr>
            <th style={ui.th}>Desde</th>
            <th style={ui.th}>Hasta</th>
            <th style={ui.th}>Motivo</th>
            <th style={ui.th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td style={ui.td} colSpan={4}>Cargando...</td></tr>
          )}
          {!isLoading && timeOffs.length === 0 && (
            <tr><td style={ui.td} colSpan={4}>Sin descansos ni vacaciones registrados.</td></tr>
          )}
          {timeOffs.map((t) => (
            <tr key={t.id}>
              <td style={ui.td}>{t.fechaInicio.split('T')[0]}</td>
              <td style={ui.td}>{t.fechaFin.split('T')[0]}</td>
              <td style={ui.td}>{t.motivo ?? '—'}</td>
              <td style={ui.td}>
                <button
                  style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(t.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
