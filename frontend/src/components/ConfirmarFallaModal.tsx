import type { Appointment } from '../api/appointments';
import { Modal } from './Modal';
import * as ui from './ui';

interface ConfirmarFallaModalProps {
  appointment: Appointment;
  accion: 'cancelar' | 'no-asistio';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Reemplaza los window.confirm() que se usaban para "Cancelar" y "No-asistió" (sin ningún
// estilo posible) por un modal propio, con el mismo lenguaje visual que ResultadoPoliticaModal
// (ícono y color según la consecuencia) — pero como pregunta, antes de ejecutar la acción, no
// como aviso después. Predice el resultado con la misma regla que aplica el backend
// (AppointmentsService.resolverPoliticaFalla): primera falla de una cita pagada reembolsa y
// abre 24h para reprogramar; segunda falla pierde el pago; sin pago, solo cambia si hay o no
// derecho a reprogramar.
export function ConfirmarFallaModal({ appointment, accion, busy, onConfirm, onClose }: ConfirmarFallaModalProps) {
  const monto = appointment.monto != null ? `S/ ${appointment.monto.toFixed(2)}` : 'el pago';
  const esPrimeraFalla = !appointment.reprogramacionGratuitaUsada;

  let tono: 'good' | 'critical' | 'neutral';
  let titulo: string;
  let detalle: string;

  if (!appointment.pagado) {
    if (esPrimeraFalla) {
      tono = 'good';
      titulo = 'Podrá reprogramarse dentro de 24 horas';
      detalle = 'Esta cita no tiene pago registrado. Al ser su primera falla, se abrirá una ventana de 24 horas para reprogramarla sin costo.';
    } else {
      tono = 'neutral';
      titulo = 'Ya no podrá reprogramarse';
      detalle = 'Esta cita ya había usado su única oportunidad de reprogramación anterior.';
    }
  } else if (esPrimeraFalla) {
    tono = 'good';
    titulo = `${monto} queda a salvo`;
    detalle = 'Es la primera falla de esta cita pagada: el pago se reembolsa y tendrá 24 horas para reprogramar sin costo.';
  } else {
    tono = 'critical';
    titulo = `Se pierde ${monto}`;
    detalle = 'Esta cita ya había usado su única oportunidad de reprogramación gratuita — no corresponde reembolso ni una nueva recuperación.';
  }

  const colores = {
    good: { fg: 'var(--color-good)', bg: 'var(--color-good-tint)' },
    critical: { fg: 'var(--color-critical)', bg: 'var(--color-critical-tint)' },
    neutral: { fg: 'var(--color-neutral)', bg: 'var(--color-neutral-tint)' },
  }[tono];

  const esCancelar = accion === 'cancelar';
  const nombrePaciente = `${appointment.patient.nombres} ${appointment.patient.apellidos}`;

  return (
    <Modal title={esCancelar ? '¿Cancelar esta cita?' : '¿Confirmar que el paciente no asistió?'} onClose={onClose} width={420}>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 14 }}>
        {esCancelar
          ? <>Vas a cancelar la cita de <strong>{nombrePaciente}</strong>.</>
          : <>Vas a marcar como no asistida la cita de <strong>{nombrePaciente}</strong>.</>}
      </p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          background: colores.bg,
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: colores.fg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700,
          }}
        >
          {tono === 'good' ? '✓' : tono === 'critical' ? '!' : 'i'}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: colores.fg, marginBottom: 4 }}>{titulo}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{detalle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={onClose}>
          Volver
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={{ ...ui.primaryButton, flex: 1, background: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
        >
          {esCancelar ? 'Confirmar cancelación' : 'Confirmar no-asistió'}
        </button>
      </div>
    </Modal>
  );
}
