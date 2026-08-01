import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rescheduleAppointment, type Appointment } from '../api/appointments';
import { fetchDoctors } from '../api/doctors';
import { fetchSlots } from '../api/schedules';
import { Modal } from './Modal';
import * as ui from './ui';

interface ReagendarModalProps {
  appointment: Appointment;
  onClose: () => void;
}

// Derivar solo entre médicos de la MISMA especialidad que el original: reagendar a otra
// especialidad cambiaría el tipo de atención que el paciente pidió, así que no se ofrece.
export function ReagendarModal({ appointment, onClose }: ReagendarModalProps) {
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState(appointment.doctorId);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: slots = [] } = useQuery({
    queryKey: ['available-slots', doctorId],
    queryFn: () => fetchSlots(doctorId),
  });

  const mismaEspecialidad = doctors.filter((d) => d.specialtyId === appointment.doctor.specialtyId);
  const disponibles = slots.filter((s) => s.estado === 'DISPONIBLE');
  // Recuperación: el paciente ya faltó/canceló y está usando su plazo de 24h para
  // reprogramar. Proactivo (Derivar): la cita todavía está vigente y se mueve por una
  // razón operativa (ej. el médico no va a estar disponible).
  const esRecuperacion = appointment.estado === 'CANCELADA' || appointment.estado === 'NO_ASISTIO';

  const mutation = useMutation({
    mutationFn: () => rescheduleAppointment(appointment.id, slotId!, motivo || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      onClose();
    },
  });

  return (
    <Modal
      title={`${esRecuperacion ? 'Reprogramar' : 'Derivar / reagendar'} — ${appointment.patient.nombres} ${appointment.patient.apellidos}`}
      onClose={onClose}
    >
      {esRecuperacion && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
          Esta cita quedó {appointment.estado === 'NO_ASISTIO' ? 'como no-asistida' : 'cancelada'}, pero el pago
          sigue a salvo dentro del plazo de 24 horas: elegí el nuevo horario para reprogramarla.
        </p>
      )}
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Solo se muestran médicos de {appointment.doctor.specialty.nombre} (la misma especialidad de la cita
        original).
      </p>

      <label>Médico</label>
      <select
        value={doctorId}
        onChange={(e) => { setDoctorId(Number(e.target.value)); setSlotId(null); }}
        style={ui.input}
      >
        {mismaEspecialidad.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombres} {d.apellidos} {d.id === appointment.doctorId ? '(médico actual)' : ''}
          </option>
        ))}
      </select>

      <label>Nuevo cupo disponible</label>
      <select value={slotId ?? ''} onChange={(e) => setSlotId(Number(e.target.value))} style={ui.input}>
        <option value="" disabled>
          {disponibles.length ? 'Seleccionar...' : 'Sin cupos disponibles para este médico'}
        </option>
        {disponibles.map((s) => (
          <option key={s.id} value={s.id}>{s.fecha.split('T')[0]} — {s.horaInicio}</option>
        ))}
      </select>

      <label>Motivo de la reprogramación (opcional)</label>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej. El médico no está disponible, el paciente pidió otro horario..."
        style={{ ...ui.input, minHeight: 60 }}
      />
      <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}>
        {esRecuperacion
          ? 'Se crea una cita nueva enlazada a la anterior; el cambio queda registrado con tu usuario y este motivo para auditoría.'
          : 'La cita original queda cancelada y se crea una nueva; el cambio queda registrado con tu usuario y este motivo para auditoría.'}
      </small>

      {mutation.isError && (
        <p style={{ color: 'var(--color-critical)' }}>No se pudo reagendar la cita. Verifica el cupo elegido.</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={onClose}>
          Cancelar
        </button>
        <button
          disabled={!slotId || mutation.isPending}
          onClick={() => mutation.mutate()}
          style={{ ...ui.primaryButton, flex: 1 }}
        >
          Confirmar reprogramación
        </button>
      </div>
    </Modal>
  );
}
