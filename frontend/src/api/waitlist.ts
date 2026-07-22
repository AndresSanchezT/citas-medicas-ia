import { apiClient } from './client';
import type { Patient } from './patients';
import type { Doctor } from './doctors';
import type { Specialty } from './specialties';

export interface WaitlistEntry {
  id: number;
  patientId: number;
  doctorId: number | null;
  specialtyId: number | null;
  prioridad: 'NORMAL' | 'URGENTE';
  estado: 'ESPERANDO' | 'NOTIFICADO' | 'ASIGNADO' | 'EXPIRADO';
  tiempoEsperaEstimadoMinutos: number | null;
  fechaSolicitud: string;
  patient: Patient;
  doctor: Doctor | null;
  specialty: Specialty | null;
}

export interface DemandRankingItem {
  doctorId: number;
  nombre: string;
  especialidad: string;
  totalCitas: number;
  demanda: 'alta' | 'normal' | 'baja';
}

export async function fetchWaitlist(estado?: string): Promise<WaitlistEntry[]> {
  const { data } = await apiClient.get<WaitlistEntry[]>('/waitlist', { params: { estado } });
  return data;
}

export async function createWaitlistEntry(input: {
  patientId: number;
  doctorId?: number;
  specialtyId?: number;
  prioridad?: 'NORMAL' | 'URGENTE';
}): Promise<WaitlistEntry> {
  const { data } = await apiClient.post<WaitlistEntry>('/waitlist', input);
  return data;
}

export async function assignWaitlistEntry(id: number, slotId: number): Promise<unknown> {
  const { data } = await apiClient.patch(`/waitlist/${id}/assign`, { slotId });
  return data;
}

export async function expireWaitlistEntry(id: number): Promise<WaitlistEntry> {
  const { data } = await apiClient.patch<WaitlistEntry>(`/waitlist/${id}/expire`);
  return data;
}

export async function fetchDemandRanking(): Promise<DemandRankingItem[]> {
  const { data } = await apiClient.get<DemandRankingItem[]>('/waitlist/demand-ranking');
  return data;
}
