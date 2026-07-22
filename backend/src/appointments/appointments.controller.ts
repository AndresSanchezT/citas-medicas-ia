import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: string,
  ) {
    // Un médico solo puede ver su propia agenda, sin importar qué doctorId pida el cliente.
    const doctorIdFiltro = user.rol === Role.MEDICO ? (user.doctorId ?? -1) : doctorId ? Number(doctorId) : undefined;
    return this.appointmentsService.findAll({
      doctorId: doctorIdFiltro,
      patientId: patientId ? Number(patientId) : undefined,
      fecha,
      estado,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id/check-in')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.checkIn(id);
  }

  @Patch(':id/start')
  @Roles(Role.ADMIN, Role.MEDICO)
  start(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.startConsultation(id);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.MEDICO)
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.complete(id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.cancel(id);
  }

  @Patch(':id/no-show')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  markNoShow(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.markNoShow(id);
  }

  @Patch(':id/reschedule')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  reschedule(@Param('id', ParseIntPipe) id: number, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, dto);
  }
}
