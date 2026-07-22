import { apiClient } from './client';

export interface Specialty {
  id: number;
  nombre: string;
}

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data } = await apiClient.get<Specialty[]>('/specialties');
  return data;
}

export async function createSpecialty(nombre: string): Promise<Specialty> {
  const { data } = await apiClient.post<Specialty>('/specialties', { nombre });
  return data;
}
