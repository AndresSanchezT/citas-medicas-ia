import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DashboardPoint, DoctorRankingItem, OccupancyPoint } from '../api/reports';

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const PERIOD_LABEL: Record<'month' | 'quarter' | 'year', string> = {
  month: 'Mensual',
  quarter: 'Trimestral',
  year: 'Anual',
};

const HEADER_FILL: [number, number, number] = [42, 120, 214];

function addHeader(doc: jsPDF, subtitle: string): number {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Clínica Amazonas', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleString('es-PE')}`, 14, 32);
  doc.setTextColor(0);
  return 40;
}

function addSectionTitle(doc: DocWithAutoTable, title: string, y: number): number {
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

export function downloadManagementReportPdf(params: {
  period: 'month' | 'quarter' | 'year';
  dashboard: DashboardPoint[];
  ranking: DoctorRankingItem[];
  occupancy: OccupancyPoint[];
}) {
  const { period, dashboard, ranking, occupancy } = params;
  const doc = new jsPDF() as DocWithAutoTable;
  let y = addHeader(doc, `Reporte gerencial — periodo ${PERIOD_LABEL[period]}`);

  y = addSectionTitle(doc, 'Tendencia de citas completadas / inasistencias', y);
  autoTable(doc, {
    startY: y,
    head: [['Periodo', 'Completadas', 'Inasistencias', '% Inasistencia', 'Espera prom. (min)']],
    body: dashboard.map((d) => [
      d.periodo,
      d.totalCitasCompletadas,
      d.totalNoShow,
      `${d.porcentajeNoShow}%`,
      d.tiempoEsperaPromedioMinutos ?? '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  y = addSectionTitle(doc, 'Ranking de médicos por pacientes atendidos', y);
  autoTable(doc, {
    startY: y,
    head: [['Médico', 'Especialidad', 'Pacientes atendidos']],
    body: ranking.map((r) => [r.nombre, r.especialidad, r.totalPacientesAtendidos]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  y = addSectionTitle(doc, 'Ocupación por franja horaria', y);
  autoTable(doc, {
    startY: y,
    head: [['Franja horaria', 'Pacientes']],
    body: occupancy.map((o) => [o.franjaHoraria, o.totalPacientes]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`reporte-gerencial-${period}-${fecha}.pdf`);
}
