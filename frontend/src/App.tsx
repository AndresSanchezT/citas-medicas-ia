import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyAgendaPage } from './pages/MyAgendaPage';
import { PatientsPage } from './pages/PatientsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { AlertsPage } from './pages/AlertsPage';

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
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DashboardPage />
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
