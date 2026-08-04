import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPatient, deactivatePatient, fetchPatients, updatePatient, SEXO_LABEL, type Patient, type Sexo } from '../api/patients';
import { Modal } from '../components/Modal';
import { PatientHistoryModal } from '../components/PatientHistoryModal';
import { useAuth } from '../context/AuthContext';
import * as ui from '../components/ui';

const patientSchema = z.object({
  nombres: z.string().min(1, 'Requerido'),
  apellidos: z.string().min(1, 'Requerido'),
  documentoIdentidad: z.string().min(1, 'Requerido'),
  sexo: z.enum(['MASCULINO', 'FEMENINO'], { message: 'Selecciona el sexo del paciente' }),
  telefono: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Correo inválido')]).optional(),
  direccion: z.string().optional(),
});
type PatientForm = z.infer<typeof patientSchema>;

export function PatientsPage() {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  // Debe reflejar los mismos @Roles() del backend (patients.controller.ts): crear/editar
  // es tarea de recepción o admin; desactivar (soft-delete) queda exclusivo del admin.
  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'RECEPCIONISTA';
  const puedeDesactivar = usuario?.rol === 'ADMIN';
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Patient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => fetchPatients(search || undefined),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  });

  const saveMutation = useMutation({
    mutationFn: (values: PatientForm) =>
      editing ? updatePatient(editing.id, values) : createPatient(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      closeForm();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivatePatient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ nombres: '', apellidos: '', documentoIdentidad: '', sexo: undefined as unknown as Sexo, telefono: '', email: '', direccion: '' });
    setShowForm(true);
  }

  function openEdit(patient: Patient) {
    setEditing(patient);
    reset({
      nombres: patient.nombres,
      apellidos: patient.apellidos,
      documentoIdentidad: patient.documentoIdentidad,
      sexo: patient.sexo ?? (undefined as unknown as Sexo),
      telefono: patient.telefono ?? '',
      email: patient.email ?? '',
      direccion: patient.direccion ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Pacientes</h1>
        {puedeEditar && (
          <button style={ui.primaryButton} onClick={openCreate}>
            + Nuevo paciente
          </button>
        )}
      </div>

      <input
        placeholder="Buscar por nombre, apellido o documento..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...ui.input, maxWidth: 360 }}
      />

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Nombre</th>
              <th style={ui.th}>Documento</th>
              <th style={ui.th}>Sexo</th>
              <th style={ui.th}>Teléfono</th>
              <th style={ui.th}>Email</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td style={ui.td} colSpan={6}>Cargando...</td>
              </tr>
            )}
            {!isLoading && patients.length === 0 && (
              <tr>
                <td style={ui.td} colSpan={6}>Sin pacientes registrados.</td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id}>
                <td style={ui.td}>{p.nombres} {p.apellidos}</td>
                <td style={ui.td}>{p.documentoIdentidad}</td>
                <td style={ui.td}>{p.sexo ? SEXO_LABEL[p.sexo] : '—'}</td>
                <td style={ui.td}>{p.telefono ?? '—'}</td>
                <td style={ui.td}>{p.email ?? '—'}</td>
                <td style={ui.td}>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => setHistoryPatient(p)}>
                    Ver historial
                  </button>
                  {puedeEditar && (
                    <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => openEdit(p)}>
                      Editar
                    </button>
                  )}
                  {puedeDesactivar && (
                    <button
                      style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                      onClick={() => {
                        if (window.confirm(`¿Desactivar a ${p.nombres} ${p.apellidos}? Ya no aparecerá disponible para agendar citas.`)) {
                          deactivateMutation.mutate(p.id);
                        }
                      }}
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar paciente' : 'Nuevo paciente'} onClose={closeForm}>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
            <label>Nombres</label>
            <input {...register('nombres')} placeholder="Ej. María José" style={ui.input} />
            {errors.nombres && <small style={{ color: 'var(--color-critical)' }}>{errors.nombres.message}</small>}

            <label>Apellidos</label>
            <input {...register('apellidos')} placeholder="Ej. García López" style={ui.input} />
            {errors.apellidos && <small style={{ color: 'var(--color-critical)' }}>{errors.apellidos.message}</small>}

            <label>Documento de identidad</label>
            <input {...register('documentoIdentidad')} placeholder="Ej. 12345678" style={ui.input} />
            {errors.documentoIdentidad && <small style={{ color: 'var(--color-critical)' }}>{errors.documentoIdentidad.message}</small>}

            <label>Sexo</label>
            <select {...register('sexo')} style={ui.input} defaultValue="">
              <option value="" disabled>Seleccionar...</option>
              {Object.entries(SEXO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.sexo && <small style={{ color: 'var(--color-critical)' }}>{errors.sexo.message}</small>}

            <label>Teléfono</label>
            <input {...register('telefono')} placeholder="Ej. 987654321" style={ui.input} />

            <label>Email</label>
            <input {...register('email')} placeholder="correo@ejemplo.com" style={ui.input} />
            {errors.email && <small style={{ color: 'var(--color-critical)' }}>{errors.email.message}</small>}

            <label>Dirección</label>
            <input {...register('direccion')} placeholder="Ej. Jr. Los Álamos 123, Tarapoto" style={ui.input} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={closeForm}>
                Cancelar
              </button>
              <button type="submit" disabled={isSubmitting} style={{ ...ui.primaryButton, flex: 1 }}>
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {historyPatient && (
        <PatientHistoryModal patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      )}
    </div>
  );
}
