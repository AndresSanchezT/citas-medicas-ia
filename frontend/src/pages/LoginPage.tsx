import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { defaultRouteForRole } from '../utils/roleRoutes';
import * as ui from '../components/ui';

const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface AuthErrorDetalle {
  url: string;
  status: number;
  body: unknown;
  timestamp: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [lastAuthError, setLastAuthError] = useState<AuthErrorDetalle | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // Si el interceptor de axios (client.ts) forzó este redirect por un 401, el detalle
  // quedó guardado en sessionStorage antes de la recarga completa de la página (que
  // borra la consola). Se recupera aquí para poder diagnosticarlo con calma.
  useEffect(() => {
    const raw = sessionStorage.getItem('lastAuthError');
    if (raw) {
      try {
        setLastAuthError(JSON.parse(raw));
      } catch {
        /* detalle corrupto, se ignora */
      }
    }
  }, []);

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const usuario = await login(values.email, values.password);
      sessionStorage.removeItem('lastAuthError');
      navigate(defaultRouteForRole(usuario.rol));
    } catch {
      setError('Credenciales inválidas');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 20% 20%, #1c3a56 0%, #152a3e 45%, #0f1f2e 100%)',
      }}
    >
      <div style={{ width: 360 }}>
        {lastAuthError && (
          <div
            style={{
              background: 'var(--color-critical-tint)',
              border: '1px solid var(--color-critical)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: 12,
              color: '#7A2118',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Sesión cerrada por error 401</strong>
              <button
                type="button"
                onClick={() => { sessionStorage.removeItem('lastAuthError'); setLastAuthError(null); }}
                style={{ border: 'none', background: 'none', color: '#7A2118', fontSize: 14 }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 6, wordBreak: 'break-word' }}>
              <div><strong>Petición:</strong> {lastAuthError.url}</div>
              <div><strong>Hora:</strong> {new Date(lastAuthError.timestamp).toLocaleString()}</div>
              <div><strong>Respuesta del servidor:</strong></div>
              <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: 11 }}>
                {JSON.stringify(lastAuthError.body, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            boxShadow: '0 8px 20px rgba(42, 120, 214, 0.35)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 19, textAlign: 'center' }}>Clínica Amazonas</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>
            Sistema de Gestión de Citas Médicas
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            background: 'var(--surface)',
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label>Usuario (correo)</label>
            <input {...register('email')} type="text" style={ui.input} />
            {errors.email && <small style={{ color: 'var(--color-critical)' }}>{errors.email.message}</small>}
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label>Contraseña</label>
            <input {...register('password')} type="password" style={ui.input} />
            {errors.password && <small style={{ color: 'var(--color-critical)' }}>{errors.password.message}</small>}
          </div>

          {error && <p style={{ color: 'var(--color-critical)', fontSize: 13, marginBottom: '0.75rem' }}>{error}</p>}

          <button type="submit" disabled={isSubmitting} style={{ ...ui.primaryButton, width: '100%', padding: '0.65rem', fontSize: 14.5, marginTop: 4 }}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
            Roles: Administrador · Médico · Recepcionista
          </p>
        </form>
      </div>
    </div>
  );
}
