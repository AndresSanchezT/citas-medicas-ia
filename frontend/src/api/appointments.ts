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
}

export async function fetchAppointments(filters: {
  doctorId?: number;
  patientId?: number;
  fecha?: string;
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
