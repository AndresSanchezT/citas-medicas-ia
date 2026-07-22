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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { SchedulesService } from './schedules.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('availability')
  @Roles(Role.ADMIN)
  createAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.schedulesService.createAvailability(dto);
  }

  @Get('availability/doctor/:doctorId')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findAvailabilityByDoctor(@Param('doctorId', ParseIntPipe) doctorId: number) {
    return this.schedulesService.findAvailabilityByDoctor(doctorId);
  }

  @Patch('availability/:id')
  @Roles(Role.ADMIN)
  updateAvailability(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAvailabilityDto) {
    return this.schedulesService.updateAvailability(id, dto);
  }

  @Patch('availability/:id/deactivate')
  @Roles(Role.ADMIN)
  deactivateAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.deactivateAvailability(id);
  }

  @Post('generate-slots')
  @Roles(Role.ADMIN)
  generateSlots(@Body('daysAhead') daysAhead?: number) {
    return this.schedulesService.generateSlots(daysAhead);
  }

  @Get('slots')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findSlots(@Query('doctorId') doctorId?: string, @Query('fecha') fecha?: string) {
    return this.schedulesService.findSlots(doctorId ? Number(doctorId) : undefined, fecha);
  }

  @Patch('slots/:id/block')
  @Roles(Role.ADMIN)
  blockSlot(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.blockSlot(id);
  }

  @Get('recommendations')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  getRecommendations() {
    return this.schedulesService.getOccupancyRecommendation();
  }
}
