import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSpecialty, deactivateSpecialty, fetchSpecialties, updateSpecialty, type Specialty } from '../api/specialties';
import { Modal } from '../components/Modal';
import * as ui from '../components/ui';

// El precio de consulta se define acá, una vez por especialidad, y se usa para
// autocompletar el monto pagado al crear una cita (ver AppointmentsPage).
export function SpecialtiesPage() {
  const queryClient = useQueryClient();
  const { data: specialties = [], isLoading } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [precioEditado, setPrecioEditado] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['specialties'] });

  const createMutation = useMutation({
    mutationFn: createSpecialty,
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setNuevoNombre('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; nombre: string; precioConsulta?: number }) =>
      updateSpecialty(input.id, { nombre: input.nombre, precioConsulta: input.precioConsulta }),
    onSuccess: () => {
      invalidate();
      setEditandoId(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSpecialty,
    onSuccess: invalidate,
  });

  function empezarEdicion(s: Specialty) {
    setEditandoId(s.id);
    setNombreEditado(s.nombre);
    setPrecioEditado(s.precioConsulta != null ? String(s.precioConsulta) : '');
  }

  function guardar(id: number) {
    if (!nombreEditado.trim()) return;
    const precio = precioEditado === '' ? undefined : Number(precioEditado);
    if (precio !== undefined && (Number.isNaN(precio) || precio < 0)) return;
    updateMutation.mutate({ id, nombre: nombreEditado.trim(), precioConsulta: precio });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h1>Especialidades</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
            Administra las especialidades y su precio de consulta; se usa para autocompletar el monto pagado al crear una cita.
          </p>
        </div>
        <button style={ui.primaryButton} onClick={() => setShowCreate(true)}>
          + Nueva especialidad
        </button>
      </div>

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Especialidad</th>
              <th style={ui.th}>Precio de consulta (S/)</th>
              <th style={ui.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={ui.td} colSpan={3}>Cargando...</td></tr>
            )}
            {!isLoading && specialties.length === 0 && (
              <tr><td style={ui.td} colSpan={3}>Sin especialidades registradas.</td></tr>
            )}
            {specialties.map((s) => (
              <tr key={s.id}>
                <td style={ui.td}>
                  {editandoId === s.id ? (
                    <input
                      autoFocus
                      value={nombreEditado}
                      onChange={(e) => setNombreEditado(e.target.value)}
                      placeholder="Ej. Cardiología"
                      style={{ ...ui.input, marginBottom: 0, width: 180 }}
                    />
                  ) : (
                    s.nombre
                  )}
                </td>
                <td style={ui.td}>
                  {editandoId === s.id ? (
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={precioEditado}
                      onChange={(e) => setPrecioEditado(e.target.value)}
                      placeholder="Ej. 80"
                      style={{ ...ui.input, marginBottom: 0, width: 140 }}
                    />
                  ) : (
                    s.precioConsulta != null ? `S/ ${s.precioConsulta.toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>Sin definir</span>
                  )}
                </td>
                <td style={ui.td}>
                  {editandoId === s.id ? (
                    <>
                      <button
                        style={{ ...ui.secondaryButton, marginRight: 8 }}
                        disabled={updateMutation.isPending || !nombreEditado.trim()}
                        onClick={() => guardar(s.id)}
                      >
                        Guardar
                      </button>
                      <button style={ui.secondaryButton} onClick={() => setEditandoId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={{ ...ui.secondaryButton, marginRight: 8 }} onClick={() => empezarEdicion(s)}>
                        Editar
                      </button>
                      <button
                        style={{ ...ui.secondaryButton, color: 'var(--color-critical)', borderColor: 'var(--color-critical)' }}
                        disabled={deactivateMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Desactivar la especialidad "${s.nombre}"? Ya no aparecerá disponible para asignar a médicos nuevos ni al agendar citas.`)) {
                            deactivateMutation.mutate(s.id);
                          }
                        }}
                      >
                        Desactivar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nueva especialidad" onClose={() => setShowCreate(false)}>
          <label>Nombre</label>
          <input
            autoFocus
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Ej. Dermatología"
            style={ui.input}
          />
          {createMutation.isError && (
            <p style={{ color: 'var(--color-critical)' }}>No se pudo crear la especialidad. Verifica que el nombre no esté repetido.</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...ui.secondaryButton, flex: 1 }} onClick={() => setShowCreate(false)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={createMutation.isPending || !nuevoNombre.trim()}
              style={{ ...ui.primaryButton, flex: 1 }}
              onClick={() => createMutation.mutate(nuevoNombre.trim())}
            >
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
