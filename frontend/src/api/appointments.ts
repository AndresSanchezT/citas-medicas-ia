import { apiClient } from './client';
import type { Patient } from './patients';
import type { Doctor } from './doctors';

export type AppointmentStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'NO_ASISTIO'
  | 'REPROGRAMADA';

export type TriagePrioridad = 'LEVE' | 'MODERADO' | 'URGENTE' | 'CRITICO';

export type EstadoReembolso = 'NO_APLICA' | 'REEMBOLSADO' | 'PERDIDO';

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
  inicioTriajeEn: string | null;
  finTriajeEn: string | null;
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
  pagado: boolean;
  monto: number | null;
  reprogramacionGratuitaUsada: boolean;
  reembolso: EstadoReembolso;
  plazoReprogramacionHasta: string | null;
  citaOrigenId: number | null;
  motivoReprogramacion: string | null;
  reprogramadaPorUserId: number | null;
}

export interface PaginatedAppointments {
  data: Appointment[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchAppointments(filters: {
  doctorId?: number;
  patientId?: number;
  specialtyId?: number;
  fecha?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedAppointments> {
  const { data } = await apiClient.get<PaginatedAppointments>('/appointments', { params: filters });
  return data;
}

export async function createAppointment(input: {
  patientId: number;
  doctorId: number;
  slotId: number;
  motivoConsulta?: string;
  pagado?: boolean;
  monto?: number;
}): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>('/appointments', input);
  return data;
}

export async function checkIn(id: number): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/check-in`);
  return data;
}

export async function startConsultation(id: number, horaAtencionInicioReal?: string): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/start`, { horaAtencionInicioReal });
  return data;
}

export async function completeAppointment(id: number, horaAtencionFinReal?: string): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/complete`, { horaAtencionFinReal });
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

export async function rescheduleAppointment(id: number, newSlotId: number, motivo?: string): Promise<Appointment> {
  const { data } = await apiClient.patch<Appointment>(`/appointments/${id}/reschedule`, { newSlotId, motivo });
  return data;
}

export async function upsertTriage(
  appointmentId: number,
  input: {
    inicioTriajeEn?: string;
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
