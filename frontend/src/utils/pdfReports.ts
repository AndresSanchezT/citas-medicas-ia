import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CitaConcurrida,
  CostoPorEspecialidad,
  DashboardPoint,
  DoctorRankingItem,
  OccupancyPoint,
  WaitTimeWeeklyPoint,
} from '../api/reports';

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface ChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

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

function addSubsectionTitle(doc: DocWithAutoTable, title: string, y: number): number {
  if (y > 265) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(60);
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  return y + 5;
}

// Inserta la captura del gráfico (tomada del navegador con html2canvas) como imagen,
// respetando su proporción real para que no salga estirado.
function addChartImage(doc: DocWithAutoTable, chart: ChartImage | undefined, y: number): number {
  if (!chart) return y;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 28;
  const displayWidth = Math.min(maxWidth, 170);
  const displayHeight = displayWidth * (chart.height / chart.width);
  if (y + displayHeight > 285) {
    doc.addPage();
    y = 20;
  }
  doc.addImage(chart.dataUrl, 'PNG', 14, y, displayWidth, displayHeight);
  return y + displayHeight + 8;
}

const SEMANA_FORMATTER = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
function formatSemana(iso: string): string {
  return SEMANA_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function downloadManagementReportPdf(params: {
  period: 'month' | 'quarter' | 'year';
  dashboard: DashboardPoint[];
  ranking: DoctorRankingItem[];
  occupancy: OccupancyPoint[];
  waitTimeWeekly: WaitTimeWeeklyPoint[];
  costos: CostoPorEspecialidad[];
  concurridas: CitaConcurrida[];
  charts?: {
    dashboard?: ChartImage;
    doctorRanking?: ChartImage;
    occupancy?: ChartImage;
    waitTimeWeekly?: ChartImage;
    costos?: ChartImage;
  };
}) {
  const { period, dashboard, ranking, occupancy, waitTimeWeekly, costos, concurridas, charts } = params;
  const doc = new jsPDF() as DocWithAutoTable;
  let y = addHeader(doc, `Reporte gerencial — periodo ${PERIOD_LABEL[period]}`);

  y = addSectionTitle(doc, 'Tendencia de citas completadas / inasistencias', y);
  y = addChartImage(doc, charts?.dashboard, y);
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
  y = addChartImage(doc, charts?.doctorRanking, y);
  autoTable(doc, {
    startY: y,
    head: [['Médico', 'Especialidad', 'Pacientes atendidos']],
    body: ranking.map((r) => [r.nombre, r.especialidad, r.totalPacientesAtendidos]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  y = addSectionTitle(doc, 'Ocupación por franja horaria y especialidad', y);
  y = addChartImage(doc, charts?.occupancy, y);
  const especialidadesOcupacion = [...new Set(occupancy.map((o) => o.especialidad))].sort((a, b) => a.localeCompare(b, 'es'));
  for (const especialidad of especialidadesOcupacion) {
    y = addSubsectionTitle(doc, especialidad, y);
    autoTable(doc, {
      startY: y,
      head: [['Franja horaria', 'Pacientes']],
      body: occupancy
        .filter((o) => o.especialidad === especialidad)
        .sort((a, b) => a.franjaHoraria.localeCompare(b.franjaHoraria))
        .map((o) => [o.franjaHoraria, o.totalPacientes]),
      theme: 'striped',
      headStyles: { fillColor: HEADER_FILL },
      styles: { fontSize: 9 },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
  }

  y = addSectionTitle(doc, 'Tiempo de espera semanal por especialidad', y);
  y = addChartImage(doc, charts?.waitTimeWeekly, y);
  const especialidadesEspera = [...new Set(waitTimeWeekly.map((w) => w.especialidad))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  for (const especialidad of especialidadesEspera) {
    y = addSubsectionTitle(doc, especialidad, y);
    autoTable(doc, {
      startY: y,
      head: [['Semana', 'Espera prom. (min)']],
      body: waitTimeWeekly
        .filter((w) => w.especialidad === especialidad)
        .sort((a, b) => a.semana.localeCompare(b.semana))
        .map((w) => [formatSemana(w.semana), w.tiempoEsperaPromedioMinutos]),
      theme: 'striped',
      headStyles: { fillColor: HEADER_FILL },
      styles: { fontSize: 9 },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
  }

  y = addSectionTitle(doc, 'Reporte de costos: ingresos por especialidad', y);
  y = addChartImage(doc, charts?.costos, y);
  autoTable(doc, {
    startY: y,
    head: [['Especialidad', 'Total citas pagadas', 'Ingreso total (S/)']],
    body: costos.map((c) => [c.especialidad, c.totalCitas, c.ingresoTotal.toFixed(2)]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  y = addSectionTitle(doc, 'Citas más concurridas (día y franja horaria)', y);
  autoTable(doc, {
    startY: y,
    head: [['Día', 'Franja horaria', 'Total citas']],
    body: concurridas.map((c) => [c.dia, c.franjaHoraria, c.totalCitas]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`reporte-gerencial-${period}-${fecha}.pdf`);
}
