import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

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

  // Pago simulado (no hay pasarela real integrada) — habilita la política de cancelación
  // "reprogramación única gratuita" sobre esta cita.
  @IsOptional()
  @IsBoolean()
  pagado?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;
}
