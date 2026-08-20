import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePagoDto {
  @IsBoolean()
  pagado: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;
}
