import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.activo) {
      this.logger.warn(`Login rechazado para ${dto.email}: usuario no existe o está inactivo`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      this.logger.warn(`Login rechazado para ${dto.email}: contraseña incorrecta`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: user.id, email: user.email, rol: user.rol, doctorId: user.doctorId };
    const accessToken = await this.jwtService.signAsync(payload);
    this.logger.log(
      `Login OK para ${dto.email} (rol ${user.rol}) — token emitido, expira en 8h, firmado con secret de ${process.env.JWT_SECRET ? 'JWT_SECRET (.env)' : 'valor por defecto (dev-secret-change-me)'}`,
    );
    return {
      accessToken,
      usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, doctorId: user.doctorId },
    };
  }
}
