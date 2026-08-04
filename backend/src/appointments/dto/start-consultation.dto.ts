import { IsDateString, IsOptional } from 'class-validator';

// El médico puede ajustar la hora real de inicio de la consulta; si no manda nada,
// se usa la hora del servidor en ese momento (comportamiento anterior).
export class StartConsultationDto {
  @IsOptional()
  @IsDateString()
  horaAtencionInicioReal?: string;
}
