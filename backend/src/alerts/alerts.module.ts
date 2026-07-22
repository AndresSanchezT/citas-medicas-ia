import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { EmailService } from '../common/email.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, EmailService],
})
export class AlertsModule {}
