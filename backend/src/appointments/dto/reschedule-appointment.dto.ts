import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsInt()
  newSlotId: number;

  // Motivo del cambio, para el historial de auditoría (ver AppointmentsService.reschedule).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
