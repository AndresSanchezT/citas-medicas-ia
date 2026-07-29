import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  assignWaitlistEntry,
  createWaitlistEntry,
  expireWaitlistEntry,
  fetchDemandRanking,
  fetchWaitlist,
  type WaitlistEntry,
} from '../api/waitlist';
import { fetchPatients } from '../api/patients';
import { fetchDoctors } from '../api/doctors';
import { fetchSpecialties } from '../api/specialties';
import { fetchSlots } from '../api/schedules';
import { Modal } from '../components/Modal';
import * as ui from '../components/ui';

interface NewEntryForm {
  patientId: number;
  doctorId?: number;
  specialtyId?: number;
  prioridad: 'NORMAL' | 'URGENTE';
}

// El backend calcula tiempoEsperaEstimadoMinutos una sola vez, al anotar al paciente.
// Acá lo convertimos en una cuenta regresiva en vivo restando el tiempo ya transcurrido
// desde fechaSolicitud, para no mostrar siempre el mismo número congelado.
function tiempoEsperaLabel(entry: WaitlistEntry): string {
  if (entry.tiempoEsperaEstimadoMinutos == null) return '—';
  if (entry.estado !== 'ESPERANDO' && entry.estado !== 'NOTIFICADO') {
    return `~${entry.tiempoEsperaEstimadoMinutos} min (estimado inicial)`;
  }
  const transcurridoMin = (Date.now() - new Date(entry.fechaSolicitud).getTime()) / 60000;
  const restante = Math.round(entry.tiempoEsperaEstimadoMinutos - transcurridoMin);
  return restante > 0 ? `~${restante} min` : 'Tiempo estimado superado';
}

export function WaitlistPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [assigning, setAssigning] = useState<WaitlistEntry | null>(null);
  const [assignDoctorId, setAssignDoctorId] = useState<number | null>(null);
  const [assignSlotId, setAssignSlotId] = useState<number | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['waitlist', filtroEstado],
    queryFn: () => fetchWaitlist(filtroEstado || undefined),
  });
  const { data: ranking = [] } = useQuery({ queryKey: ['demand-ranking'], queryFn: fetchDemandRanking });
  const { data: patients = [] } = useQuery({ queryKey: ['patients', ''], queryFn: () => fetchPatients() });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: fetchDoctors });
  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });
  const { data: slotsForAssign = [] } = useQuery({
    queryKey: ['available-slots', assignDoctorId],
    queryFn: () => fetchSlots(assignDoctorId!),
    enabled: !!assignDoctorId,
  });

  const { register, handleSubmit, reset } = useForm<NewEntryForm>({ defaultValues: { prioridad: 'NORMAL' } });

  // Fuerza un re-render cada 30s para que la cuenta regresiva de "Tiempo estimado" avance
  // sin necesidad de recargar la página ni volver a pedir datos al backend.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    queryClient.invalidateQueries({ queryKey: ['demand-ranking'] });
  };
  const createMutation = useMutation({
    mutationFn: createWaitlistEntry,
    onSuccess: () => { invalidate(); setShowForm(false); },
  });
  const expireMutation = useMutation({ mutationFn: expireWaitlistEntry, onSuccess: invalidate });
  const assignMutation = useMutation({
    mutationFn: ({ id, slotId }: { id: number; slotId: number }) => assignWaitlistEntry(id, slotId),
    onSuccess: () => { invalidate(); closeAssign(); },
  });

  function openCreate() {
    reset({ patientId: undefined, doctorId: undefined, specialtyId: undefined, prioridad: 'NORMAL' });
    setShowForm(true);
  }

  function openAssign(entry: WaitlistEntry) {
    setAssigning(entry);
    setAssignDoctorId(entry.doctorId);
    setAssignSlotId(null);
  }
  function closeAssign() {
    setAssigning(null);
    setAssignDoctorId(null);
    setAssignSlotId(null);
  }

  const disponibles = slotsForAssign.filter((s) => s.estado === 'DISPONIBLE');
  const doctoresParaAsignar = assigning?.doctorId
    ? doctors.filter((d) => d.id === assigning.doctorId)
    : doctors.filter((d) => d.specialtyId === assigning?.specialtyId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Lista de espera</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ ...ui.input, marginBottom: 0, width: 200 }}>
            <option value="">Todos los estados</option>
            <option value="ESPERANDO">Esperando</option>
            <option value="NOTIFICADO">Notificado</option>
            <option value="ASIGNADO">Asignado</option>
            <option value="EXPIRADO">Expirado</option>
          </select>
          <button style={ui.primaryButton} onClick={openCreate}>
            + Anotar paciente
          </button>
        </div>
      </div>

      {ranking.length > 0 && (
        <div style={{ ...ui.card, padding: '0.75rem 1rem', marginBottom: '1rem', background: 'var(--color-warning-tint)' }}>
          <strong>Ranking de demanda: </strong>
          {ranking.map((r) => `${r.nombre} (${r.demanda})`).join(' · ')}
        </div>
      )}

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Paciente</th>
              <th style={ui.th}>Médico / Especialidad</th>
              <th style={ui.th}>Prioridad</th>
              <th style={ui.th}>Tiempo estimado</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td style={ui.td} colSpan={6}>Cargando...</td></tr>}
            {!isLoading && entries.length === 0 && (
              <tr><td style={ui.td} colSpan={6}>Sin pacientes en lista de espera.</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={ui.td}>{e.patient?.nombres} {e.patient?.apellidos}</td>
                <td style={ui.td}>{e.doctor ? `${e.doctor.nombres} ${e.doctor.apellidos}` : e.specialty?.nombre ?? '—'}</td>
                <td style={ui.td}>{e.prioridad}</td>
                <td style={ui.td}>{tiempoEsperaLabel(e)}</td>
                <td style={ui.td}><span style={ui.badgeColor(e.estado)}>{e.estado}</span></td>
                <td style={ui.td}>
                  {(e.estado === 'ESPERANDO' || e.estado === 'NOTIFICADO') && (
                    <>
                      <button style={{ ...ui.secondaryButton, marginRight: 6 }} onClick={() => openAssign(e)}>
                        Asignar cupo
                      </button>
                      <button
                        style={{ ...ui.secondaryButton, color: 'var(--text-muted)' }}
                        onClick={() => {
                          if (window.confirm(`¿Expirar la espera de ${e.patient?.nombres} ${e.patient?.apellidos}? Ya no se le podrá asignar un cupo desde aquí.`)) {
                            expireMutation.mutate(e.id);
                          }
                        }}
                      >
                        Expirar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Anotar paciente en lista de espera" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit((values) => createMutation.mutate({
            patientId: Number(values.patientId),
            doctorId: values.doctorId ? Number(values.doctorId) : undefined,
            specialtyId: values.specialtyId ? Number(values.specialtyId) : undefined,
            prioridad: values.prioridad,
          }))}>
            <label>Paciente</label>
            <select {...register('patientId', { required: true })} style={ui.input} defaultValue="">
              <option value="" disabled>Seleccionar...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
              ))}
            </select>

            <label>Médico (opcional si eliges especialidad)</label>
            <select {...register('doctorId')} style={ui.input} defaultValue="">
              <option value="">Cualquiera de la especialidad</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.nombres} {d.apellidos}</option>
              ))}
            </select>

            <label>Especialidad (si no eliges médico)</label>
            <select {...register('specialtyId')} style={ui.input} defaultValue="">
              <option value="">—</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>

            <label>Prioridad</label>
            <select {...register('prioridad')} style={ui.input}>
              <option value="NORMAL">Normal</option>
              <option value="URGENTE">Urgente</option>
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={createMutation.isPending} style={{ ...ui.primaryButton, flex: 1 }}>
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {assigning && (
        <Modal title={`Asignar cupo — ${assigning.patient?.nombres} ${assigning.patient?.apellidos}`} onClose={closeAssign}>
          <label>Médico</label>
          <select
            value={assignDoctorId ?? ''}
            onChange={(e) => { setAssignDoctorId(Number(e.target.value)); setAssignSlotId(null); }}
            style={ui.input}
            disabled={!!assigning.doctorId}
          >
            <option value="" disabled>Seleccionar...</option>
            {doctoresParaAsignar.map((d) => (
              <option key={d.id} value={d.id}>{d.nombres} {d.apellidos}</option>
            ))}
          </select>

          <label>Cupo disponible</label>
          <select
            value={assignSlotId ?? ''}
            onChange={(e) => setAssignSlotId(Number(e.target.value))}
            style={ui.input}
            disabled={!assignDoctorId}
          >
            <option value="" disabled>{disponibles.length ? 'Seleccionar...' : 'Sin cupos disponibles'}</option>
            {disponibles.map((s) => (
              <option key={s.id} value={s.id}>{s.fecha.split('T')[0]} — {s.horaInicio}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={closeAssign}>
              Cancelar
            </button>
            <button
              disabled={!assignSlotId || assignMutation.isPending}
              onClick={() => assignSlotId && assignMutation.mutate({ id: assigning.id, slotId: assignSlotId })}
              style={{ ...ui.primaryButton, flex: 1 }}
            >
              Confirmar asignación
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
