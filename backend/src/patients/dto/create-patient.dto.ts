import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Sexo, TipoDocumento } from '../../../generated/prisma/enums';

export class CreatePatientDto {
  @IsString()
  @MaxLength(100)
  nombres: string;

  @IsString()
  @MaxLength(100)
  apellidos: string;

  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  // El formato exacto (ej. DNI = solo 8 dígitos) lo exige el frontend según el tipo
  // elegido; acá solo se valida un formato genérico razonable para cualquier documento.
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'documentoIdentidad debe ser alfanumérico, máximo 20 caracteres' })
  documentoIdentidad: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsEnum(Sexo)
  sexo?: Sexo;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
}
