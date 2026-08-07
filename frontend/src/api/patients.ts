import { apiClient } from './client';

export type Sexo = 'MASCULINO' | 'FEMENINO';

export const SEXO_LABEL: Record<Sexo, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
};

// Compartido entre Pacientes y Médicos: ambos formularios usan el mismo combobox de tipo
// de documento.
export type TipoDocumento = 'DNI' | 'PASAPORTE' | 'CARNET_EXTRANJERIA' | 'OTRO';

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  DNI: 'DNI',
  PASAPORTE: 'Pasaporte',
  CARNET_EXTRANJERIA: 'Carné de extranjería',
  OTRO: 'Otro',
};

export interface Patient {
  id: number;
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumento;
  documentoIdentidad: string;
  fechaNacimiento: string | null;
  sexo: Sexo | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
}

export interface PatientInput {
  nombres: string;
  apellidos: string;
  tipoDocumento?: TipoDocumento;
  documentoIdentidad: string;
  sexo?: Sexo;
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
