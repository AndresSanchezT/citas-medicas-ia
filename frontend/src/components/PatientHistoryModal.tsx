import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAppointments, type Triage } from '../api/appointments';
import { fetchTriageSummary, type Patient } from '../api/patients';
import { ESTADO_LABEL, PRIORIDAD_LABEL } from './AppointmentActions';
import { Modal } from './Modal';
import * as ui from './ui';

interface PatientHistoryModalProps {
  patient: Patient;
  onClose: () => void;
}

function triageSummary(triage: Triage): string {
  const partes: string[] = [];
  if (triage.presionSistolica && triage.presionDiastolica) {
    partes.push(`PA ${triage.presionSistolica}/${triage.presionDiastolica}`);
  }
  if (triage.frecuenciaCardiaca) partes.push(`FC ${triage.frecuenciaCardiaca}`);
  if (triage.temperatura) partes.push(`T° ${triage.temperatura}`);
  return partes.join(' · ') || 'Registrado';
}

export function PatientHistoryModal({ patient, onClose }: PatientHistoryModalProps) {
  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['appointments', 'historial-paciente', patient.id],
    queryFn: () => fetchAppointments({ patientId: patient.id }),
  });
  const appointments = appointmentsResponse?.data ?? [];

  const historial = [...appointments].sort((a, b) => {
    const fechaCompare = b.fecha.localeCompare(a.fecha);
    return fechaCompare !== 0 ? fechaCompare : b.horaInicio.localeCompare(a.horaInicio);
  });

  const summaryMutation = useMutation({
    mutationFn: () => fetchTriageSummary(patient.id),
  });

  return (
    <Modal title={`Historial de ${patient.nombres} ${patient.apellidos}`} onClose={onClose} width={860}>
      <div style={{ marginBottom: '1rem' }}>
        <button
          style={ui.secondaryButton}
          disabled={summaryMutation.isPending}
          onClick={() => summaryMutation.mutate()}
        >
          {summaryMutation.isPending ? 'Analizando triaje...' : '✨ Generar resumen de evolución con IA'}
        </button>

        {summaryMutation.data && (
          <div style={{ ...ui.card, marginTop: 10, padding: '0.9rem 1.1rem', background: 'var(--color-primary-tint)' }}>
            {summaryMutation.data.disponible ? (
              <>
                {summaryMutation.data.primerTriaje && summaryMutation.data.ultimoTriaje && (
                  <p style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Comparando el triaje del <strong>{summaryMutation.data.primerTriaje}</strong> con el del{' '}
                    <strong>{summaryMutation.data.ultimoTriaje}</strong> ({summaryMutation.data.totalTriajesConsiderados} triajes en el historial).
                  </p>
                )}
                <p style={{ marginBottom: 8 }}>{summaryMutation.data.mensaje}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {summaryMutation.data.hallazgos.map((h) => (
                    <span key={h.campo} style={{ ...ui.badgeColor(h.tendencia), fontSize: 12 }}>
                      {h.campo}: {h.detalle}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ marginBottom: 8 }}>{summaryMutation.data.mensaje}</p>
            )}
            <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{summaryMutation.data.disclaimer}</small>
          </div>
        )}
      </div>

      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Médico</th>
              <th style={ui.th}>Motivo</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Espera real</th>
              <th style={ui.th}>Triaje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td style={ui.td} colSpan={6}>Cargando...</td></tr>
            )}
            {!isLoading && historial.length === 0 && (
              <tr><td style={ui.td} colSpan={6}>Este paciente no tiene citas registradas.</td></tr>
            )}
            {historial.map((a) => (
              <tr key={a.id}>
                <td style={ui.td}>{a.fecha.split('T')[0]} {a.horaInicio}</td>
                <td style={ui.td}>
                  {a.doctor?.nombres} {a.doctor?.apellidos}
                  {a.doctor?.specialty?.nombre && (
                    <div>
                      <small style={{ color: 'var(--text-muted)' }}>{a.doctor.specialty.nombre}</small>
                    </div>
                  )}
                </td>
                <td style={ui.td}>{a.motivoConsulta ?? '—'}</td>
                <td style={ui.td}><span style={ui.badgeColor(a.estado)}>{ESTADO_LABEL[a.estado]}</span></td>
                <td style={ui.td}>
                  {a.waitTimeHistory ? `${a.waitTimeHistory.tiempoEsperaMinutosReal} min` : '—'}
                </td>
                <td style={ui.td}>
                  {a.triage ? (
                    <>
                      {a.triage.prioridad && (
                        <div><span style={ui.badgeColor(a.triage.prioridad)}>{PRIORIDAD_LABEL[a.triage.prioridad]}</span></div>
                      )}
                      <small style={{ color: 'var(--text-secondary)' }}>{triageSummary(a.triage)}</small>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
