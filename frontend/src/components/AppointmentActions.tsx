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

// Política "reprogramación única con plazo de 24h": avisa de antemano si el pago se
// reembolsa o se pierde, y que tendrá 24h para reprogramar si corresponde (ver
// AppointmentsService.resolverPoliticaFalla en el backend, que aplica la misma regla
// tanto a cancelaciones como a inasistencias).
function confirmarCancelacion(appointment: Appointment): boolean {
  if (!appointment.pagado) {
    return window.confirm('¿Cancelar esta cita?');
  }
  const monto = appointment.monto != null ? `S/ ${appointment.monto}` : 'el pago';
  const mensaje = appointment.reprogramacionGratuitaUsada
    ? `Esta cita ya usó su única oportunidad. Al cancelarla se PIERDE ${monto} — no se reembolsa ni se puede reprogramar. ¿Confirmar cancelación?`
    : `Esta cita está pagada (${monto}). Es su primera falla, así que el pago SE REEMBOLSA y tendrá 24 horas para reprogramar la siguiente cita. ¿Confirmar cancelación?`;
  return window.confirm(mensaje);
}

// La cita ya cancelada/no-asistida solo puede reprogramarse de nuevo si esa falla le dejó
// el pago a salvo y el plazo de 24h todavía no venció (ver tieneDerechoARecuperar backend).
function puedeRecuperar(appointment: Appointment): boolean {
  return (
    appointment.reembolso === 'REEMBOLSADO' &&
    !!appointment.plazoReprogramacionHasta &&
    new Date(appointment.plazoReprogramacionHasta).getTime() >= Date.now()
  );
}

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
  onReschedule?: (appointment: Appointment) => void;
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
  onReschedule,
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
        {puedeRecepcionar && onReschedule && btn('Derivar', () => onReschedule(appointment), 'var(--color-primary)')}
        {puedeCancelarONoShow && btn('No-asistió', () => onNoShow(appointment.id), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => { if (confirmarCancelacion(appointment)) onCancel(appointment.id); }, 'var(--text-muted)')}
      </>
    );
  }
  if (appointment.estado === 'CONFIRMADA') {
    return (
      <>
        {puedeRecepcionar && onTriage &&
          btn(appointment.triage ? 'Editar triaje' : 'Triaje', () => onTriage(appointment), 'var(--color-violet)')}
        {puedeRecepcionar && onReschedule && btn('Derivar', () => onReschedule(appointment), 'var(--color-primary)')}
        {puedeAtender && btn('Iniciar consulta', () => onStart(appointment.id))}
        {puedeCancelarONoShow && btn('No-asistió', () => onNoShow(appointment.id), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => { if (confirmarCancelacion(appointment)) onCancel(appointment.id); }, 'var(--text-muted)')}
      </>
    );
  }
  if (appointment.estado === 'EN_CURSO') {
    if (!puedeAtender) return <span style={{ color: 'var(--text-muted)' }}>En curso</span>;
    return btn('Completar', () => onComplete(appointment.id), 'var(--color-good)');
  }
  if ((appointment.estado === 'CANCELADA' || appointment.estado === 'NO_ASISTIO') && puedeRecuperar(appointment)) {
    if (!puedeRecepcionar || !onReschedule) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const plazo = new Date(appointment.plazoReprogramacionHasta!);
    return (
      <div>
        {btn('Reprogramar', () => onReschedule(appointment), 'var(--color-primary)')}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Plazo hasta {plazo.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    );
  }
  return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}
