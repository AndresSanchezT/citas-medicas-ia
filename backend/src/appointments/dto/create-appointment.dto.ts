import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  patientId: number;

  @IsInt()
  doctorId: number;

  @IsInt()
  slotId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivoConsulta?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
