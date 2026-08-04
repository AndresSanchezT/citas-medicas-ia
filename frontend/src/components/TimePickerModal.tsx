import { useState } from 'react';
import { Modal } from './Modal';
import * as ui from './ui';

interface TimePickerModalProps {
  title: string;
  descripcion: string;
  onConfirm: (isoDateTime: string) => void;
  onClose: () => void;
  busy?: boolean;
}

// Formatea "ahora" al formato que espera <input type="datetime-local"> (sin segundos,
// en hora local del navegador, no UTC).
function nowForInput(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

// El médico puede ajustar la hora real de inicio/fin de la consulta en vez de que el
// sistema le imponga "ahora mismo" — por defecto ya viene con la hora actual.
export function TimePickerModal({ title, descripcion, onConfirm, onClose, busy }: TimePickerModalProps) {
  const [valor, setValor] = useState(nowForInput());

  return (
    <Modal title={title} onClose={onClose} width={380}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 12 }}>{descripcion}</p>
      <label>Hora</label>
      <input
        type="datetime-local"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        style={ui.input}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !valor}
          style={{ ...ui.primaryButton, flex: 1 }}
          onClick={() => onConfirm(new Date(valor).toISOString())}
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
