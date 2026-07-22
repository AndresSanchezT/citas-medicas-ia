import { IsEnum, IsInt, IsOptional } from 'class-validator';

export enum WaitlistPriorityDto {
  NORMAL = 'NORMAL',
  URGENTE = 'URGENTE',
}

export class CreateWaitlistEntryDto {
  @IsInt()
  patientId: number;

  @IsOptional()
  @IsInt()
  doctorId?: number;

  @IsOptional()
  @IsInt()
  specialtyId?: number;

  @IsOptional()
  @IsEnum(WaitlistPriorityDto)
  prioridad?: WaitlistPriorityDto;
}
