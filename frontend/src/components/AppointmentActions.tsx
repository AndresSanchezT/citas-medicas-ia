import { useState } from 'react';
import type { Appointment } from '../api/appointments';
import type { Usuario } from '../api/auth';
import { TimePickerModal } from './TimePickerModal';
import * as ui from './ui';

export const ESTADO_LABEL: Record<Appointment['estado'], string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada (check-in)',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
  REPROGRAMADA: 'Reprogramada',
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

// Política "reprogramación única con plazo de 24h": aplica a toda cita, pagada o no —
// avisa de antemano si el pago se reembolsa o se pierde (cuando corresponde), y que
// tendrá 24h para reprogramar si es su primera falla (ver AppointmentsService.
// resolverPoliticaFalla en el backend, que aplica la misma regla tanto a cancelaciones
// como a inasistencias).
function confirmarCancelacion(appointment: Appointment): boolean {
  if (!appointment.pagado) {
    return appointment.reprogramacionGratuitaUsada
      ? window.confirm('Esta cita ya usó su única oportunidad de reprogramación. Al cancelarla, ya no podrá reprogramarse de nuevo. ¿Confirmar cancelación?')
      : window.confirm('¿Cancelar esta cita? Al ser su primera falla, tendrá 24 horas para reprogramarla.');
  }
  const monto = appointment.monto != null ? `S/ ${appointment.monto}` : 'el pago';
  const mensaje = appointment.reprogramacionGratuitaUsada
    ? `Esta cita ya usó su única oportunidad. Al cancelarla se PIERDE ${monto} — no se reembolsa ni se puede reprogramar. ¿Confirmar cancelación?`
    : `Esta cita está pagada (${monto}). Es su primera falla, así que el pago SE REEMBOLSA y tendrá 24 horas para reprogramar la siguiente cita. ¿Confirmar cancelación?`;
  return window.confirm(mensaje);
}

// La cita ya cancelada/no-asistida solo puede reprogramarse de nuevo si todavía no había
// usado esa oportunidad y el plazo de 24h no venció — sin importar si estaba pagada (ver
// tieneDerechoARecuperar en el backend).
function puedeRecuperar(appointment: Appointment): boolean {
  return (
    !!appointment.plazoReprogramacionHasta &&
    new Date(appointment.plazoReprogramacionHasta).getTime() >= Date.now()
  );
}

interface AppointmentActionsProps {
  appointment: Appointment;
  rol: Usuario['rol'];
  busy: boolean;
  onCheckIn: (id: number) => void;
  onStart: (id: number, hora?: string) => void;
  onComplete: (id: number, hora?: string) => void;
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
  // El médico asigna la hora real de inicio/fin de la consulta en vez de que el sistema
  // le imponga "ahora mismo" (ver TimePickerModal); acá se guarda cuál de las dos
  // acciones está pendiente de que elija la hora.
  const [horaPendiente, setHoraPendiente] = useState<'start' | 'complete' | null>(null);

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
        {puedeAtender && btn('Iniciar consulta', () => setHoraPendiente('start'))}
        {puedeCancelarONoShow && btn('No-asistió', () => onNoShow(appointment.id), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => { if (confirmarCancelacion(appointment)) onCancel(appointment.id); }, 'var(--text-muted)')}
        {horaPendiente === 'start' && (
          <TimePickerModal
            title="Iniciar consulta"
            descripcion="Confirma la hora real en que empieza a atender al paciente."
            busy={busy}
            onClose={() => setHoraPendiente(null)}
            onConfirm={(iso) => { onStart(appointment.id, iso); setHoraPendiente(null); }}
          />
        )}
      </>
    );
  }
  if (appointment.estado === 'EN_CURSO') {
    if (!puedeAtender) return <span style={{ color: 'var(--text-muted)' }}>En curso</span>;
    return (
      <>
        {btn('Completar', () => setHoraPendiente('complete'), 'var(--color-good)')}
        {horaPendiente === 'complete' && (
          <TimePickerModal
            title="Completar consulta"
            descripcion="Confirma la hora real en que terminó de atender al paciente."
            busy={busy}
            onClose={() => setHoraPendiente(null)}
            onConfirm={(iso) => { onComplete(appointment.id, iso); setHoraPendiente(null); }}
          />
        )}
      </>
    );
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
  if (appointment.estado === 'REPROGRAMADA') {
    return <span style={{ color: 'var(--text-muted)' }}>Esta cita ya fue reprogramada</span>;
  }
  return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}
