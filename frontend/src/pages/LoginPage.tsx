import { useState } from 'react';
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

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const usuario = await login(values.email, values.password);
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
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          width: 340,
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
  );
}
