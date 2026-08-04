import { apiClient } from './client';

export interface Specialty {
  id: number;
  nombre: string;
  precioConsulta: number | null;
}

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data } = await apiClient.get<Specialty[]>('/specialties');
  return data;
}

export async function createSpecialty(nombre: string): Promise<Specialty> {
  const { data } = await apiClient.post<Specialty>('/specialties', { nombre });
  return data;
}

export async function updateSpecialtyPrecio(id: number, precioConsulta: number): Promise<Specialty> {
  const { data } = await apiClient.patch<Specialty>(`/specialties/${id}`, { precioConsulta });
  return data;
}
