import { useState } from 'react';
import type { Appointment } from '../api/appointments';
import type { Usuario } from '../api/auth';
import { ConfirmarFallaModal } from './ConfirmarFallaModal';
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
  // Cancelar y No-asistió cambian el pago/la posibilidad de reprogramar, así que antes de
  // ejecutarlos se pide confirmación en un modal propio (ConfirmarFallaModal) en vez del
  // window.confirm() nativo, que no se puede estilizar.
  const [confirmacionPendiente, setConfirmacionPendiente] = useState<'cancelar' | 'no-asistio' | null>(null);

  const confirmacionModal = confirmacionPendiente && (
    <ConfirmarFallaModal
      appointment={appointment}
      accion={confirmacionPendiente}
      busy={busy}
      onClose={() => setConfirmacionPendiente(null)}
      onConfirm={() => {
        if (confirmacionPendiente === 'cancelar') onCancel(appointment.id);
        else onNoShow(appointment.id);
        setConfirmacionPendiente(null);
      }}
    />
  );

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
        {puedeCancelarONoShow && btn('No-asistió', () => setConfirmacionPendiente('no-asistio'), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => setConfirmacionPendiente('cancelar'), 'var(--text-muted)')}
        {confirmacionModal}
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
        {puedeCancelarONoShow && btn('No-asistió', () => setConfirmacionPendiente('no-asistio'), 'var(--color-critical)')}
        {puedeCancelarONoShow && btn('Cancelar', () => setConfirmacionPendiente('cancelar'), 'var(--text-muted)')}
        {horaPendiente === 'start' && (
          <TimePickerModal
            title="Iniciar consulta"
            descripcion="Confirma la hora real en que empieza a atender al paciente."
            busy={busy}
            onClose={() => setHoraPendiente(null)}
            onConfirm={(iso) => { onStart(appointment.id, iso); setHoraPendiente(null); }}
          />
        )}
        {confirmacionModal}
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
