import { Module } from '@nestjs/common';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';

@Module({
  imports: [SpecialtiesModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
})
export class DoctorsModule {}
