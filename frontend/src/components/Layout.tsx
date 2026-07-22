import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../api/auth';

interface MenuItem {
  to: string;
  label: string;
  roles: Usuario['rol'][];
}

const menuItems: MenuItem[] = [
  { to: '/', label: 'Dashboard', roles: ['ADMIN'] },
  { to: '/mi-agenda', label: 'Mi agenda', roles: ['MEDICO'] },
  { to: '/pacientes', label: 'Pacientes', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'] },
  { to: '/medicos', label: 'Médicos', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'] },
  { to: '/citas', label: 'Citas', roles: ['ADMIN', 'RECEPCIONISTA'] },
  { to: '/lista-espera', label: 'Lista de espera', roles: ['ADMIN', 'RECEPCIONISTA'] },
  { to: '/alertas', label: 'Alertas', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'] },
];

export function Layout() {
  const { usuario, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: 220, background: '#1B2A41', color: '#fff', padding: '1rem 0' }}>
        <div style={{ padding: '0 1rem 1rem', fontWeight: 'bold', borderBottom: '1px solid #33445c' }}>
          Clínica Amazonas
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
          {menuItems
            .filter((item) => !usuario || item.roles.includes(usuario.rol))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  color: '#fff',
                  textDecoration: 'none',
                  background: isActive ? '#2E5FA3' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid #ddd',
            gap: '1rem',
          }}
        >
          <span>
            {usuario?.nombre} ({usuario?.rol})
          </span>
          <button onClick={logout}>Cerrar sesión</button>
        </header>
        <main style={{ padding: '1.5rem', flex: 1, background: '#F7F8FA' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
