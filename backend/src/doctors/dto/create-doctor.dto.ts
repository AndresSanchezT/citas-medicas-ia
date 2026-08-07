import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TipoDocumento } from '../../../generated/prisma/enums';

export class CreateDoctorDto {
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

  @IsInt()
  specialtyId: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
