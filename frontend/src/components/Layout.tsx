import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../api/auth';

interface MenuItem {
  to: string;
  label: string;
  roles: Usuario['rol'][];
  icon: ReactNode;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const icons = {
  reportes: (
    <Icon><path d="M3 13h4V6H3v7Zm0 5h4v-3H3v3ZM10 18h4V9h-4v9ZM17 18h4V4h-4v14Z" /></Icon>
  ),
  agenda: (
    <Icon><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" /></Icon>
  ),
  pacientes: (
    <Icon><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></Icon>
  ),
  medicos: (
    <Icon><path d="M9 3v4a3 3 0 0 0 6 0V3M12 7v4a5 5 0 0 0 5 5 3 3 0 0 0 3-3" /><circle cx="19" cy="19" r="2" /></Icon>
  ),
  citas: (
    <Icon><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="m8.5 14 2 2 3.5-3.5" /></Icon>
  ),
  espera: (
    <Icon><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
  ),
  alertas: (
    <Icon><path d="M12 4a4.5 4.5 0 0 0-4.5 4.5c0 5-2 6-2 6.5h13c0-.5-2-1.5-2-6.5A4.5 4.5 0 0 0 12 4Z" /><path d="M10.3 18.5a1.8 1.8 0 0 0 3.4 0" /></Icon>
  ),
  especialidades: (
    <Icon><path d="M12 3 4 7v6c0 4.5 3.5 7 8 8 4.5-1 8-3.5 8-8V7l-8-4Z" /><path d="M9.5 12.5 11 14l3.5-3.5" /></Icon>
  ),
};

const menuItems: MenuItem[] = [
  { to: '/reportes', label: 'Reportes', roles: ['ADMIN'], icon: icons.reportes },
  { to: '/mi-agenda', label: 'Mi agenda', roles: ['MEDICO'], icon: icons.agenda },
  { to: '/pacientes', label: 'Pacientes', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'], icon: icons.pacientes },
  { to: '/medicos', label: 'Médicos', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'], icon: icons.medicos },
  { to: '/especialidades', label: 'Especialidades', roles: ['ADMIN'], icon: icons.especialidades },
  { to: '/citas', label: 'Citas', roles: ['ADMIN', 'RECEPCIONISTA'], icon: icons.citas },
  { to: '/lista-espera', label: 'Lista de espera', roles: ['ADMIN', 'RECEPCIONISTA'], icon: icons.espera },
  { to: '/alertas', label: 'Alertas', roles: ['ADMIN', 'RECEPCIONISTA', 'MEDICO'], icon: icons.alertas },
];

function initials(nombre?: string): string {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const ROLE_LABEL: Record<Usuario['rol'], string> = {
  ADMIN: 'Administrador',
  MEDICO: 'Médico',
  RECEPCIONISTA: 'Recepcionista',
};

export function Layout() {
  const { usuario, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 232, background: '#152A3E', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1.25rem 1.25rem 1rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>Clínica Amazonas</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0.5rem 0.75rem', flex: 1 }}>
          {menuItems
            .filter((item) => !usuario || item.roles.includes(usuario.rol))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0.6rem 0.75rem',
                  borderRadius: 8,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
                  textDecoration: 'none',
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background 0.12s ease, color 0.12s ease',
                })}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          Sistema de Gestión de Citas Médicas
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0.75rem 1.75rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            gap: '0.9rem',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-tint)',
            color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>
            {initials(usuario?.nombre)}
          </div>
          <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
            <strong style={{ fontWeight: 600 }}>{usuario?.nombre}</strong>
            <span style={{ color: 'var(--text-muted)' }}> · {usuario ? ROLE_LABEL[usuario.rol] : ''}</span>
          </span>
          <button
            onClick={logout}
            style={{
              background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.8rem', fontSize: 13, fontWeight: 500,
            }}
          >
            Cerrar sesión
          </button>
        </header>
        <main style={{ padding: '1.75rem', flex: 1, background: 'var(--page-bg)', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
