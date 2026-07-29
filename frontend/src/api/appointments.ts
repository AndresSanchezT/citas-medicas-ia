import { apiClient } from './client';
import type { Patient } from './patients';
import type { Doctor } from './doctors';

export type AppointmentStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'NO_ASISTIO';

export type TriagePrioridad = 'LEVE' | 'MODERADO' | 'URGENTE' | 'CRITICO';

export interface Triage {
  id: number;
  appointmentId: number;
  presionSistolica: number | null;
  presionDiastolica: number | null;
  frecuenciaCardiaca: number | null;
  temperatura: number | null;
  frecuenciaRespiratoria: number | null;
  saturacionOxigeno: number | null;
  peso: number | null;
  talla: number | null;
  prioridad: TriagePrioridad | null;
  notas: string | null;
  registradoEn: string;
}

export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  slotId: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: AppointmentStatus;
  motivoConsulta: string | null;
  patient: Patient;
  doctor: Doctor;
  waitTimeHistory: { tiempoEsperaMinutosReal: number } | null;
  triage: Triage | null;
}

export async function fetchAppointments(filters: {
  doctorId?: number;
  patientId?: number;
  specialtyId?: number;
  fecha?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string;
}): Promise<Appointment[]> {
  const { data } = await apiClient.get<Appointment[]>('/appointments', { params: filters });
  return data;
}

export async function createAppointment(input: {
  patientId: number;
  doctorId: number;
  slotId: number;
  motivoConsulta?: string;
}): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>('/appointments', input);
  return data;
}

export async function checkIn(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/check-in`);
  return data;
}

export async function startConsultation(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/start`);
  return data;
}

export async function completeAppointment(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/complete`);
  return data;
}

export async function cancelAppointment(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/cancel`);
  return data;
}

export async function markNoShow(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/no-show`);
  return data;
}

export async function rescheduleAppointment(id: number, newSlotId: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/reschedule`, { newSlotId });
  return data;
}

export async function upsertTriage(
  appointmentId: number,
  input: {
    presionSistolica?: number;
    presionDiastolica?: number;
    frecuenciaCardiaca?: number;
    temperatura?: number;
    frecuenciaRespiratoria?: number;
    saturacionOxigeno?: number;
    peso?: number;
    talla?: number;
    prioridad?: TriagePrioridad;
    notas?: string;
  },
): Promise<Triage> {
  const { data } = await apiClient.post<Triage>(`/appointments/${appointmentId}/triage`, input);
  return data;
}
