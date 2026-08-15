import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  createAvailability,
  deactivateAvailability,
  fetchAvailabilityByDoctor,
  generateSlots,
  updateAvailability,
  type WeeklyAvailability,
} from '../api/schedules';
import type { Doctor } from '../api/doctors';
import { Modal } from './Modal';
import * as ui from './ui';

const DIA_LABEL: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  0: 'Domingo',
};
const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];

interface ScheduleForm {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  duracionSlotMinutos: string;
}

interface DoctorScheduleModalProps {
  doctor: Doctor;
  // Solo el administrador puede crear/editar/desactivar horarios y generar cupos (mismos
  // @Roles(ADMIN) que schedules.controller.ts en el backend); los demás roles solo consultan.
  puedeEditar: boolean;
  onClose: () => void;
}

const FORM_DEFAULTS: ScheduleForm = { diaSemana: '1', horaInicio: '08:00', horaFin: '12:00', duracionSlotMinutos: '20' };

export function DoctorScheduleModal({ doctor, puedeEditar, onClose }: DoctorScheduleModalProps) {
  const queryClient = useQueryClient();
  const [cuposGenerados, setCuposGenerados] = useState<number | null>(null);
  const [cuposLimpiados, setCuposLimpiados] = useState<number | null>(null);
  const [editing, setEditing] = useState<WeeklyAvailability | null>(null);

  const { data: availability = [], isLoading } = useQuery({
    queryKey: ['availability', doctor.id],
    queryFn: () => fetchAvailabilityByDoctor(doctor.id),
  });

  const { register, handleSubmit, reset } = useForm<ScheduleForm>({
    defaultValues: FORM_DEFAULTS,
  });

  function avisarLimpieza(resultado: WeeklyAvailability) {
    if (resultado.cuposEliminados) setCuposLimpiados(resultado.cuposEliminados);
  }

  const createMutation = useMutation({
    mutationFn: (values: ScheduleForm) =>
      createAvailability({
        doctorId: doctor.id,
        diaSemana: Number(values.diaSemana),
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        duracionSlotMinutos: Number(values.duracionSlotMinutos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', doctor.id] });
      reset(FORM_DEFAULTS);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: ScheduleForm) =>
      updateAvailability(editing!.id, {
        diaSemana: Number(values.diaSemana),
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        duracionSlotMinutos: Number(values.duracionSlotMinutos),
      }),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['availability', doctor.id] });
      avisarLimpieza(resultado);
      cancelarEdicion();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAvailability,
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['availability', doctor.id] });
      avisarLimpieza(resultado);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSlots(),
    onSuccess: (creados) => setCuposGenerados(creados),
  });

  function editar(a: WeeklyAvailability) {
    setEditing(a);
    reset({
      diaSemana: String(a.diaSemana),
      horaInicio: a.horaInicio,
      horaFin: a.horaFin,
      duracionSlotMinutos: String(a.duracionSlotMinutos),
    });
  }

  function cancelarEdicion() {
    setEditing(null);
    reset(FORM_DEFAULTS);
  }

  return (
    <Modal title={`Horarios — ${doctor.nombres} ${doctor.apellidos}`} onClose={onClose} width={640}>
      {!puedeEditar && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Solo el administrador puede crear, editar o desactivar horarios. Esta vista es de solo consulta.
        </p>
      )}
      {puedeEditar && editing && (
        <p style={{ fontSize: 13, color: 'var(--color-primary-dark)', marginBottom: 8 }}>
          Editando el horario de {DIA_LABEL[editing.diaSemana]}. Los cupos ya reservados no se tocan; los que
          queden fuera del horario nuevo se eliminan solo si todavía estaban disponibles.
        </p>
      )}
      {puedeEditar && (
        <form
          onSubmit={handleSubmit((values) => (editing ? updateMutation.mutate(values) : createMutation.mutate(values)))}
          style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}
        >
          <div>
            <label>Día</label>
            <select {...register('diaSemana')} style={{ ...ui.input, width: 120 }}>
              {DIAS_ORDEN.map((d) => (
                <option key={d} value={d}>{DIA_LABEL[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Hora inicio</label>
            <input type="time" {...register('horaInicio', { required: true })} style={{ ...ui.input, width: 110 }} />
          </div>
          <div>
            <label>Hora fin</label>
            <input type="time" {...register('horaFin', { required: true })} style={{ ...ui.input, width: 110 }} />
          </div>
          <div>
            <label>Duración cupo (min)</label>
            <input type="number" min={5} placeholder="20" {...register('duracionSlotMinutos', { required: true })} style={{ ...ui.input, width: 90 }} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            style={{ ...ui.primaryButton, marginBottom: '1rem' }}
          >
            {editing ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editing && (
            <button type="button" style={{ ...ui.secondaryButton, marginBottom: '1rem' }} onClick={cancelarEdicion}>
              Cancelar edición
            </button>
          )}
        </form>
      )}
      {puedeEditar && (createMutation.isError || updateMutation.isError) && (
        <p style={{ color: 'var(--color-critical)' }}>No se pudo guardar el horario. Verifica que la hora de inicio sea anterior a la de fin.</p>
      )}
      {puedeEditar && cuposLimpiados !== null && cuposLimpiados > 0 && (
        <p style={{ color: 'var(--color-warning)', marginBottom: 12 }}>
          Se eliminaron {cuposLimpiados} cupo(s) disponible(s) que ya no correspondían al horario nuevo.
        </p>
      )}

      <table style={ui.table}>
        <thead>
          <tr>
            <th style={ui.th}>Día</th>
            <th style={ui.th}>Hora inicio</th>
            <th style={ui.th}>Hora fin</th>
            <th style={ui.th}>Duración cupo</th>
            {puedeEditar && <th style={ui.th}>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td style={ui.td} colSpan={puedeEditar ? 5 : 4}>Cargando...</td></tr>
          )}
          {!isLoading && availability.length === 0 && (
            <tr><td style={ui.td} colSpan={puedeEditar ? 5 : 4}>Sin horario configurado. Sin esto, el médico nunca tendrá cupos disponibles.</td></tr>
          )}
          {availability.map((a) => (
            <tr key={a.id}>
              <td style={ui.td}>{DIA_LABEL[a.diaSemana]}</td>
              <td style={ui.td}>{a.horaInicio}</td>
              <td style={ui.td}>{a.horaFin}</td>
              <td style={ui.td}>{a.duracionSlotMinutos} min</td>
              {puedeEditar && (
                <td style={ui.td}>
                  <button
                    style={{ ...ui.secondaryButton, marginRight: 8 }}
                    disabled={updateMutation.isPending}
                    onClick={() => editar(a)}
                  >
                    Editar
                  </button>
                  <button
                    style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                    disabled={deactivateMutation.isPending}
                    onClick={() => deactivateMutation.mutate(a.id)}
                  >
                    Desactivar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {puedeEditar && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Después de agregar o cambiar el horario, genera los cupos de los próximos 30 días para que
            queden disponibles al crear citas.
          </p>
          <button
            type="button"
            style={ui.primaryButton}
            disabled={generateMutation.isPending || availability.length === 0}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? 'Generando...' : 'Generar cupos ahora'}
          </button>
          {cuposGenerados !== null && (
            <p style={{ color: 'var(--color-good)', marginTop: 8 }}>
              {cuposGenerados > 0 ? `${cuposGenerados} cupo(s) nuevo(s) generado(s).` : 'No se generaron cupos nuevos (ya existían todos).'}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
