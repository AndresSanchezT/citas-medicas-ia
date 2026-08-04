import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TriagePrioridad } from '../../../generated/prisma/enums';

export class CreateTriageDto {
  // Momento en que se apretó "Iniciar triaje" en el formulario; el fin lo pone el
  // servidor al guardar (ver AppointmentsService.upsertTriage).
  @IsOptional()
  @IsDateString()
  inicioTriajeEn?: string;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(260)
  presionSistolica?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  presionDiastolica?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  frecuenciaCardiaca?: number;

  @IsOptional()
  @IsNumber()
  @Min(25)
  @Max(45)
  temperatura?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(80)
  frecuenciaRespiratoria?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  saturacionOxigeno?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  peso?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(250)
  talla?: number;

  @IsOptional()
  @IsEnum(TriagePrioridad)
  prioridad?: TriagePrioridad;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}
