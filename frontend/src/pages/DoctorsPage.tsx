import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createDoctor, deactivateDoctor, fetchDoctors, updateDoctor, type Doctor } from '../api/doctors';
import { createSpecialty, fetchSpecialties } from '../api/specialties';
import { Modal } from '../components/Modal';
import { DoctorTimeOffModal } from '../components/DoctorTimeOffModal';
import { DoctorScheduleModal } from '../components/DoctorScheduleModal';
import * as ui from '../components/ui';

const doctorSchema = z.object({
  nombres: z.string().min(1, 'Requerido'),
  apellidos: z.string().min(1, 'Requerido'),
  documentoIdentidad: z.string().min(1, 'Requerido'),
  specialtyId: z.string().min(1, 'Selecciona una especialidad'),
  telefono: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Correo inválido')]).optional(),
  password: z.union([z.literal(''), z.string().min(6, 'Mínimo 6 caracteres')]).optional(),
});
type DoctorForm = z.infer<typeof doctorSchema>;

export function DoctorsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [timeOffDoctor, setTimeOffDoctor] = useState<Doctor | null>(null);
  const [scheduleDoctor, setScheduleDoctor] = useState<Doctor | null>(null);

  const { data: doctors = [], isLoading } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<DoctorForm>({
    resolver: zodResolver(doctorSchema),
  });

  const saveMutation = useMutation({
    mutationFn: (values: DoctorForm) => {
      const input = { ...values, specialtyId: Number(values.specialtyId) };
      if (!input.password) delete input.password;
      return editing ? updateDoctor(editing.id, input) : createDoctor(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      closeForm();
    },
  });

  function onSubmit(values: DoctorForm) {
    if (!editing) {
      if (!values.email) {
        setError('email', { message: 'Requerido para crear las credenciales de acceso del médico' });
        return;
      }
      if (!values.password) {
        setError('password', { message: 'Requerido para crear las credenciales de acceso del médico' });
        return;
      }
    }
    saveMutation.mutate(values);
  }

  const deactivateMutation = useMutation({
    mutationFn: deactivateDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });

  const specialtyMutation = useMutation({
    mutationFn: createSpecialty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
      setNewSpecialty('');
    },
  });

  function openCreate() {
    setEditing(null);
    reset({ nombres: '', apellidos: '', documentoIdentidad: '', specialtyId: '', telefono: '', email: '', password: '' });
    setShowForm(true);
  }

  function openEdit(doctor: Doctor) {
    setEditing(doctor);
    reset({
      nombres: doctor.nombres,
      apellidos: doctor.apellidos,
      documentoIdentidad: doctor.documentoIdentidad,
      specialtyId: String(doctor.specialtyId),
      telefono: doctor.telefono ?? '',
      email: doctor.email ?? '',
      password: '',
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
        <h1>Médicos</h1>
        <button style={ui.primaryButton} onClick={openCreate}>
          + Nuevo médico
        </button>
      </div>

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Nombre</th>
              <th style={ui.th}>Especialidad</th>
              <th style={ui.th}>Documento</th>
              <th style={ui.th}>Contacto</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td style={ui.td} colSpan={5}>Cargando...</td>
              </tr>
            )}
            {!isLoading && doctors.length === 0 && (
              <tr>
                <td style={ui.td} colSpan={5}>Sin médicos registrados.</td>
              </tr>
            )}
            {doctors.map((d) => (
              <tr key={d.id}>
                <td style={ui.td}>{d.nombres} {d.apellidos}</td>
                <td style={ui.td}>{d.specialty?.nombre}</td>
                <td style={ui.td}>{d.documentoIdentidad}</td>
                <td style={ui.td}>{d.telefono ?? d.email ?? '—'}</td>
                <td style={ui.td}>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => setScheduleDoctor(d)}>
                    Horarios
                  </button>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => setTimeOffDoctor(d)}>
                    Descansos/Vacaciones
                  </button>
                  <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => openEdit(d)}>
                    Editar
                  </button>
                  <button
                    style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                    onClick={() => deactivateMutation.mutate(d.id)}
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
        <Modal title={editing ? 'Editar médico' : 'Nuevo médico'} onClose={closeForm}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <label>Nombres</label>
            <input {...register('nombres')} style={ui.input} />
            {errors.nombres && <small style={{ color: 'var(--color-critical)' }}>{errors.nombres.message}</small>}

            <label>Apellidos</label>
            <input {...register('apellidos')} style={ui.input} />
            {errors.apellidos && <small style={{ color: 'var(--color-critical)' }}>{errors.apellidos.message}</small>}

            <label>Documento de identidad</label>
            <input {...register('documentoIdentidad')} style={ui.input} />
            {errors.documentoIdentidad && <small style={{ color: 'var(--color-critical)' }}>{errors.documentoIdentidad.message}</small>}

            <label>Especialidad</label>
            <select {...register('specialtyId')} style={ui.input} defaultValue="">
              <option value="" disabled>Seleccionar...</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {errors.specialtyId && <small style={{ color: 'var(--color-critical)' }}>{errors.specialtyId.message}</small>}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Nueva especialidad..."
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                style={{ ...ui.input, marginBottom: 0, flex: 1 }}
              />
              <button
                type="button"
                style={ui.secondaryButton}
                disabled={!newSpecialty}
                onClick={() => specialtyMutation.mutate(newSpecialty)}
              >
                Agregar
              </button>
            </div>

            <label>Teléfono</label>
            <input {...register('telefono')} style={ui.input} />

            <label>Email {!editing && '(será su usuario de acceso)'}</label>
            <input {...register('email')} style={ui.input} />
            {errors.email && <small style={{ color: 'var(--color-critical)' }}>{errors.email.message}</small>}

            <label>Contraseña {!editing && '(acceso a "Mi agenda")'}</label>
            <input type="password" {...register('password')} style={ui.input} placeholder={editing ? 'Dejar en blanco para no cambiarla' : ''} />
            {errors.password && <small style={{ color: 'var(--color-critical)' }}>{errors.password.message}</small>}

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

      {timeOffDoctor && (
        <DoctorTimeOffModal doctor={timeOffDoctor} onClose={() => setTimeOffDoctor(null)} />
      )}

      {scheduleDoctor && (
        <DoctorScheduleModal doctor={scheduleDoctor} onClose={() => setScheduleDoctor(null)} />
      )}
    </div>
  );
}
