import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpecialtyDto) {
    const existing = await this.prisma.specialty.findUnique({ where: { nombre: dto.nombre } });
    if (existing) {
      throw new ConflictException('Ya existe una especialidad con ese nombre');
    }
    return this.prisma.specialty.create({ data: dto });
  }

  findAll() {
    return this.prisma.specialty.findMany({ orderBy: { nombre: 'asc' } });
  }

  async findOne(id: number) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) {
      throw new NotFoundException(`Especialidad ${id} no encontrada`);
    }
    return specialty;
  }
}
