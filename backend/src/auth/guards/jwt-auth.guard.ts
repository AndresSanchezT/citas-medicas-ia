import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  // Passport traga el motivo real del rechazo (token ausente, expirado, firma inválida)
  // y por defecto todo llega al cliente como un 401 genérico. Se registra aquí el detalle
  // en el log del servidor (persiste en la terminal, a diferencia de la consola del
  // navegador, que se borra con el redirect a /login tras un 401).
  handleRequest<TUser = any>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    if (!user) {
      const req = context.switchToHttp().getRequest();
      const authHeader = req.headers?.authorization as string | undefined;
      const motivo = (info as Error)?.message || (err as Error)?.message || 'sin usuario autenticado';
      this.logger.warn(
        `401 en ${req.method} ${req.url} — motivo: ${motivo} — Authorization header: ${authHeader ? `presente (${authHeader.slice(0, 20)}...)` : 'ausente'}`,
      );
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
