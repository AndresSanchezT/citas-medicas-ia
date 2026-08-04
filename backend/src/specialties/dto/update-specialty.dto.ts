import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioConsulta?: number;
}
