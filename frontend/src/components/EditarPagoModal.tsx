import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePago, type Appointment } from '../api/appointments';
import { Modal } from './Modal';
import * as ui from './ui';

interface EditarPagoModalProps {
  appointment: Appointment;
  onClose: () => void;
}

// Corrige citas guardadas por error sin marcar el pago (o marcado por error). El monto es
// el mismo precio fijo de la especialidad que usa "Nueva cita" — no se edita a mano, para
// no divergir de esa regla de negocio.
export function EditarPagoModal({ appointment, onClose }: EditarPagoModalProps) {
  const queryClient = useQueryClient();
  const [pagado, setPagado] = useState(appointment.pagado);
  const precioEspecialidad = appointment.doctor.specialty?.precioConsulta ?? null;

  const mutation = useMutation({
    mutationFn: () => updatePago(appointment.id, { pagado, monto: pagado ? (precioEspecialidad ?? undefined) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
  });

  const bloqueado = pagado && precioEspecialidad == null;

  return (
    <Modal title="Editar pago de la cita" onClose={onClose} width={380}>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 0 }}>
        Cita de <strong>{appointment.patient.nombres} {appointment.patient.apellidos}</strong> — útil si se guardó por error sin marcar el pago.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: pagado ? 4 : 12 }}>
        <input
          type="checkbox"
          checked={pagado}
          onChange={(e) => setPagado(e.target.checked)}
          style={{ width: 'auto', marginBottom: 0 }}
        />
        El paciente ya pagó la cita
      </label>

      {pagado && (
        <>
          <label>Monto pagado (S/)</label>
          <input
            type="number"
            readOnly
            value={precioEspecialidad ?? ''}
            placeholder="Selecciona una especialidad con precio definido"
            style={{ ...ui.input, background: 'var(--surface-sunken)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
          />
          {precioEspecialidad != null ? (
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: -8, marginBottom: 8 }}>
              Monto automático: precio de consulta de {appointment.doctor.specialty?.nombre} (S/ {precioEspecialidad}). No se puede editar manualmente.
            </small>
          ) : (
            <small style={{ color: 'var(--color-critical)', display: 'block', marginTop: -8, marginBottom: 8 }}>
              Esta especialidad no tiene un precio de consulta definido. Configúralo en "Especialidades" para poder registrar el pago.
            </small>
          )}
        </>
      )}

      {mutation.isError && (
        <p style={{ color: 'var(--color-critical)', fontSize: 12.5 }}>No se pudo actualizar el pago. Intenta de nuevo.</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={bloqueado || mutation.isPending}
          onClick={() => mutation.mutate()}
          style={{ ...ui.primaryButton, flex: 1 }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
