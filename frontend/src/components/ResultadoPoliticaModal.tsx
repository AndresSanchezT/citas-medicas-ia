import type { Appointment } from '../api/appointments';
import { Modal } from './Modal';
import * as ui from './ui';

interface ResultadoPoliticaModalProps {
  appointment: Appointment;
  onClose: () => void;
}

// Reemplaza el window.alert() plano que se mostraba tras marcar "No-asistió": un modal
// con el mismo tono visual que el resto del sistema (icono, color según el resultado),
// para que recepción vea de un vistazo si el pago se reembolsó o se perdió.
export function ResultadoPoliticaModal({ appointment, onClose }: ResultadoPoliticaModalProps) {
  const monto = appointment.monto != null ? `S/ ${appointment.monto.toFixed(2)}` : 'el pago';
  const seReembolsa = appointment.reembolso === 'REEMBOLSADO';
  const sePierde = appointment.reembolso === 'PERDIDO';
  const plazo = appointment.plazoReprogramacionHasta
    ? new Date(appointment.plazoReprogramacionHasta).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  const tono = seReembolsa ? 'good' : sePierde ? 'critical' : 'neutral';
  const colores = {
    good: { fg: 'var(--color-good)', bg: 'var(--color-good-tint)' },
    critical: { fg: 'var(--color-critical)', bg: 'var(--color-critical-tint)' },
    neutral: { fg: 'var(--color-neutral)', bg: 'var(--color-neutral-tint)' },
  }[tono];

  return (
    <Modal title="Paciente marcado como no asistió" onClose={onClose} width={420}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          background: colores.bg,
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem 1rem',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: colores.fg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700,
          }}
        >
          {seReembolsa ? '✓' : sePierde ? '!' : 'i'}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: colores.fg, marginBottom: 4 }}>
            {seReembolsa && `${monto} queda a salvo`}
            {sePierde && `Se perdió ${monto}`}
            {!seReembolsa && !sePierde && 'Esta cita no tenía pago registrado'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {seReembolsa && plazo && (
              <>El paciente tiene hasta el <strong>{plazo}</strong> (24 horas) para reprogramar sin costo.</>
            )}
            {sePierde && 'Ya había usado su única oportunidad de reprogramación gratuita; no corresponde reembolso ni una nueva cita de recuperación.'}
          </div>
        </div>
      </div>

      <button style={{ ...ui.primaryButton, width: '100%' }} onClick={onClose}>
        Entendido
      </button>
    </Modal>
  );
}
