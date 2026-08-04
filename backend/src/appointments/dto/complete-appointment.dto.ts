import { IsDateString, IsOptional } from 'class-validator';

// El médico puede ajustar la hora real de fin de la consulta; si no manda nada,
// se usa la hora del servidor en ese momento (comportamiento anterior).
export class CompleteAppointmentDto {
  @IsOptional()
  @IsDateString()
  horaAtencionFinReal?: string;
}
