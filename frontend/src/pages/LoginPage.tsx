import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { defaultRouteForRole } from '../utils/roleRoutes';
import * as ui from '../components/ui';
import logoClinica from '../assets/logoclinica.png';

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
        padding: '2rem 1rem',
        background:
          'radial-gradient(circle at 12% 15%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%),' +
          'radial-gradient(circle at 88% 80%, rgba(15,138,114,0.40) 0%, rgba(15,138,114,0) 45%),' +
          'linear-gradient(135deg, #0a1f33 0%, #123a5e 45%, #0f8a72 100%)',
      }}
    >
      <div style={{ width: 380 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 26,
              background: 'rgba(255,255,255,0.97)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
              marginBottom: 20,
              boxShadow: '0 16px 36px rgba(3, 15, 26, 0.45), 0 0 0 1px rgba(255,255,255,0.12)',
            }}
          >
            <img
              src={logoClinica}
              alt="Clínica Amazonas"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 25, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.3px' }}>
            Clínica Amazonas
          </h1>
          <div style={{ width: 44, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', margin: '12px 0 10px' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, textAlign: 'center', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Sistema de Gestión de Citas Médicas
          </p>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            boxShadow: '0 28px 64px rgba(3, 15, 26, 0.5)',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 4, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />

          <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '2.25rem 2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Usuario (correo)</label>
              <input {...register('email')} type="text" placeholder="correo@ejemplo.com" style={ui.input} />
              {errors.email && <small style={{ color: 'var(--color-critical)' }}>{errors.email.message}</small>}
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>Contraseña</label>
              <input {...register('password')} type="password" placeholder="Tu contraseña" style={ui.input} />
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
    </div>
  );
}
