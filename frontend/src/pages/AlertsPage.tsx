import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlerts, fetchAlertsResumen, markAlertAsRead } from '../api/alerts';
import * as ui from '../components/ui';

const TIPO_LABEL: Record<string, string> = {
  RECORDATORIO_CITA: 'Recordatorio de cita',
  SOBRECARGA_AGENDA: 'Sobrecarga de agenda',
  INASISTENCIA_FRECUENTE: 'Inasistencia frecuente',
  LISTA_ESPERA_LARGA: 'Lista de espera larga',
  SLOT_LIBRE_DISPONIBLE: 'Cupo disponible',
};

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const filtros = { estado: estado || undefined, fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined };

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', estado, fechaDesde, fechaHasta],
    queryFn: () => fetchAlerts(filtros),
  });

  const { data: resumen } = useQuery({
    queryKey: ['alerts-resumen', fechaDesde, fechaHasta],
    queryFn: () => fetchAlertsResumen({ fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined }),
  });

  const markReadMutation = useMutation({
    mutationFn: markAlertAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-resumen'] });
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
        <h1>Alertas</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Desde
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 160 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Hasta
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 160 }} />
          </label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
            <option value="">Todas</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="LEIDA">Leídas</option>
          </select>
        </div>
      </div>

      {resumen && resumen.total > 0 && (
        <div style={{ ...ui.card, padding: '0.9rem 1.1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: 20 }}>{resumen.total}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginLeft: 6 }}>alertas en el período</span>
            </div>
            <div>
              <strong style={{ fontSize: 20, color: 'var(--color-warning)' }}>{resumen.pendientes}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginLeft: 6 }}>pendientes</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {resumen.porTipo.map((t) => (
                <span
                  key={t.tipo}
                  style={{
                    color: 'var(--color-primary-dark)',
                    background: 'var(--color-primary-tint)',
                    borderRadius: 999,
                    padding: '3px 11px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {TIPO_LABEL[t.tipo] ?? t.tipo}: {t.total}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Tipo</th>
              <th style={ui.th}>Mensaje</th>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={ui.td} colSpan={5}>Cargando...</td></tr>}
            {!isLoading && alerts.length === 0 && (
              <tr><td style={ui.td} colSpan={5}>Sin alertas.</td></tr>
            )}
            {alerts.map((a) => (
              <tr key={a.id}>
                <td style={ui.td}>{TIPO_LABEL[a.tipo] ?? a.tipo}</td>
                <td style={ui.td}>{a.mensaje}</td>
                <td style={ui.td}>{new Date(a.fechaGeneracion).toLocaleString()}</td>
                <td style={ui.td}><span style={ui.badgeColor(a.estado)}>{a.estado}</span></td>
                <td style={ui.td}>
                  {a.estado === 'PENDIENTE' && (
                    <button style={ui.secondaryButton} onClick={() => markReadMutation.mutate(a.id)}>
                      Marcar como leída
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
