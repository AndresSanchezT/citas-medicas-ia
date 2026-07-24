import type { CSSProperties } from 'react';

export const card: CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

export const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  borderBottom: '2px solid #e5e4e7',
  background: '#F7F8FA',
  fontSize: 13,
  color: '#555',
};

export const td: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid #eee',
  fontSize: 14,
};

export const input: CSSProperties = {
  width: '100%',
  padding: 8,
  marginTop: 4,
  marginBottom: 12,
  border: '1px solid #ccc',
  borderRadius: 4,
  boxSizing: 'border-box',
};

export const primaryButton: CSSProperties = {
  background: '#2E5FA3',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '0.5rem 1rem',
  cursor: 'pointer',
};

export const secondaryButton: CSSProperties = {
  background: '#fff',
  color: '#2E5FA3',
  border: '1px solid #2E5FA3',
  borderRadius: 4,
  padding: '0.4rem 0.75rem',
  cursor: 'pointer',
  fontSize: 13,
};

export function badgeColor(estado: string): CSSProperties {
  const map: Record<string, string> = {
    PENDIENTE: '#B8860B',
    CONFIRMADA: '#2E5FA3',
    EN_CURSO: '#7A3FA3',
    COMPLETADA: '#3E8E3E',
    CANCELADA: '#999',
    NO_ASISTIO: '#C0392B',
    ESPERANDO: '#B8860B',
    NOTIFICADO: '#2E5FA3',
    ASIGNADO: '#3E8E3E',
    EXPIRADO: '#999',
    LEIDA: '#999',
    ENVIADA: '#3E8E3E',
    DESCARTADA: '#999',
    LEVE: '#3E8E3E',
    MODERADO: '#B8860B',
    URGENTE: '#D2691E',
    CRITICO: '#C0392B',
  };
  const color = map[estado] ?? '#555';
  return {
    color,
    border: `1px solid ${color}`,
    borderRadius: 999,
    padding: '2px 10px',
    fontSize: 12,
    display: 'inline-block',
  };
}
