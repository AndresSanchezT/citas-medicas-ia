import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // registerAsync (con useFactory) en vez de register(): la factory se evalúa cuando
    // Nest arma el contenedor de DI, DESPUÉS de que ConfigModule.forRoot() carga el .env.
    // Con register() el objeto de config se evalúa al cargar este archivo, ANTES de que
    // el .env exista en process.env, firmando siempre con el secreto por defecto aunque
    // JwtStrategy (que sí lee process.env en su constructor, evaluado más tarde) verifique
    // contra el secreto real del .env — mismatch garantizado si JWT_SECRET no es el
    // literal "dev-secret-change-me".
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
