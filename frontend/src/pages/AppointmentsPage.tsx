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
import { ReagendarModal } from '../components/ReagendarModal';
import { ResultadoPoliticaModal } from '../components/ResultadoPoliticaModal';
import { SlotCalendarPicker } from '../components/SlotCalendarPicker';
import { AppointmentActions, ESTADO_LABEL } from '../components/AppointmentActions';
import { useAppointmentMutations } from '../hooks/useAppointmentMutations';
import { useAuth } from '../context/AuthContext';
import * as ui from '../components/ui';

interface NewAppointmentForm {
  patientId: number;
  doctorId: number;
  slotId: number;
  motivoConsulta?: string;
  pagado?: boolean;
  monto?: string;
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDoctor, setFiltroDoctor] = useState('');
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [showForm, setShowForm] = useState(false);
  const [nuevaCitaEspecialidadId, setNuevaCitaEspecialidadId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [triageAppointment, setTriageAppointment] = useState<Appointment | null>(null);
  const [reagendarAppointment, setReagendarAppointment] = useState<Appointment | null>(null);

  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['appointments', filtroEstado, filtroDoctor, filtroEspecialidad, filtroFechaDesde, filtroFechaHasta, page],
    queryFn: () =>
      fetchAppointments({
        estado: filtroEstado || undefined,
        doctorId: filtroDoctor ? Number(filtroDoctor) : undefined,
        specialtyId: filtroEspecialidad ? Number(filtroEspecialidad) : undefined,
        fechaDesde: filtroFechaDesde || undefined,
        fechaHasta: filtroFechaHasta || undefined,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  });
  const appointments = appointmentsResponse?.data ?? [];
  const total = appointmentsResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Cualquier cambio de filtro invalida la página actual: siempre se vuelve a la primera.
  function actualizarFiltro(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const { data: patients = [] } = useQuery({ queryKey: ['patients', ''], queryFn: () => fetchPatients() });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });
  const { data: availableSlots = [] } = useQuery({
    queryKey: ['available-slots', selectedDoctorId],
    queryFn: () => fetchSlots(selectedDoctorId!),
    enabled: !!selectedDoctorId,
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<NewAppointmentForm>();
  const watchedDoctorId = watch('doctorId');
  const watchedPagado = watch('pagado');
  const watchedSlotId = watch('slotId');

  // Precio de consulta de la especialidad elegida: se usa para autocompletar el monto
  // pagado apenas se marca la casilla (el usuario todavía puede editarlo a mano).
  const precioEspecialidadSeleccionada = nuevaCitaEspecialidadId
    ? specialties.find((s) => s.id === Number(nuevaCitaEspecialidadId))?.precioConsulta ?? null
    : null;

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
    reset({ patientId: undefined, doctorId: undefined, slotId: undefined, motivoConsulta: '', pagado: false, monto: '' });
    setNuevaCitaEspecialidadId('');
    setSelectedDoctorId(null);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
  }

  function handleNuevaCitaEspecialidadChange(value: string) {
    setNuevaCitaEspecialidadId(value);
    // El médico (y el cupo elegido) quedan obsoletos si cambia la especialidad.
    setValue('doctorId', '' as unknown as number);
    setValue('slotId', '' as unknown as number);
    setSelectedDoctorId(null);
    if (watch('pagado')) {
      const precio = specialties.find((s) => s.id === Number(value))?.precioConsulta;
      if (precio != null) setValue('monto', String(precio));
    }
  }

  const doctoresPorEspecialidad = nuevaCitaEspecialidadId
    ? doctors.filter((d) => d.specialtyId === Number(nuevaCitaEspecialidadId))
    : doctors;
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
        <select value={filtroEstado} onChange={(e) => actualizarFiltro(setFiltroEstado)(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filtroEspecialidad} onChange={(e) => actualizarFiltro(setFiltroEspecialidad)(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
          <option value="">Todas las especialidades</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        <select value={filtroDoctor} onChange={(e) => actualizarFiltro(setFiltroDoctor)(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
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
            onChange={(e) => actualizarFiltro(setFiltroFechaDesde)(e.target.value)}
            style={{ ...ui.input, marginBottom: 0, width: 160 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Hasta
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => actualizarFiltro(setFiltroFechaHasta)(e.target.value)}
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
              setPage(1);
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
              <th style={ui.th}>Especialidad</th>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Hora</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={ui.td} colSpan={7}>Cargando...</td></tr>
            )}
            {!isLoading && appointments.length === 0 && (
              <tr><td style={ui.td} colSpan={7}>Sin citas registradas.</td></tr>
            )}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td style={ui.td}>{a.patient?.nombres} {a.patient?.apellidos}</td>
                <td style={ui.td}>{a.doctor?.nombres} {a.doctor?.apellidos}</td>
                <td style={ui.td}>{a.doctor?.specialty?.nombre ?? '—'}</td>
                <td style={ui.td}>{a.fecha.split('T')[0]}</td>
                <td style={ui.td}>{a.horaInicio}</td>
                <td style={ui.td}><span style={ui.badgeColor(a.estado)}>{ESTADO_LABEL[a.estado]}</span></td>
                <td style={ui.td}>
                  <AppointmentActions
                    appointment={a}
                    rol={usuario!.rol}
                    onTriage={setTriageAppointment}
                    onReschedule={setReagendarAppointment}
                    {...appointmentActions}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {total} cita{total === 1 ? '' : 's'} — página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={ui.secondaryButton}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>
            <button
              style={ui.secondaryButton}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="Nueva cita" onClose={closeForm}>
          <form onSubmit={handleSubmit((values) => createMutation.mutate({
            ...values,
            patientId: Number(values.patientId),
            doctorId: Number(values.doctorId),
            slotId: Number(values.slotId),
            monto: values.pagado && values.monto ? Number(values.monto) : undefined,
          }))}>
            <label>Paciente</label>
            <select {...register('patientId', { required: true })} style={ui.input} defaultValue="">
              <option value="" disabled>Seleccionar...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
              ))}
            </select>

            <label>Especialidad</label>
            <select
              value={nuevaCitaEspecialidadId}
              onChange={(e) => handleNuevaCitaEspecialidadChange(e.target.value)}
              style={ui.input}
            >
              <option value="">Todas las especialidades</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>

            <label>Médico</label>
            <select
              {...register('doctorId', { required: true, onChange: (e) => setSelectedDoctorId(Number(e.target.value)) })}
              style={ui.input}
              defaultValue=""
            >
              <option value="" disabled>
                {nuevaCitaEspecialidadId && doctoresPorEspecialidad.length === 0
                  ? 'Sin médicos en esta especialidad'
                  : 'Seleccionar...'}
              </option>
              {doctoresPorEspecialidad.map((d) => (
                <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.specialty?.nombre})</option>
              ))}
            </select>

            <label>Fecha y hora del cupo</label>
            <input type="hidden" {...register('slotId', { required: true })} />
            {watchedDoctorId ? (
              <SlotCalendarPicker
                slots={disponibles}
                value={watchedSlotId || null}
                onChange={(id) => setValue('slotId', id, { shouldValidate: true })}
              />
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Selecciona un médico primero.</p>
            )}

            <label>Motivo de consulta</label>
            <input {...register('motivoConsulta')} placeholder="Ej. Dolor de cabeza, control rutinario..." style={ui.input} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: watchedPagado ? 4 : 12 }}>
              <input
                type="checkbox"
                {...register('pagado', {
                  onChange: (e) => {
                    if (e.target.checked && precioEspecialidadSeleccionada != null) {
                      setValue('monto', String(precioEspecialidadSeleccionada));
                    }
                  },
                })}
                style={{ width: 'auto', marginBottom: 0 }}
              />
              El paciente ya pagó la cita
            </label>
            {watchedPagado && (
              <>
                <label>Monto pagado (S/)</label>
                <input type="number" step="0.1" min={0} placeholder="Ej. 80" {...register('monto')} style={ui.input} />
                {precioEspecialidadSeleccionada != null && (
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: -8, marginBottom: 8 }}>
                    Autocompletado con el precio de consulta de {specialties.find((s) => s.id === Number(nuevaCitaEspecialidadId))?.nombre} (S/ {precioEspecialidadSeleccionada}). Puedes editarlo si corresponde otro monto.
                  </small>
                )}
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}>
                  Política: la primera vez que se reprograma o cancela esta cita, el pago queda a salvo; una segunda cancelación lo pierde.
                </small>
              </>
            )}

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

      {reagendarAppointment && (
        <ReagendarModal appointment={reagendarAppointment} onClose={() => setReagendarAppointment(null)} />
      )}

      {appointmentActions.resultadoPolitica && (
        <ResultadoPoliticaModal
          appointment={appointmentActions.resultadoPolitica}
          onClose={appointmentActions.limpiarResultadoPolitica}
        />
      )}
    </div>
  );
}
