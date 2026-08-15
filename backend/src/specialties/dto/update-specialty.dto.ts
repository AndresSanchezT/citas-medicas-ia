import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioConsulta?: number;
}
