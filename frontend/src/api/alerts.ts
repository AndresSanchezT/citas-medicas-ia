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

export async function fetchAlerts(estado?: string): Promise<Alert[]> {
  const { data } = await apiClient.get<Alert[]>('/alerts', { params: { estado } });
  return data;
}

export async function markAlertAsRead(id: number): Promise<Alert> {
  const { data } = await apiClient.patch<Alert>(`/alerts/${id}/read`);
  return data;
}
