import { Module } from '@nestjs/common';
import { EmailService } from '../common/email.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, EmailService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
