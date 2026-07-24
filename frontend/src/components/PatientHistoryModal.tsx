import { useQuery } from '@tanstack/react-query';
import { fetchAppointments, type Triage } from '../api/appointments';
import type { Patient } from '../api/patients';
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
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', 'historial-paciente', patient.id],
    queryFn: () => fetchAppointments({ patientId: patient.id }),
  });

  const historial = [...appointments].sort((a, b) => {
    const fechaCompare = b.fecha.localeCompare(a.fecha);
    return fechaCompare !== 0 ? fechaCompare : b.horaInicio.localeCompare(a.horaInicio);
  });

  return (
    <Modal title={`Historial de ${patient.nombres} ${patient.apellidos}`} onClose={onClose} width={860}>
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
                <td style={ui.td}>{a.doctor?.nombres} {a.doctor?.apellidos}</td>
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
                      <small style={{ color: '#666' }}>{triageSummary(a.triage)}</small>
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
