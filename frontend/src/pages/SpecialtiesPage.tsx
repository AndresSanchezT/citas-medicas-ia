import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSpecialties, updateSpecialtyPrecio, type Specialty } from '../api/specialties';
import * as ui from '../components/ui';

// El precio de consulta se define acá, una vez por especialidad, y se usa para
// autocompletar el monto pagado al crear una cita (ver AppointmentsPage).
export function SpecialtiesPage() {
  const queryClient = useQueryClient();
  const { data: specialties = [], isLoading } = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [valor, setValor] = useState('');

  const mutation = useMutation({
    mutationFn: (input: { id: number; precioConsulta: number }) => updateSpecialtyPrecio(input.id, input.precioConsulta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
      setEditandoId(null);
    },
  });

  function empezarEdicion(s: Specialty) {
    setEditandoId(s.id);
    setValor(s.precioConsulta != null ? String(s.precioConsulta) : '');
  }

  function guardar(id: number) {
    const precio = Number(valor);
    if (!valor || Number.isNaN(precio) || precio < 0) return;
    mutation.mutate({ id, precioConsulta: precio });
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h1>Especialidades</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
          Define el precio de consulta de cada especialidad; se usa para autocompletar el monto pagado al crear una cita.
        </p>
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
                <td style={ui.td}>{s.nombre}</td>
                <td style={ui.td}>
                  {editandoId === s.id ? (
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      autoFocus
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
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
                        disabled={mutation.isPending}
                        onClick={() => guardar(s.id)}
                      >
                        Guardar
                      </button>
                      <button style={ui.secondaryButton} onClick={() => setEditandoId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button style={ui.secondaryButton} onClick={() => empezarEdicion(s)}>
                      Editar precio
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
