import type { Appointment } from '../api/appointments';
import type { Usuario } from '../api/auth';
import * as ui from './ui';

export const ESTADO_LABEL: Record<Appointment['estado'], string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada (check-in)',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export const PRIORIDAD_LABEL: Record<string, string> = {
  LEVE: 'Leve',
  MODERADO: 'Moderado',
  URGENTE: 'Urgente',
  CRITICO: 'Crítico',
};

// Debe reflejar los mismos @Roles() del backend (appointments.controller.ts):
// check-in es tarea exclusiva de recepción; iniciar/completar consulta, del médico;
// cancelar y marcar no-asistió los puede hacer recepción o el propio médico de la cita.
const PUEDE_RECEPCIONAR: Usuario['rol'][] = ['ADMIN', 'RECEPCIONISTA'];
const PUEDE_ATENDER: Usuario['rol'][] = ['ADMIN', 'MEDICO'];
const PUEDE_CANCELAR_O_NOSHOW: Usuario['rol'][] = ['ADMIN', 'RECEPCIONISTA', 'MEDICO'];

interface AppointmentActionsProps {
  appointment: Appointment;
  rol: Usuario['rol'];
  busy: boolean;
  onCheckIn: (id: number) => void;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onCancel: (id: number) => void;
  onNoShow: (id: number) => void;
  onTriage?: (appointment: Appointment) => void;
}

export function AppointmentActions({
  appointment,
  rol,
  busy,
  onCheckIn,
  onStart,
  onComplete,
  onCancel,
  onNoShow,
  onTriage,
}: AppointmentActionsProps) {
  const puedeRecepcionar = PUEDE_RECEPCIONAR.includes(rol);
  const puedeAtender = PUEDE_ATENDER.includes(rol);
  const puedeCancelarONoShow = PUEDE_CANCELAR_O_NOSHOW.includes(rol);

  const btn = (label: string, onClick: () => void, color?: string) => (
    <button
      disabled={busy}
      onClick={onClick}
      style={{ ...ui.secondaryButton, marginRight: 6, ...(color ? { color, borderColor: color } : {}) }}
    >
      {label}
    </button>
  );

  if (appointment.estado === 'PENDIENTE') {
    if (!puedeRecepcionar && !puedeCancelarONoShow) {
      return <span style={{ color: 'var(--text-muted)' }}>Pendiente de check-in en recepción</span>;
    }
    return (
      <>
        {puedeRecepcionar && btn('Check-in', () => onCheckIn(appointment.id))}
        {puedeCancelarONoShow && btn('No-asistió', () => onNoShow(appointment.id), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => onCancel(appointment.id), 'var(--text-muted)')}
      </>
    );
  }
  if (appointment.estado === 'CONFIRMADA') {
    return (
      <>
        {puedeRecepcionar && onTriage &&
          btn(appointment.triage ? 'Editar triaje' : 'Triaje', () => onTriage(appointment), 'var(--color-violet)')}
        {puedeAtender && btn('Iniciar consulta', () => onStart(appointment.id))}
        {puedeCancelarONoShow && btn('No-asistió', () => onNoShow(appointment.id), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => onCancel(appointment.id), 'var(--text-muted)')}
      </>
    );
  }
  if (appointment.estado === 'EN_CURSO') {
    if (!puedeAtender) return <span style={{ color: 'var(--text-muted)' }}>En curso</span>;
    return btn('Completar', () => onComplete(appointment.id), 'var(--color-good)');
  }
  return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}
