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

const PALETTE = { primary: '#2E5FA3', secondary: '#3E8E3E', warn: '#C0392B' };

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: '1rem',
        flex: 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{value}</div>
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
          <option value="month">Mensual</option>
          <option value="quarter">Trimestral</option>
          <option value="year">Anual</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard label="Citas completadas" value={totalCompletadas} />
        <KpiCard label="Inasistencias" value={totalNoShow} />
        <KpiCard label="Tiempo de espera promedio (min)" value={promedioEspera} />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', flex: '1 1 400px' }}>
          <h3>Tendencia de citas completadas / inasistencias</h3>
          {dashboardQuery.isLoading ? (
            <p>Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalCitasCompletadas" name="Completadas" stroke={PALETTE.secondary} />
                <Line type="monotone" dataKey="totalNoShow" name="No-show" stroke={PALETTE.warn} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', flex: '1 1 400px' }}>
          <h3>Citas por médico</h3>
          {rankingQuery.isLoading ? (
            <p>Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rankingQuery.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalPacientesAtendidos" name="Pacientes atendidos" fill={PALETTE.primary} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', flex: '1 1 400px' }}>
          <h3>Horarios con más pacientes</h3>
          {occupancyQuery.isLoading ? (
            <p>Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyQuery.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="franjaHoraria" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalPacientes" name="Pacientes" fill={PALETTE.primary} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
