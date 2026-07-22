import { IsString, MaxLength } from 'class-validator';

export class CreateSpecialtyDto {
  @IsString()
  @MaxLength(100)
  nombre: string;
}
