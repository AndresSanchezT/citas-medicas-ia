import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN)
  getDashboard(
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getDashboard(period, from, to);
  }

  @Get('schedule-occupancy')
  @Roles(Role.ADMIN)
  getScheduleOccupancy() {
    return this.reportsService.getScheduleOccupancyReport();
  }

  @Get('doctor-ranking')
  @Roles(Role.ADMIN)
  getDoctorRanking(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getDoctorRankingReport(from, to);
  }

  @Get('wait-time-weekly')
  @Roles(Role.ADMIN)
  getWaitTimeWeekly(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getWaitTimeWeeklyBySpecialty(from, to);
  }

  @Get('retencion-ingresos')
  @Roles(Role.ADMIN)
  getRetencionIngresos(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getRetencionIngresos(from, to);
  }

  @Get('costos-por-especialidad')
  @Roles(Role.ADMIN)
  getCostosPorEspecialidad(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getCostosPorEspecialidad(from, to);
  }

  @Get('citas-mas-concurridas')
  @Roles(Role.ADMIN)
  getCitasMasConcurridas(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getCitasMasConcurridas(from, to);
  }

  @Get('citas-por-especialidad')
  @Roles(Role.ADMIN)
  getCitasPorEspecialidad(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getCitasPorEspecialidad(from, to);
  }

  @Get('tiempo-consulta-por-especialidad')
  @Roles(Role.ADMIN)
  getTiempoConsultaPorEspecialidad(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getTiempoConsultaPorEspecialidad(from, to);
  }

  @Get('tiempo-triaje-por-especialidad')
  @Roles(Role.ADMIN)
  getTiempoTriajePorEspecialidad(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getTiempoTriajePorEspecialidad(from, to);
  }

  @Post('generate-daily-stats')
  @Roles(Role.ADMIN)
  generateDailyStats(@Body('fecha') fecha?: string) {
    return this.reportsService.generateDailyStatsForDateOrToday(fecha);
  }
}
