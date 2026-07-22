import { apiClient } from './client';
import type { Doctor } from './doctors';

export interface AppointmentSlot {
  id: number;
  doctorId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'DISPONIBLE' | 'RESERVADO' | 'BLOQUEADO';
  doctor?: Doctor;
}

export interface WeeklyAvailability {
  id: number;
  doctorId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionSlotMinutos: number;
  activo: boolean;
}

export async function fetchSlots(doctorId?: number, fecha?: string): Promise<AppointmentSlot[]> {
  const { data } = await apiClient.get<AppointmentSlot[]>('/schedules/slots', {
    params: { doctorId, fecha },
  });
  return data;
}

export async function fetchAvailabilityByDoctor(doctorId: number): Promise<WeeklyAvailability[]> {
  const { data } = await apiClient.get<WeeklyAvailability[]>(`/schedules/availability/doctor/${doctorId}`);
  return data;
}

export async function createAvailability(input: {
  doctorId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionSlotMinutos?: number;
}): Promise<WeeklyAvailability> {
  const { data } = await apiClient.post<WeeklyAvailability>('/schedules/availability', input);
  return data;
}

export async function generateSlots(daysAhead?: number): Promise<number> {
  const { data } = await apiClient.post<number>('/schedules/generate-slots', { daysAhead });
  return data;
}
