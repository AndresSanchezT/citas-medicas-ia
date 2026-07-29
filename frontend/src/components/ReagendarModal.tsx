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

  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: slots = [] } = useQuery({
    queryKey: ['available-slots', doctorId],
    queryFn: () => fetchSlots(doctorId),
  });

  const mismaEspecialidad = doctors.filter((d) => d.specialtyId === appointment.doctor.specialtyId);
  const disponibles = slots.filter((s) => s.estado === 'DISPONIBLE');

  const mutation = useMutation({
    mutationFn: () => rescheduleAppointment(appointment.id, slotId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      onClose();
    },
  });

  return (
    <Modal
      title={`Derivar / reagendar — ${appointment.patient.nombres} ${appointment.patient.apellidos}`}
      onClose={onClose}
    >
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
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
