import { apiClient } from './client';

export interface DashboardPoint {
  periodo: string;
  totalCitasCompletadas: number;
  totalNoShow: number;
  tiempoEsperaPromedioMinutos: number | null;
  porcentajeNoShow: number;
}

export interface OccupancyPoint {
  franjaHoraria: string;
  totalPacientes: number;
}

export interface DoctorRankingItem {
  doctorId: number;
  nombre: string;
  especialidad: string;
  totalPacientesAtendidos: number;
}

export async function getDashboard(period: 'month' | 'quarter' | 'year'): Promise<DashboardPoint[]> {
  const { data } = await apiClient.get<DashboardPoint[]>('/reports/dashboard', { params: { period } });
  return data;
}

export async function getScheduleOccupancy(): Promise<OccupancyPoint[]> {
  const { data } = await apiClient.get<OccupancyPoint[]>('/reports/schedule-occupancy');
  return data;
}

export async function getDoctorRanking(): Promise<DoctorRankingItem[]> {
  const { data } = await apiClient.get<DoctorRankingItem[]>('/reports/doctor-ranking');
  return data;
}
