import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { MyAgendaPage } from './pages/MyAgendaPage';
import { PatientsPage } from './pages/PatientsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { SpecialtiesPage } from './pages/SpecialtiesPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { AlertsPage } from './pages/AlertsPage';
import { defaultRouteForRole } from './utils/roleRoutes';

// "/" ya no tiene una página propia: cada rol aterriza en la suya (Reportes, Mi agenda o
// Citas). Esto solo se alcanza estando autenticado (el ProtectedRoute padre ya lo garantiza).
function RootRedirect() {
  const { usuario } = useAuth();
  return <Navigate to={defaultRouteForRole(usuario!.rol)} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mi-agenda"
            element={
              <ProtectedRoute allowedRoles={['MEDICO']}>
                <MyAgendaPage />
              </ProtectedRoute>
            }
          />
          <Route path="/pacientes" element={<PatientsPage />} />
          <Route path="/medicos" element={<DoctorsPage />} />
          <Route
            path="/especialidades"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <SpecialtiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citas"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'RECEPCIONISTA']}>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/lista-espera" element={<WaitlistPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
