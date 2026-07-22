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
import { AssignWaitlistEntryDto } from './dto/assign-waitlist-entry.dto';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';
import { WaitlistService } from './waitlist.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  create(@Body() dto: CreateWaitlistEntryDto) {
    return this.waitlistService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findAll(
    @Query('estado') estado?: string,
    @Query('doctorId') doctorId?: string,
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.waitlistService.findAll({
      estado,
      doctorId: doctorId ? Number(doctorId) : undefined,
      specialtyId: specialtyId ? Number(specialtyId) : undefined,
    });
  }

  @Get('demand-ranking')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  getDemandRanking() {
    return this.waitlistService.getDemandRanking();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA, Role.MEDICO)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.waitlistService.findOne(id);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignWaitlistEntryDto) {
    return this.waitlistService.assign(id, dto);
  }

  @Patch(':id/expire')
  @Roles(Role.ADMIN, Role.RECEPCIONISTA)
  expire(@Param('id', ParseIntPipe) id: number) {
    return this.waitlistService.expire(id);
  }
}
