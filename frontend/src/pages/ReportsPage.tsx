import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  getCitasMasConcurridas,
  getCitasPorEspecialidad,
  getCostosPorEspecialidad,
  getDashboard,
  getDoctorRanking,
  getRetencionIngresos,
  getScheduleOccupancy,
  getTiempoConsultaPorEspecialidad,
  getWaitTimeWeekly,
  type OccupancyPoint,
  type OccupancyWeeklyPoint,
  type WaitTimeWeeklyPoint,
} from '../api/reports';
import { downloadManagementReportPdf, type ChartImage, type SeccionReporte } from '../utils/pdfReports';
import { colorForIndex } from '../utils/categoricalPalette';
import * as ui from '../components/ui';

// Paleta validada (colorblind-safe, ver skill de dataviz): un color por pestaña para que
// cada sección del reporte se reconozca de un vistazo — azul (General), verde (Finanzas),
// naranja (Tiempos), violeta (Demanda) — más rojo fijo de estado crítico para inasistencias.
const PALETTE = {
  primary: '#2a78d6',
  good: '#0ca30c',
  critical: '#c23636',
  warning: '#b5790f',
  violet: '#5c4aa8',
  teal: '#0f8a72',
};

const PERIOD_LABEL: Record<Period, string> = { week: 'Semanal', month: 'Mensual', quarter: 'Trimestral', year: 'Anual' };
type Period = 'week' | 'month' | 'quarter' | 'year';
type Tab = SeccionReporte;

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'tiempos', label: 'Tiempos' },
  { id: 'demanda', label: 'Demanda' },
];

const SEMANA_FORMATTER = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' });
function formatSemana(iso: string): string {
  return SEMANA_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

// El backend devuelve formato largo (una fila por clave+especialidad); Recharts necesita
// una fila por clave (semana o franja horaria) con una columna por especialidad, para
// dibujar una serie por cada una.
function pivotPorEspecialidad<T extends { especialidad: string; totalPacientes?: number; tiempoEsperaPromedioMinutos?: number }>(
  points: T[],
  keyField: 'semana' | 'franjaHoraria',
  valueField: 'totalPacientes' | 'tiempoEsperaPromedioMinutos',
) {
  const especialidades = Array.from(new Set(points.map((p) => p.especialidad))).sort();
  const porKey = new Map<string, Record<string, number | string>>();
  for (const p of points) {
    const key = (p as unknown as Record<string, string>)[keyField];
    if (!porKey.has(key)) porKey.set(key, { [keyField]: key });
    porKey.get(key)![p.especialidad] = (p as unknown as Record<string, number>)[valueField];
  }
  const rows = Array.from(porKey.values()).sort((a, b) => String(a[keyField]).localeCompare(String(b[keyField])));
  return { rows, especialidades };
}

function KpiIcon({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10, background: tone ? `${tone}22` : 'var(--color-primary-tint)',
      color: tone ?? 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  return (
    <div style={{ ...ui.card, padding: '1.1rem 1.25rem', flex: 1 }}>
      <KpiIcon tone={tone}>{icon}</KpiIcon>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  captureRef,
  headerExtra,
}: {
  title: string;
  children: React.ReactNode;
  captureRef?: React.RefObject<HTMLDivElement | null>;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div style={{ ...ui.card, padding: '1.1rem 1.25rem', flex: '1 1 400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{title}</h3>
        {headerExtra}
      </div>
      <div ref={captureRef}>{children}</div>
    </div>
  );
}

// Captura un ChartCard como imagen PNG (usado al armar el PDF) para que el reporte
// gerencial muestre el gráfico tal cual se ve en pantalla, no solo la tabla de datos.
async function capturarGrafico(ref: React.RefObject<HTMLDivElement | null>): Promise<ChartImage | undefined> {
  if (!ref.current) return undefined;
  const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

// Da tiempo a que Recharts termine de dibujar el SVG de la pestaña recién activada antes
// de capturarlo con html2canvas (si no, la imagen sale en blanco o a medio renderizar).
function esperarRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 80)));
  });
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState<Tab>('general');
  const [vistaOcupacion, setVistaOcupacion] = useState<'hora' | 'semana'>('hora');
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const doctorRankingRef = useRef<HTMLDivElement>(null);
  const occupancyRef = useRef<HTMLDivElement>(null);
  const waitTimeRef = useRef<HTMLDivElement>(null);
  const costosRef = useRef<HTMLDivElement>(null);
  const citasEspecialidadRef = useRef<HTMLDivElement>(null);
  const tiempoConsultaRef = useRef<HTMLDivElement>(null);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => getDashboard(period),
  });
  const rankingQuery = useQuery({ queryKey: ['doctor-ranking'], queryFn: getDoctorRanking });
  const occupancyQuery = useQuery({ queryKey: ['schedule-occupancy'], queryFn: getScheduleOccupancy });
  const waitTimeWeeklyQuery = useQuery({ queryKey: ['wait-time-weekly'], queryFn: getWaitTimeWeekly });
  const retencionQuery = useQuery({ queryKey: ['retencion-ingresos'], queryFn: getRetencionIngresos });
  const costosQuery = useQuery({ queryKey: ['costos-por-especialidad'], queryFn: getCostosPorEspecialidad });
  const concurridasQuery = useQuery({ queryKey: ['citas-mas-concurridas'], queryFn: getCitasMasConcurridas });
  const citasEspecialidadQuery = useQuery({ queryKey: ['citas-por-especialidad'], queryFn: getCitasPorEspecialidad });
  const tiempoConsultaQuery = useQuery({ queryKey: ['tiempo-consulta-por-especialidad'], queryFn: getTiempoConsultaPorEspecialidad });

  const data = dashboardQuery.data ?? [];
  const totalCompletadas = data.reduce((sum, d) => sum + d.totalCitasCompletadas, 0);
  const totalNoShow = data.reduce((sum, d) => sum + d.totalNoShow, 0);
  const porcentajeInasistenciaGlobal =
    totalCompletadas + totalNoShow > 0 ? Math.round((totalNoShow / (totalCompletadas + totalNoShow)) * 100) : 0;
  const promedioEspera =
    data.length > 0
      ? Math.round(data.reduce((sum, d) => sum + (d.tiempoEsperaPromedioMinutos ?? 0), 0) / data.length)
      : 0;

  const costos = costosQuery.data ?? [];
  const ingresosTotales = costos.reduce((sum, c) => sum + c.ingresoTotal, 0);
  const citasPagadas = costos.reduce((sum, c) => sum + c.totalCitas, 0);

  const tiempoConsulta = tiempoConsultaQuery.data ?? [];
  const totalConsultasConTiempo = tiempoConsulta.reduce((sum, t) => sum + t.totalConsultas, 0);
  const tiempoConsultaPromedioGlobal =
    totalConsultasConTiempo > 0
      ? Math.round(
          (tiempoConsulta.reduce((sum, t) => sum + t.tiempoConsultaPromedioMinutos * t.totalConsultas, 0) / totalConsultasConTiempo) * 10,
        ) / 10
      : 0;

  const isReportLoading =
    dashboardQuery.isLoading || rankingQuery.isLoading || occupancyQuery.isLoading || waitTimeWeeklyQuery.isLoading ||
    costosQuery.isLoading || concurridasQuery.isLoading || citasEspecialidadQuery.isLoading || tiempoConsultaQuery.isLoading;

  const { rows: waitTimeWeeklyRows, especialidades: waitTimeEspecialidades } = pivotPorEspecialidad<WaitTimeWeeklyPoint>(
    waitTimeWeeklyQuery.data ?? [],
    'semana',
    'tiempoEsperaPromedioMinutos',
  );
  const { rows: occupancyHoraRows, especialidades: occupancyEspecialidades } = pivotPorEspecialidad<OccupancyPoint>(
    occupancyQuery.data?.porHora ?? [],
    'franjaHoraria',
    'totalPacientes',
  );
  const { rows: occupancySemanaRows } = pivotPorEspecialidad<OccupancyWeeklyPoint>(
    occupancyQuery.data?.porSemana ?? [],
    'semana',
    'totalPacientes',
  );

  // Datos "de tabla" del reporte: siempre completos, independientemente de qué pestaña(s)
  // se estén exportando (downloadManagementReportPdf ya filtra por sección internamente).
  function datosReporte() {
    return {
      dashboard: data,
      ranking: rankingQuery.data ?? [],
      occupancy: occupancyQuery.data?.porHora ?? [],
      waitTimeWeekly: waitTimeWeeklyQuery.data ?? [],
      costos,
      concurridas: concurridasQuery.data ?? [],
      citasPorEspecialidad: citasEspecialidadQuery.data ?? [],
      tiempoConsulta,
    };
  }

  // Captura solo los gráficos que le corresponden a una pestaña puntual (se asume que esa
  // pestaña ya está activa/renderizada al momento de llamar esto).
  async function capturarSeccion(seccion: Tab) {
    if (seccion === 'general') {
      return { dashboard: await capturarGrafico(dashboardRef) };
    }
    if (seccion === 'finanzas') {
      return {
        costos: await capturarGrafico(costosRef),
        citasPorEspecialidad: await capturarGrafico(citasEspecialidadRef),
      };
    }
    if (seccion === 'tiempos') {
      return {
        waitTimeWeekly: await capturarGrafico(waitTimeRef),
        tiempoConsulta: await capturarGrafico(tiempoConsultaRef),
      };
    }
    return {
      doctorRanking: await capturarGrafico(doctorRankingRef),
      occupancy: await capturarGrafico(occupancyRef),
    };
  }

  // "Descargar PDF": solo la pestaña que se está viendo ahora mismo, respetando el período
  // elegido en el combobox (semanal/mensual/trimestral/anual).
  async function handleDownloadPdfPestanaActual() {
    setGenerandoPdf(true);
    try {
      await esperarRender();
      const charts = await capturarSeccion(tab);
      downloadManagementReportPdf({ period, secciones: [tab], ...datosReporte(), charts });
    } finally {
      setGenerandoPdf(false);
    }
  }

  // "Reporte total": las 4 pestañas juntas, aunque solo una esté visible — se recorren una
  // por una, se espera a que Recharts termine de pintar y recién ahí se captura cada una.
  async function handleDownloadPdfTotal() {
    setGenerandoPdf(true);
    const tabPrevia = tab;
    try {
      const secciones: Tab[] = ['general', 'finanzas', 'tiempos', 'demanda'];
      let charts: Record<string, ChartImage | undefined> = {};
      for (const seccion of secciones) {
        setTab(seccion);
        await esperarRender();
        charts = { ...charts, ...(await capturarSeccion(seccion)) };
      }
      downloadManagementReportPdf({ period, secciones, ...datosReporte(), charts });
    } finally {
      setTab(tabPrevia);
      setGenerandoPdf(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Reportes</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            disabled={generandoPdf}
            style={{ ...ui.input, width: 160, marginBottom: 0 }}
          >
            {(Object.entries(PERIOD_LABEL) as [Period, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button style={ui.secondaryButton} disabled={isReportLoading || generandoPdf} onClick={handleDownloadPdfPestanaActual}>
            {generandoPdf ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button style={ui.primaryButton} disabled={isReportLoading || generandoPdf} onClick={handleDownloadPdfTotal}>
            {generandoPdf ? 'Generando...' : 'Reporte total'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '1.1rem 0 1.5rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            disabled={generandoPdf}
            onClick={() => setTab(t.id)}
            style={{
              ...ui.secondaryButton,
              marginRight: 0,
              padding: '0.5rem 1.1rem',
              fontSize: 13.5,
              ...(tab === t.id ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard
              label="Citas completadas"
              value={totalCompletadas}
              tone={PALETTE.primary}
              icon={<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="m8.5 14 2 2 3.5-3.5" /></>}
            />
            <KpiCard
              label="Inasistencias"
              value={totalNoShow}
              tone={PALETTE.critical}
              icon={<><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></>}
            />
            <KpiCard
              label="% Inasistencia"
              value={`${porcentajeInasistenciaGlobal}%`}
              tone={PALETTE.critical}
              icon={<><path d="M4 19h16M7 15l3-4 3 3 4-6" /></>}
            />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <ChartCard title={`Tendencia de citas completadas / inasistencias (${PERIOD_LABEL[period].toLowerCase()})`} captureRef={dashboardRef}>
              {dashboardQuery.isLoading ? (
                <p>Cargando...</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="periodo"
                      tickFormatter={period === 'week' ? formatSemana : undefined}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                      labelFormatter={(value) => (period === 'week' ? `Semana del ${formatSemana(String(value))}` : String(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line type="monotone" dataKey="totalCitasCompletadas" name="Completadas" stroke={PALETTE.primary} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="totalNoShow" name="No-show" stroke={PALETTE.critical} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'finanzas' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard
              label="Ingresos totales (S/)"
              value={ingresosTotales.toFixed(2)}
              tone={PALETTE.good}
              icon={<><path d="M12 3v18M17 7.5c0-1.9-2-3-5-3s-5 1.4-5 3 2 3 5 3 5 1.1 5 3-2 3-5 3-5-1.1-5-3" /></>}
            />
            <KpiCard
              label="Citas pagadas"
              value={citasPagadas}
              tone={PALETTE.teal}
              icon={<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="m8.5 14 2 2 3.5-3.5" /></>}
            />
            <KpiCard
              label="Ingresos retenidos por cancelación (S/)"
              value={(retencionQuery.data?.montoRetenido ?? 0).toFixed(2)}
              tone={PALETTE.critical}
              icon={<><path d="M12 9v4m0 4h.01M10.3 4.5 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" /></>}
            />
          </div>
          {retencionQuery.data && (retencionQuery.data.citasConDineroPerdido > 0 || retencionQuery.data.citasReembolsadas > 0) && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
              Política de cancelación (últimos 12 meses): {retencionQuery.data.citasConDineroPerdido} cita(s) perdieron el pago (S/ {retencionQuery.data.montoRetenido.toFixed(2)}) ·{' '}
              {retencionQuery.data.citasReembolsadas} cita(s) fueron reembolsadas (S/ {retencionQuery.data.montoReembolsado.toFixed(2)})
            </p>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <ChartCard title="Ingresos por especialidad (S/)" captureRef={costosRef}>
              {costosQuery.isLoading ? (
                <p>Cargando...</p>
              ) : costos.length === 0 ? (
                <p>Aún no hay citas pagadas registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={costos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="especialidad" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                    <Bar dataKey="ingresoTotal" name="Ingreso total (S/)" fill={PALETTE.good} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Especialidad más solicitada (total de citas)" captureRef={citasEspecialidadRef}>
              {citasEspecialidadQuery.isLoading ? (
                <p>Cargando...</p>
              ) : (citasEspecialidadQuery.data ?? []).length === 0 ? (
                <p>Aún no hay citas registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={citasEspecialidadQuery.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="especialidad" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                    <Bar dataKey="totalCitas" name="Total citas" fill={PALETTE.teal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'tiempos' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard
              label="Tiempo de espera promedio (min)"
              value={promedioEspera}
              tone={PALETTE.warning}
              icon={<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>}
            />
            <KpiCard
              label="Tiempo de consulta promedio (min)"
              value={tiempoConsultaPromedioGlobal}
              tone={PALETTE.violet}
              icon={<><path d="M9 3v4a3 3 0 0 0 6 0V3M12 7v14" /></>}
            />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <ChartCard title="Tiempo de espera semanal por especialidad" captureRef={waitTimeRef}>
              {waitTimeWeeklyQuery.isLoading ? (
                <p>Cargando...</p>
              ) : waitTimeWeeklyRows.length === 0 ? (
                <p>Aún no hay suficiente historial semanal para graficar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={waitTimeWeeklyRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="semana" tickFormatter={formatSemana} stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} label={{ value: 'Tiempo (min)', angle: -90, position: 'insideLeft', fontSize: 12, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                      labelFormatter={(value) => `Semana del ${formatSemana(String(value))}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {waitTimeEspecialidades.map((especialidad, i) => (
                      <Line
                        key={especialidad}
                        type="monotone"
                        dataKey={especialidad}
                        name={especialidad}
                        stroke={colorForIndex(i)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Tiempo de consulta promedio por especialidad (min)" captureRef={tiempoConsultaRef}>
              {tiempoConsultaQuery.isLoading ? (
                <p>Cargando...</p>
              ) : tiempoConsulta.length === 0 ? (
                <p>Aún no hay consultas completadas con hora de inicio/fin registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={tiempoConsulta}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="especialidad" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                    <Bar dataKey="tiempoConsultaPromedioMinutos" name="Duración promedio (min)" fill={PALETTE.violet} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'demanda' && (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <ChartCard title="Citas por médico" captureRef={doctorRankingRef}>
            {rankingQuery.isLoading ? (
              <p>Cargando...</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rankingQuery.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nombre" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                  <Bar dataKey="totalPacientesAtendidos" name="Pacientes atendidos" fill={PALETTE.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Ocupación por franja horaria y especialidad"
            captureRef={occupancyRef}
            headerExtra={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['hora', 'semana'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVistaOcupacion(v)}
                    style={{
                      ...ui.secondaryButton,
                      marginRight: 0,
                      padding: '0.3rem 0.7rem',
                      fontSize: 12,
                      ...(vistaOcupacion === v ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' } : {}),
                    }}
                  >
                    {v === 'hora' ? 'Por hora' : 'Por semana'}
                  </button>
                ))}
              </div>
            }
          >
            {occupancyQuery.isLoading ? (
              <p>Cargando...</p>
            ) : vistaOcupacion === 'hora' ? (
              occupancyHoraRows.length === 0 ? (
                <p>Aún no hay citas completadas para graficar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={occupancyHoraRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="franjaHoraria" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {occupancyEspecialidades.map((especialidad, i) => (
                      <Bar key={especialidad} dataKey={especialidad} name={especialidad} fill={colorForIndex(i)} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : occupancySemanaRows.length === 0 ? (
              <p>Aún no hay suficiente historial semanal para graficar.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={occupancySemanaRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="semana" tickFormatter={formatSemana} stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                    labelFormatter={(value) => `Semana del ${formatSemana(String(value))}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  {occupancyEspecialidades.map((especialidad, i) => (
                    <Line key={especialidad} type="monotone" dataKey={especialidad} name={especialidad} stroke={colorForIndex(i)} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Citas más concurridas (día y franja horaria)">
            {concurridasQuery.isLoading ? (
              <p>Cargando...</p>
            ) : (concurridasQuery.data ?? []).length === 0 ? (
              <p>Aún no hay suficientes citas completadas.</p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>Día</th>
                      <th style={ui.th}>Franja</th>
                      <th style={ui.th}>Citas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(concurridasQuery.data ?? []).map((c, i) => (
                      <tr key={i}>
                        <td style={ui.td}>{c.dia}</td>
                        <td style={ui.td}>{c.franjaHoraria}</td>
                        <td style={ui.td}>{c.totalCitas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
