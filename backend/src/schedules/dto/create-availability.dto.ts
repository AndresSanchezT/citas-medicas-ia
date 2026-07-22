import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAvailabilityDto {
  @IsInt()
  doctorId: number;

  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5, 6])
  diaSemana: number;

  @Matches(HHMM, { message: 'horaInicio debe tener formato HH:MM' })
  horaInicio: string;

  @Matches(HHMM, { message: 'horaFin debe tener formato HH:MM' })
  horaFin: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  duracionSlotMinutos?: number;
}
