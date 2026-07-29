import { Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
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
    @Query('estado') estado?: string,
    @Query('destinatarioTipo') destinatarioTipo?: string,
    @Query('destinatarioId') destinatarioId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.alertsService.findAll({
      estado,
      destinatarioTipo,
      destinatarioId: destinatarioId ? Number(destinatarioId) : undefined,
      fechaDesde,
      fechaHasta,
    });
  }

  @Get('resumen')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  getResumen(@Query('fechaDesde') fechaDesde?: string, @Query('fechaHasta') fechaHasta?: string) {
    return this.alertsService.getResumen({ fechaDesde, fechaHasta });
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.markAsRead(id);
  }
}
