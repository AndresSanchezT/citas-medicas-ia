import type { CSSProperties } from 'react';

export const card: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
};

export const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.7rem 1rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-sunken)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

export const td: CSSProperties = {
  padding: '0.7rem 1rem',
  borderBottom: '1px solid var(--border)',
  fontSize: 14,
  color: 'var(--text)',
};

export const input: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  marginTop: 4,
  marginBottom: 12,
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontSize: 14,
  color: 'var(--text)',
  background: 'var(--surface)',
};

export const primaryButton: CSSProperties = {
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '0.55rem 1.1rem',
  fontSize: 14,
  fontWeight: 600,
  boxShadow: 'var(--shadow-sm)',
};

export const secondaryButton: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--color-primary)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.4rem 0.8rem',
  fontSize: 13,
  fontWeight: 500,
};

interface StatusTone {
  fg: string;
  bg: string;
}

// Paleta de estado fija (independiente del color de marca): cada estado del
// dominio se agrupa por su significado real, no por la entidad a la que
// pertenece, para que "Completada", "Asignado" y "Leve" —conceptualmente
// equivalentes— siempre lean con el mismo tono.
const STATUS_TONES: Record<string, StatusTone> = {
  good: { fg: 'var(--color-good)', bg: 'var(--color-good-tint)' },
  warning: { fg: 'var(--color-warning)', bg: 'var(--color-warning-tint)' },
  serious: { fg: 'var(--color-serious)', bg: 'var(--color-serious-tint)' },
  critical: { fg: 'var(--color-critical)', bg: 'var(--color-critical-tint)' },
  info: { fg: 'var(--color-primary-dark)', bg: 'var(--color-primary-tint)' },
  neutral: { fg: 'var(--color-neutral)', bg: 'var(--color-neutral-tint)' },
};

const STATUS_MAP: Record<string, keyof typeof STATUS_TONES> = {
  // Citas
  PENDIENTE: 'warning',
  CONFIRMADA: 'info',
  EN_CURSO: 'info',
  COMPLETADA: 'good',
  CANCELADA: 'neutral',
  NO_ASISTIO: 'critical',
  // Lista de espera
  ESPERANDO: 'warning',
  NOTIFICADO: 'info',
  ASIGNADO: 'good',
  EXPIRADO: 'neutral',
  // Alertas
  LEIDA: 'neutral',
  ENVIADA: 'good',
  DESCARTADA: 'neutral',
  // Triaje
  LEVE: 'good',
  MODERADO: 'warning',
  URGENTE: 'serious',
  CRITICO: 'critical',
  // Resumen de evolución del triaje
  mejora: 'good',
  empeora: 'critical',
  estable: 'neutral',
};

export function badgeColor(estado: string): CSSProperties {
  const tone = STATUS_TONES[STATUS_MAP[estado] ?? 'neutral'];
  return {
    color: tone.fg,
    background: tone.bg,
    borderRadius: 999,
    padding: '3px 11px',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-block',
    lineHeight: 1.4,
  };
}
