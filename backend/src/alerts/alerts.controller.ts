import { Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('estado') estado?: string,
    @Query('destinatarioTipo') destinatarioTipo?: string,
    @Query('destinatarioId') destinatarioId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    // Un médico solo puede ver las alertas dirigidas a él mismo (nunca las del administrador
    // ni las de otro médico/paciente) — se fuerza el filtro sin importar lo que mande el query.
    const esMedico = user.rol === Role.MEDICO;
    return this.alertsService.findAll({
      estado,
      destinatarioTipo: esMedico ? 'MEDICO' : destinatarioTipo,
      destinatarioId: esMedico ? (user.doctorId ?? -1) : destinatarioId ? Number(destinatarioId) : undefined,
      fechaDesde,
      fechaHasta,
    });
  }

  @Get('resumen')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  getResumen(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    const esMedico = user.rol === Role.MEDICO;
    return this.alertsService.getResumen({
      fechaDesde,
      fechaHasta,
      destinatarioTipo: esMedico ? 'MEDICO' : undefined,
      destinatarioId: esMedico ? (user.doctorId ?? -1) : undefined,
    });
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  markAsRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.markAsRead(id, user);
  }
}
