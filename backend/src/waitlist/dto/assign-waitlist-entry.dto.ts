import { IsInt, IsOptional, IsString } from 'class-validator';

export class AssignWaitlistEntryDto {
  @IsInt()
  slotId: number;

  @IsOptional()
  @IsString()
  motivoConsulta?: string;
}
