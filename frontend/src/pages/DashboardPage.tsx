import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { getDashboard, getDoctorRanking, getScheduleOccupancy } from '../api/reports';
import { downloadManagementReportPdf } from '../utils/pdfReports';
import * as ui from '../components/ui';

// Paleta validada (colorblind-safe, ver skill de dataviz): azul categórico #1
// para "lo normal/completado", rojo de estado crítico para inasistencias.
const PALETTE = { primary: '#2a78d6', good: '#0ca30c', critical: '#c23636' };

function KpiIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-tint)',
      color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div style={{ ...ui.card, padding: '1.1rem 1.25rem', flex: 1 }}>
      <KpiIcon>{icon}</KpiIcon>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...ui.card, padding: '1.1rem 1.25rem', flex: '1 1 400px' }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => getDashboard(period),
  });
  const rankingQuery = useQuery({ queryKey: ['doctor-ranking'], queryFn: getDoctorRanking });
  const occupancyQuery = useQuery({ queryKey: ['schedule-occupancy'], queryFn: getScheduleOccupancy });

  const data = dashboardQuery.data ?? [];
  const totalCompletadas = data.reduce((sum, d) => sum + d.totalCitasCompletadas, 0);
  const totalNoShow = data.reduce((sum, d) => sum + d.totalNoShow, 0);
  const promedioEspera =
    data.length > 0
      ? Math.round(
          data.reduce((sum, d) => sum + (d.tiempoEsperaPromedioMinutos ?? 0), 0) / data.length,
        )
      : 0;

  const isReportLoading = dashboardQuery.isLoading || rankingQuery.isLoading || occupancyQuery.isLoading;

  function handleDownloadPdf() {
    downloadManagementReportPdf({
      period,
      dashboard: data,
      ranking: rankingQuery.data ?? [],
      occupancy: occupancyQuery.data ?? [],
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} style={{ ...ui.input, width: 160, marginBottom: 0 }}>
            <option value="month">Mensual</option>
            <option value="quarter">Trimestral</option>
            <option value="year">Anual</option>
          </select>
          <button style={ui.primaryButton} disabled={isReportLoading} onClick={handleDownloadPdf}>
            Descargar PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', marginTop: '1.25rem' }}>
        <KpiCard
          label="Citas completadas"
          value={totalCompletadas}
          icon={<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="m8.5 14 2 2 3.5-3.5" /></>}
        />
        <KpiCard
          label="Inasistencias"
          value={totalNoShow}
          icon={<><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></>}
        />
        <KpiCard
          label="Tiempo de espera promedio (min)"
          value={promedioEspera}
          icon={<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>}
        />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <ChartCard title="Tendencia de citas completadas / inasistencias">
          {dashboardQuery.isLoading ? (
            <p>Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="periodo" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="totalCitasCompletadas" name="Completadas" stroke={PALETTE.primary} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="totalNoShow" name="No-show" stroke={PALETTE.critical} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Citas por médico">
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

        <ChartCard title="Horarios con más pacientes">
          {occupancyQuery.isLoading ? (
            <p>Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyQuery.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="franjaHoraria" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                <Bar dataKey="totalPacientes" name="Pacientes" fill={PALETTE.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
