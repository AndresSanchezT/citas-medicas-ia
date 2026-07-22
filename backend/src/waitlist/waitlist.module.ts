import { Module } from '@nestjs/common';
import { PredictionModule } from '../prediction/prediction.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [PredictionModule, AppointmentsModule],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
