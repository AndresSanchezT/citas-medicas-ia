import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import type { AppointmentSlot } from '../api/schedules';
import * as ui from './ui';

interface SlotCalendarPickerProps {
  slots: AppointmentSlot[];
  value: number | null;
  onChange: (slotId: number) => void;
}

const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Reemplaza el <select> plano de "Cupo disponible" por un calendario: los días con cupos
// se ven resaltados, se hace clic en el día y después se elige la hora entre los cupos
// de ese día. Se calcula todo en el cliente a partir de los slots ya cargados — no pide
// nada nuevo al backend.
export function SlotCalendarPicker({ slots, value, onChange }: SlotCalendarPickerProps) {
  const porFecha = useMemo(() => {
    const map = new Map<string, AppointmentSlot[]>();
    for (const slot of slots) {
      const fecha = slot.fecha.split('T')[0];
      if (!map.has(fecha)) map.set(fecha, []);
      map.get(fecha)!.push(slot);
    }
    for (const lista of map.values()) lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    return map;
  }, [slots]);

  const fechasConCupo = useMemo(
    () => Array.from(porFecha.keys()).sort(),
    [porFecha],
  );

  // `slots` casi siempre llega como un arreglo nuevo en cada render (ej. un `.filter()`
  // inline en el componente que llama a este), aunque su contenido no haya cambiado en
  // realidad. Comparar por esta "firma" (en vez de por la referencia del arreglo) evita
  // que elegir una hora dispare el efecto de abajo y cierre la vista de horarios que el
  // usuario recién abrió — antes pasaba porque onChange() actualiza el estado del padre,
  // ese re-render recalculaba `slots` con una referencia distinta, y el efecto lo tomaba
  // como "cambió de médico" y reiniciaba la selección.
  const firmaSlots = useMemo(() => slots.map((s) => s.id).sort((a, b) => a - b).join(','), [slots]);

  const [mes, setMes] = useState(() => dayjs(fechasConCupo[0] ?? undefined));
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);

  // Si cambia el conjunto real de cupos (ej. se eligió otro médico), se reinicia la
  // selección y el calendario salta al primer mes que tenga disponibilidad.
  useEffect(() => {
    setFechaSeleccionada(null);
    setMes(dayjs(fechasConCupo[0] ?? undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaSlots]);

  const inicioMes = mes.startOf('month');
  const diasEnMes = mes.daysInMonth();
  const primerDiaSemana = inicioMes.day();
  const celdas: (dayjs.Dayjs | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => inicioMes.add(i, 'day')),
  ];

  const slotsDelDia = fechaSeleccionada ? (porFecha.get(fechaSeleccionada) ?? []) : [];

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" style={{ ...ui.secondaryButton, padding: '0.25rem 0.6rem' }} onClick={() => setMes(mes.subtract(1, 'month'))}>
          ←
        </button>
        <strong style={{ fontSize: 13.5, textTransform: 'capitalize' }}>{mes.format('MMMM YYYY')}</strong>
        <button type="button" style={{ ...ui.secondaryButton, padding: '0.25rem 0.6rem' }} onClick={() => setMes(mes.add(1, 'month'))}>
          →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 8 }}>
        {DIAS_CORTOS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
        ))}
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} />;
          const key = dia.format('YYYY-MM-DD');
          const tieneCupo = porFecha.has(key);
          const seleccionado = fechaSeleccionada === key;
          return (
            <button
              type="button"
              key={i}
              disabled={!tieneCupo}
              onClick={() => setFechaSeleccionada(key)}
              style={{
                aspectRatio: '1',
                border: seleccionado ? '1.5px solid var(--color-primary)' : '1px solid transparent',
                borderRadius: 6,
                fontSize: 12.5,
                background: seleccionado
                  ? 'var(--color-primary-tint-strong)'
                  : tieneCupo
                    ? 'var(--color-primary-tint)'
                    : 'transparent',
                color: tieneCupo ? 'var(--text)' : 'var(--text-muted)',
                cursor: tieneCupo ? 'pointer' : 'default',
                fontWeight: seleccionado ? 700 : 400,
              }}
            >
              {dia.date()}
            </button>
          );
        })}
      </div>

      {fechasConCupo.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Sin cupos disponibles para este médico.</p>
      )}

      {fechaSeleccionada && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Horarios del {dayjs(fechaSeleccionada).format('DD/MM/YYYY')}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {slotsDelDia.map((slot) => (
              <button
                type="button"
                key={slot.id}
                onClick={() => onChange(slot.id)}
                style={{
                  ...ui.secondaryButton,
                  marginRight: 0,
                  ...(value === slot.id
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : {}),
                }}
              >
                {slot.horaInicio}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
