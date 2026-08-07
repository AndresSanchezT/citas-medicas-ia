import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CitaConcurrida,
  CitaPorEspecialidad,
  CostoPorEspecialidad,
  DashboardPoint,
  DoctorRankingItem,
  OccupancyPoint,
  TiempoConsultaPorEspecialidad,
  WaitTimeWeeklyPoint,
} from '../api/reports';

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface ChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

const PERIOD_LABEL: Record<'week' | 'month' | 'quarter' | 'year', string> = {
  week: 'Semanal',
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

// Las tablas por especialidad (ocupación por hora, espera semanal) solo tienen 2 columnas
// angostas: apilarlas una debajo de otra desperdicia la mitad del ancho de la hoja. Esto
// las acomoda de a 2 por fila, cada una a la mitad del ancho disponible.
function addTablasPorEspecialidadEnPares(
  doc: DocWithAutoTable,
  especialidades: string[],
  headRow: string[],
  bodyFor: (especialidad: string) => (string | number)[][],
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 8;
  const colWidth = (pageWidth - margin * 2 - gap) / 2;
  const col2X = margin + colWidth + gap;
  // Aproximación del alto que jspdf-autotable usa a fontSize 9: ~8mm de encabezado
  // + ~6.5mm por fila. Sirve para decidir el salto de página ANTES de dibujar el par,
  // en vez de dejar que autoTable pagine una sola columna a mitad de tabla y descuadre
  // la otra (eso es lo que pasaba antes: la fila derecha quedaba huérfana en la página
  // siguiente, en una posición completamente distinta a la izquierda).
  const estimarAlto = (filas: number) => 8 + filas * 6.5;

  let y = startY;
  for (let i = 0; i < especialidades.length; i += 2) {
    const izquierda = especialidades[i];
    const derecha = especialidades[i + 1] as string | undefined;
    const bodyIzquierda = bodyFor(izquierda);
    const bodyDerecha = derecha ? bodyFor(derecha) : [];

    const altoPar = 5 + estimarAlto(Math.max(bodyIzquierda.length, bodyDerecha.length));
    if (y + altoPar > 283) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(60);
    doc.text(izquierda, margin, y);
    if (derecha) doc.text(derecha, col2X, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const yTabla = y + 5;

    autoTable(doc, {
      startY: yTabla,
      margin: { left: margin },
      tableWidth: colWidth,
      head: [headRow],
      body: bodyIzquierda,
      theme: 'striped',
      headStyles: { fillColor: HEADER_FILL },
      styles: { fontSize: 9 },
      pageBreak: 'avoid',
    });
    const finalYIzquierda = doc.lastAutoTable?.finalY ?? yTabla;

    let finalYDerecha = yTabla;
    if (derecha) {
      autoTable(doc, {
        startY: yTabla,
        margin: { left: col2X },
        tableWidth: colWidth,
        head: [headRow],
        body: bodyDerecha,
        theme: 'striped',
        headStyles: { fillColor: HEADER_FILL },
        styles: { fontSize: 9 },
        pageBreak: 'avoid',
      });
      finalYDerecha = doc.lastAutoTable?.finalY ?? yTabla;
    }

    y = Math.max(finalYIzquierda, finalYDerecha) + 10;
  }
  return y;
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
  period: 'week' | 'month' | 'quarter' | 'year';
  dashboard: DashboardPoint[];
  ranking: DoctorRankingItem[];
  occupancy: OccupancyPoint[];
  waitTimeWeekly: WaitTimeWeeklyPoint[];
  costos: CostoPorEspecialidad[];
  concurridas: CitaConcurrida[];
  citasPorEspecialidad: CitaPorEspecialidad[];
  tiempoConsulta: TiempoConsultaPorEspecialidad[];
  charts?: {
    dashboard?: ChartImage;
    doctorRanking?: ChartImage;
    occupancy?: ChartImage;
    waitTimeWeekly?: ChartImage;
    costos?: ChartImage;
    citasPorEspecialidad?: ChartImage;
    tiempoConsulta?: ChartImage;
  };
}) {
  const { period, dashboard, ranking, occupancy, waitTimeWeekly, costos, concurridas, citasPorEspecialidad, tiempoConsulta, charts } = params;
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
  y = addTablasPorEspecialidadEnPares(
    doc,
    especialidadesOcupacion,
    ['Franja horaria', 'Pacientes'],
    (especialidad) =>
      occupancy
        .filter((o) => o.especialidad === especialidad)
        .sort((a, b) => a.franjaHoraria.localeCompare(b.franjaHoraria))
        .map((o) => [o.franjaHoraria, o.totalPacientes]),
    y,
  );

  y = addSectionTitle(doc, 'Tiempo de espera semanal por especialidad', y);
  y = addChartImage(doc, charts?.waitTimeWeekly, y);
  const especialidadesEspera = [...new Set(waitTimeWeekly.map((w) => w.especialidad))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  y = addTablasPorEspecialidadEnPares(
    doc,
    especialidadesEspera,
    ['Semana', 'Espera prom. (min)'],
    (especialidad) =>
      waitTimeWeekly
        .filter((w) => w.especialidad === especialidad)
        .sort((a, b) => a.semana.localeCompare(b.semana))
        .map((w) => [formatSemana(w.semana), w.tiempoEsperaPromedioMinutos]),
    y,
  );

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

  y = addSectionTitle(doc, 'Especialidad más solicitada (total de citas)', y);
  y = addChartImage(doc, charts?.citasPorEspecialidad, y);
  autoTable(doc, {
    startY: y,
    head: [['Especialidad', 'Total citas']],
    body: citasPorEspecialidad.map((c) => [c.especialidad, c.totalCitas]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_FILL },
    styles: { fontSize: 9 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 12;

  y = addSectionTitle(doc, 'Tiempo de consulta promedio por especialidad', y);
  y = addChartImage(doc, charts?.tiempoConsulta, y);
  autoTable(doc, {
    startY: y,
    head: [['Especialidad', 'Duración promedio (min)', 'Consultas consideradas']],
    body: tiempoConsulta.map((t) => [t.especialidad, t.tiempoConsultaPromedioMinutos, t.totalConsultas]),
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
