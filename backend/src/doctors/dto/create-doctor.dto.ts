import { IsEmail, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @MaxLength(100)
  nombres: string;

  @IsString()
  @MaxLength(100)
  apellidos: string;

  @IsString()
  @MaxLength(20)
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
}
