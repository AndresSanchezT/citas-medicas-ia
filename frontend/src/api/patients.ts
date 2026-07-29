import { apiClient } from './client';

export interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  documentoIdentidad: string;
  fechaNacimiento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
}

export interface PatientInput {
  nombres: string;
  apellidos: string;
  documentoIdentidad: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

export async function fetchPatients(search?: string): Promise<Patient[]> {
  const { data } = await apiClient.get<Patient[]>('/patients', { params: search ? { search } : {} });
  return data;
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  const { data } = await apiClient.post<Patient>('/patients', input);
  return data;
}

export async function updatePatient(id: number, input: Partial<PatientInput>): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>(`/patients/${id}`, input);
  return data;
}

export async function deactivatePatient(id: number): Promise<void> {
  await apiClient.delete(`/patients/${id}`);
}

export interface TriageSummaryHallazgo {
  campo: string;
  tendencia: 'mejora' | 'empeora' | 'estable';
  detalle: string;
}

export interface TriageSummaryResponse {
  disponible: boolean;
  mensaje: string;
  hallazgos: TriageSummaryHallazgo[];
  totalTriajesConsiderados: number;
  primerTriaje?: string;
  ultimoTriaje?: string;
  disclaimer: string;
}

export async function fetchTriageSummary(patientId: number): Promise<TriageSummaryResponse> {
  const { data } = await apiClient.get<TriageSummaryResponse>(`/patients/${patientId}/triage-summary`);
  return data;
}
