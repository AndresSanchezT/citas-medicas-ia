import type { Usuario } from '../api/auth';

export function defaultRouteForRole(rol: Usuario['rol']): string {
  switch (rol) {
    case 'ADMIN':
      return '/reportes';
    case 'MEDICO':
      return '/mi-agenda';
    case 'RECEPCIONISTA':
      return '/citas';
  }
}
