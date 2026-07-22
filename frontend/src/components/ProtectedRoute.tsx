import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../api/auth';
import { defaultRouteForRole } from '../utils/roleRoutes';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Usuario['rol'][];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { usuario, isAuthenticated } = useAuth();

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" replace />;
  }

  // Si el rol no puede ver esta ruta, se manda a su página por defecto en vez de "/"
  // (evita un loop de redirección cuando "/" mismo está restringido a otro rol).
  if (allowedRoles && !allowedRoles.includes(usuario.rol)) {
    return <Navigate to={defaultRouteForRole(usuario.rol)} replace />;
  }

  return <>{children}</>;
}
