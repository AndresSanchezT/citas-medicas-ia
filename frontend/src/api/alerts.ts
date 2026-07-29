import { apiClient } from './client';

export interface Alert {
  id: number;
  tipo: string;
  destinatarioTipo: string;
  destinatarioId: number;
  referenciaEntidadId: number | null;
  mensaje: string;
  estado: 'PENDIENTE' | 'ENVIADA' | 'LEIDA' | 'DESCARTADA';
  canal: string;
  fechaGeneracion: string;
}

export async function fetchAlerts(filters: { estado?: string; fechaDesde?: string; fechaHasta?: string }): Promise<Alert[]> {
  const { data } = await apiClient.get<Alert[]>('/alerts', { params: filters });
  return data;
}

export async function markAlertAsRead(id: number): Promise<Alert> {
  const { data } = await apiClient.patch<Alert>(`/alerts/${id}/read`);
  return data;
}

export interface AlertsResumen {
  total: number;
  pendientes: number;
  porTipo: { tipo: string; total: number }[];
  porEstado: { estado: string; total: number }[];
}

export async function fetchAlertsResumen(filters: { fechaDesde?: string; fechaHasta?: string }): Promise<AlertsResumen> {
  const { data } = await apiClient.get<AlertsResumen>('/alerts/resumen', { params: filters });
  return data;
}
