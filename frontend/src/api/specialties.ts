import { apiClient } from './client';

export interface Specialty {
  id: number;
  nombre: string;
  precioConsulta: number | null;
  activo: boolean;
}

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data } = await apiClient.get<Specialty[]>('/specialties');
  return data;
}

export async function createSpecialty(nombre: string): Promise<Specialty> {
  const { data } = await apiClient.post<Specialty>('/specialties', { nombre });
  return data;
}

export async function updateSpecialty(id: number, input: { nombre?: string; precioConsulta?: number }): Promise<Specialty> {
  const { data } = await apiClient.patch<Specialty>(`/specialties/${id}`, input);
  return data;
}

export async function deactivateSpecialty(id: number): Promise<Specialty> {
  const { data } = await apiClient.delete<Specialty>(`/specialties/${id}`);
  return data;
}
