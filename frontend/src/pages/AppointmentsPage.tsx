import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createAppointment, fetchAppointments, type Appointment } from '../api/appointments';
import { fetchPatients } from '../api/patients';
import { fetchDoctors } from '../api/doctors';
import { fetchSpecialties } from '../api/specialties';
import { fetchSlots } from '../api/schedules';
import { Modal } from '../components/Modal';
import { TriageModal } from '../components/TriageModal';
import { AppointmentActions, ESTADO_LABEL } from '../components/AppointmentActions';
import { useAppointmentMutations } from '../hooks/useAppointmentMutations';
import { useAuth } from '../context/AuthContext';
import * as ui from '../components/ui';

interface NewAppointmentForm {
  patientId: number;
  doctorId: number;
  slotId: number;
  motivoConsulta?: string;
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDoctor, setFiltroDoctor] = useState('');
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [triageAppointment, setTriageAppointment] = useState<Appointment | null>(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', filtroEstado, filtroDoctor, filtroEspecialidad, filtroFechaDesde, filtroFechaHasta],
    queryFn: () =>
      fetchAppointments({
        estado: filtroEstado || undefined,
        doctorId: filtroDoctor ? Number(filtroDoctor) : undefined,
        specialtyId: filtroEspecialidad ? Number(filtroEspecialidad) : undefined,
        fechaDesde: filtroFechaDesde || undefined,
        fechaHasta: filtroFechaHasta || undefined,
      }),
  });

  const { data: patients = [] } = useQuery({ queryKey: ['patients', ''], queryFn: () => fetchPatients() });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });
  const { data: availableSlots = [] } = useQuery({
    queryKey: ['available-slots', selectedDoctorId],
    queryFn: () => fetchSlots(selectedDoctorId!),
    enabled: !!selectedDoctorId,
  });

  const { register, handleSubmit, reset, watch } = useForm<NewAppointmentForm>();
  const watchedDoctorId = watch('doctorId');

  const appointmentActions = useAppointmentMutations(['appointments']);
  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      closeForm();
    },
  });

  function openCreate() {
    reset({ patientId: undefined, doctorId: undefined, slotId: undefined, motivoConsulta: '' });
    setSelectedDoctorId(null);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
  }

  const disponibles = availableSlots.filter((s) => s.estado === 'DISPONIBLE');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Citas</h1>
        <button style={ui.primaryButton} onClick={openCreate}>
          + Nueva cita
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
          <option value="">Todas las especialidades</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <select value={filtroDoctor} onChange={(e) => setFiltroDoctor(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
          <option value="">Todos los médicos</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.nombres} {d.apellidos}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Desde
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            style={{ ...ui.input, marginBottom: 0, width: 160 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Hasta
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            style={{ ...ui.input, marginBottom: 0, width: 160 }}
          />
        </label>
        {(filtroEstado || filtroDoctor || filtroEspecialidad || filtroFechaDesde || filtroFechaHasta) && (
          <button
            style={ui.secondaryButton}
            onClick={() => {
              setFiltroEstado('');
              setFiltroDoctor('');
              setFiltroEspecialidad('');
              setFiltroFechaDesde('');
              setFiltroFechaHasta('');
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Paciente</th>
              <th style={ui.th}>Médico</th>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Hora</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={ui.td} colSpan={6}>Cargando...</td></tr>
            )}
            {!isLoading && appointments.length === 0 && (
              <tr><td style={ui.td} colSpan={6}>Sin citas registradas.</td></tr>
            )}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td style={ui.td}>{a.patient?.nombres} {a.patient?.apellidos}</td>
                <td style={ui.td}>{a.doctor?.nombres} {a.doctor?.apellidos}</td>
                <td style={ui.td}>{a.fecha.split('T')[0]}</td>
                <td style={ui.td}>{a.horaInicio}</td>
                <td style={ui.td}><span style={ui.badgeColor(a.estado)}>{ESTADO_LABEL[a.estado]}</span></td>
                <td style={ui.td}>
                  <AppointmentActions appointment={a} rol={usuario!.rol} onTriage={setTriageAppointment} {...appointmentActions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Nueva cita" onClose={closeForm}>
          <form onSubmit={handleSubmit((values) => createMutation.mutate({ ...values, patientId: Number(values.patientId), doctorId: Number(values.doctorId), slotId: Number(values.slotId) }))}>
            <label>Paciente</label>
            <select {...register('patientId', { required: true })} style={ui.input} defaultValue="">
              <option value="" disabled>Seleccionar...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
              ))}
            </select>

            <label>Médico</label>
            <select
              {...register('doctorId', { required: true, onChange: (e) => setSelectedDoctorId(Number(e.target.value)) })}
              style={ui.input}
              defaultValue=""
            >
              <option value="" disabled>Seleccionar...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.specialty?.nombre})</option>
              ))}
            </select>

            <label>Cupo disponible</label>
            <select {...register('slotId', { required: true })} style={ui.input} defaultValue="" disabled={!watchedDoctorId}>
              <option value="" disabled>
                {watchedDoctorId ? (disponibles.length ? 'Seleccionar...' : 'Sin cupos disponibles') : 'Selecciona un médico primero'}
              </option>
              {disponibles.map((s) => (
                <option key={s.id} value={s.id}>{s.fecha.split('T')[0]} — {s.horaInicio}</option>
              ))}
            </select>

            <label>Motivo de consulta</label>
            <input {...register('motivoConsulta')} style={ui.input} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={closeForm}>
                Cancelar
              </button>
              <button type="submit" disabled={createMutation.isPending} style={{ ...ui.primaryButton, flex: 1 }}>
                Confirmar cita
              </button>
            </div>
          </form>
        </Modal>
      )}

      {triageAppointment && (
        <TriageModal appointment={triageAppointment} onClose={() => setTriageAppointment(null)} />
      )}
    </div>
  );
}
