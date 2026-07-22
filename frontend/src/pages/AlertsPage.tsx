import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlerts, markAlertAsRead } from '../api/alerts';
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

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', estado],
    queryFn: () => fetchAlerts(estado || undefined),
  });

  const markReadMutation = useMutation({
    mutationFn: markAlertAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Alertas</h1>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 220 }}>
          <option value="">Todas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="LEIDA">Leídas</option>
        </select>
      </div>

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
