import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAppointments } from '../api/appointments';
import { useAuth } from '../context/AuthContext';
import { AppointmentActions, ESTADO_LABEL } from '../components/AppointmentActions';
import { useAppointmentMutations } from '../hooks/useAppointmentMutations';
import * as ui from '../components/ui';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function MyAgendaPage() {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(todayISO());
  const doctorId = usuario?.doctorId ?? undefined;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'mi-agenda', doctorId, fecha],
    queryFn: () => fetchAppointments({ doctorId, fecha }),
    enabled: !!doctorId,
  });

  const appointmentActions = useAppointmentMutations(['appointments', 'mi-agenda', doctorId, fecha]);

  function shiftDay(delta: number) {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    setFecha(d.toISOString().split('T')[0]);
  }

  if (!doctorId) {
    return (
      <div>
        <h1>Mi agenda</h1>
        <p>Esta cuenta no está vinculada a un médico, así que no hay una agenda que mostrar.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Mi agenda</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', alignItems: 'center' }}>
        <button style={ui.secondaryButton} onClick={() => shiftDay(-1)}>← Día anterior</button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ ...ui.input, marginBottom: 0, width: 180 }}
        />
        <button style={ui.secondaryButton} onClick={() => shiftDay(1)}>Día siguiente →</button>
        <button style={ui.secondaryButton} onClick={() => setFecha(todayISO())}>Hoy</button>
      </div>

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Hora</th>
              <th style={ui.th}>Paciente</th>
              <th style={ui.th}>Motivo</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={ui.td} colSpan={5}>Cargando...</td></tr>
            )}
            {!isLoading && appointments.length === 0 && (
              <tr><td style={ui.td} colSpan={5}>Sin citas programadas para este día.</td></tr>
            )}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td style={ui.td}>{a.horaInicio}</td>
                <td style={ui.td}>{a.patient?.nombres} {a.patient?.apellidos}</td>
                <td style={ui.td}>{a.motivoConsulta ?? '—'}</td>
                <td style={ui.td}><span style={ui.badgeColor(a.estado)}>{ESTADO_LABEL[a.estado]}</span></td>
                <td style={ui.td}><AppointmentActions appointment={a} rol={usuario!.rol} {...appointmentActions} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
