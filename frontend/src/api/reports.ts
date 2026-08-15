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
  especialidad: string;
  totalPacientes: number;
}

export interface OccupancyWeeklyPoint {
  semana: string;
  especialidad: string;
  totalPacientes: number;
}

export interface ScheduleOccupancyReport {
  porHora: OccupancyPoint[];
  porSemana: OccupancyWeeklyPoint[];
}

export interface DoctorRankingItem {
  doctorId: number;
  nombre: string;
  especialidad: string;
  totalPacientesAtendidos: number;
}

export interface WaitTimeWeeklyPoint {
  semana: string;
  especialidad: string;
  tiempoEsperaPromedioMinutos: number;
}

export async function getDashboard(period: 'week' | 'month' | 'quarter' | 'year'): Promise<DashboardPoint[]> {
  const { data } = await apiClient.get<DashboardPoint[]>('/reports/dashboard', { params: { period } });
  return data;
}

export async function getScheduleOccupancy(): Promise<ScheduleOccupancyReport> {
  const { data } = await apiClient.get<ScheduleOccupancyReport>('/reports/schedule-occupancy');
  return data;
}

export async function getDoctorRanking(): Promise<DoctorRankingItem[]> {
  const { data } = await apiClient.get<DoctorRankingItem[]>('/reports/doctor-ranking');
  return data;
}

export async function getWaitTimeWeekly(): Promise<WaitTimeWeeklyPoint[]> {
  const { data } = await apiClient.get<WaitTimeWeeklyPoint[]>('/reports/wait-time-weekly');
  return data;
}

export interface RetencionIngresos {
  montoRetenido: number;
  montoReembolsado: number;
  citasConDineroPerdido: number;
  citasReembolsadas: number;
}

export async function getRetencionIngresos(): Promise<RetencionIngresos> {
  const { data } = await apiClient.get<RetencionIngresos>('/reports/retencion-ingresos');
  return data;
}

export interface CostoPorEspecialidad {
  especialidad: string;
  totalCitas: number;
  ingresoTotal: number;
}

export async function getCostosPorEspecialidad(): Promise<CostoPorEspecialidad[]> {
  const { data } = await apiClient.get<CostoPorEspecialidad[]>('/reports/costos-por-especialidad');
  return data;
}

export interface CitaConcurrida {
  dia: string;
  franjaHoraria: string;
  totalCitas: number;
}

export async function getCitasMasConcurridas(): Promise<CitaConcurrida[]> {
  const { data } = await apiClient.get<CitaConcurrida[]>('/reports/citas-mas-concurridas');
  return data;
}

export interface CitaPorEspecialidad {
  especialidad: string;
  totalCitas: number;
}

export async function getCitasPorEspecialidad(): Promise<CitaPorEspecialidad[]> {
  const { data } = await apiClient.get<CitaPorEspecialidad[]>('/reports/citas-por-especialidad');
  return data;
}

export interface TiempoConsultaPorEspecialidad {
  especialidad: string;
  tiempoConsultaPromedioMinutos: number;
  totalConsultas: number;
}

export async function getTiempoConsultaPorEspecialidad(): Promise<TiempoConsultaPorEspecialidad[]> {
  const { data } = await apiClient.get<TiempoConsultaPorEspecialidad[]>('/reports/tiempo-consulta-por-especialidad');
  return data;
}

export interface TiempoTriajePorEspecialidad {
  especialidad: string;
  tiempoTriajePromedioMinutos: number;
  totalTriajes: number;
}

export async function getTiempoTriajePorEspecialidad(): Promise<TiempoTriajePorEspecialidad[]> {
  const { data } = await apiClient.get<TiempoTriajePorEspecialidad[]>('/reports/tiempo-triaje-por-especialidad');
  return data;
}
