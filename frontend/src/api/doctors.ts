import { apiClient } from './client';
import type { Specialty } from './specialties';
import type { TipoDocumento } from './patients';

export interface Doctor {
  id: number;
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumento;
  documentoIdentidad: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  specialtyId: number;
  specialty: Specialty;
}

export interface DoctorInput {
  nombres: string;
  apellidos: string;
  tipoDocumento?: TipoDocumento;
  documentoIdentidad: string;
  specialtyId: number;
  telefono?: string;
  email?: string;
  password?: string;
}

export interface PaginatedDoctors {
  data: Doctor[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchDoctors(page?: number, pageSize?: number): Promise<PaginatedDoctors> {
  const { data } = await apiClient.get<PaginatedDoctors>('/doctors', { params: { page, pageSize } });
  return data;
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  const { data } = await apiClient.post<Doctor>('/doctors', input);
  return data;
}

export async function updateDoctor(id: number, input: Partial<DoctorInput>): Promise<Doctor> {
  const { data } = await apiClient.patch<Doctor>(`/doctors/${id}`, input);
  return data;
}

export async function deactivateDoctor(id: number): Promise<void> {
  await apiClient.delete(`/doctors/${id}`);
}
