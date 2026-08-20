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
import { CompleteAppointmentDto } from './dto/complete-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateTriageDto } from './dto/create-triage.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { StartConsultationDto } from './dto/start-consultation.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';

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
    @Query('specialtyId') specialtyId?: string,
    @Query('fecha') fecha?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('estado') estado?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // Un médico solo puede listar su propia agenda (doctorId forzado al suyo), salvo cuando
    // consulta el historial de un paciente puntual (patientId), donde sí puede ver todos sus
    // médicos tratantes por continuidad de atención.
    const doctorIdFiltro =
      user.rol === Role.MEDICO && !patientId
        ? (user.doctorId ?? -1)
        : doctorId
          ? Number(doctorId)
          : undefined;
    return this.appointmentsService.findAll({
      doctorId: doctorIdFiltro,
      patientId: patientId ? Number(patientId) : undefined,
      specialtyId: specialtyId ? Number(specialtyId) : undefined,
      fecha,
      fechaDesde,
      fechaHasta,
      estado,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id/pago')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  actualizarPago(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePagoDto) {
    return this.appointmentsService.actualizarPago(id, dto);
  }

  @Patch(':id/check-in')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.checkIn(id);
  }

  @Patch(':id/start')
  @Roles(Role.ADMIN, Role.MEDICO)
  start(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartConsultationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.startConsultation(id, dto, user);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.MEDICO)
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.complete(id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.cancel(id, user);
  }

  @Patch(':id/no-show')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  markNoShow(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.markNoShow(id, user);
  }

  @Patch(':id/reschedule')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.reschedule(id, dto, user);
  }

  @Patch(':id/triage/start')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  iniciarTriaje(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.iniciarTriaje(id);
  }

  @Post(':id/triage')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  upsertTriage(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTriageDto) {
    return this.appointmentsService.upsertTriage(id, dto);
  }
}
