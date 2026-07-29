import { apiClient } from './client';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'MEDICO' | 'RECEPCIONISTA';
  doctorId: number | null;
  especialidad: string | null;
}

export interface LoginResponse {
  accessToken: string;
  usuario: Usuario;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
  return data;
}
