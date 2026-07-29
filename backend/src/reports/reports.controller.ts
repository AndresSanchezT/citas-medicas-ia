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
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
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

  @Post('generate-daily-stats')
  @Roles(Role.ADMIN)
  generateDailyStats(@Body('fecha') fecha?: string) {
    return this.reportsService.generateDailyStatsForDateOrToday(fecha);
  }
}
