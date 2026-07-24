import { IsDateString, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTimeOffDto {
  @IsInt()
  doctorId: number;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
