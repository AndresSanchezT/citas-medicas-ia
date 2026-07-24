import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { defaultRouteForRole } from '../utils/roleRoutes';

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
        fontFamily: 'system-ui, sans-serif',
        background: '#F7F8FA',
      }}
    >
      <div style={{ width: 340 }}>
        {lastAuthError && (
          <div
            style={{
              background: '#FDECEA',
              border: '1px solid #C0392B',
              borderRadius: 8,
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
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7A2118', fontSize: 14 }}
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>Sistema de Gestión de Citas Médicas</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label>Usuario (correo)</label>
          <input {...register('email')} type="text" style={{ width: '100%', padding: 8 }} />
          {errors.email && <small style={{ color: 'crimson' }}>{errors.email.message}</small>}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Contraseña</label>
          <input {...register('password')} type="password" style={{ width: '100%', padding: 8 }} />
          {errors.password && <small style={{ color: 'crimson' }}>{errors.password.message}</small>}
        </div>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: 10 }}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 0 }}>
          Roles: Administrador · Médico · Recepcionista
        </p>
        </form>
      </div>
    </div>
  );
}
