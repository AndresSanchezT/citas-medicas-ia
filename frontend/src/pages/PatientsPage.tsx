import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPatient, deactivatePatient, fetchPatients, updatePatient, type Patient } from '../api/patients';
import { Modal } from '../components/Modal';
import { PatientHistoryModal } from '../components/PatientHistoryModal';
import * as ui from '../components/ui';

const patientSchema = z.object({
  nombres: z.string().min(1, 'Requerido'),
  apellidos: z.string().min(1, 'Requerido'),
  documentoIdentidad: z.string().min(1, 'Requerido'),
  telefono: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Correo inválido')]).optional(),
  direccion: z.string().optional(),
});
type PatientForm = z.infer<typeof patientSchema>;

export function PatientsPage() {
  const queryClient = useQueryClient();
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
    reset({ nombres: '', apellidos: '', documentoIdentidad: '', telefono: '', email: '', direccion: '' });
    setShowForm(true);
  }

  function openEdit(patient: Patient) {
    setEditing(patient);
    reset({
      nombres: patient.nombres,
      apellidos: patient.apellidos,
      documentoIdentidad: patient.documentoIdentidad,
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
        <button style={ui.primaryButton} onClick={openCreate}>
          + Nuevo paciente
        </button>
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
              <th style={ui.th}>Teléfono</th>
              <th style={ui.th}>Email</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td style={ui.td} colSpan={5}>Cargando...</td>
              </tr>
            )}
            {!isLoading && patients.length === 0 && (
              <tr>
                <td style={ui.td} colSpan={5}>Sin pacientes registrados.</td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id}>
                <td style={ui.td}>{p.nombres} {p.apellidos}</td>
                <td style={ui.td}>{p.documentoIdentidad}</td>
                <td style={ui.td}>{p.telefono ?? '—'}</td>
                <td style={ui.td}>{p.email ?? '—'}</td>
                <td style={ui.td}>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => setHistoryPatient(p)}>
                    Ver historial
                  </button>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => openEdit(p)}>
                    Editar
                  </button>
                  <button
                    style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                    onClick={() => deactivateMutation.mutate(p.id)}
                  >
                    Desactivar
                  </button>
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
            <input {...register('nombres')} style={ui.input} />
            {errors.nombres && <small style={{ color: 'var(--color-critical)' }}>{errors.nombres.message}</small>}

            <label>Apellidos</label>
            <input {...register('apellidos')} style={ui.input} />
            {errors.apellidos && <small style={{ color: 'var(--color-critical)' }}>{errors.apellidos.message}</small>}

            <label>Documento de identidad</label>
            <input {...register('documentoIdentidad')} style={ui.input} />
            {errors.documentoIdentidad && <small style={{ color: 'var(--color-critical)' }}>{errors.documentoIdentidad.message}</small>}

            <label>Teléfono</label>
            <input {...register('telefono')} style={ui.input} />

            <label>Email</label>
            <input {...register('email')} style={ui.input} />
            {errors.email && <small style={{ color: 'var(--color-critical)' }}>{errors.email.message}</small>}

            <label>Dirección</label>
            <input {...register('direccion')} style={ui.input} />

            <button type="submit" disabled={isSubmitting} style={{ ...ui.primaryButton, width: '100%' }}>
              Guardar
            </button>
          </form>
        </Modal>
      )}

      {historyPatient && (
        <PatientHistoryModal patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      )}
    </div>
  );
}
