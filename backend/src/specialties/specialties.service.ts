import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

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
    return this.prisma.specialty.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }

  async findOne(id: number) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) {
      throw new NotFoundException(`Especialidad ${id} no encontrada`);
    }
    return specialty;
  }

  async update(id: number, dto: UpdateSpecialtyDto) {
    const specialty = await this.findOne(id);
    if (dto.nombre && dto.nombre !== specialty.nombre) {
      const existing = await this.prisma.specialty.findUnique({ where: { nombre: dto.nombre } });
      if (existing) {
        throw new ConflictException('Ya existe una especialidad con ese nombre');
      }
    }
    return this.prisma.specialty.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.specialty.update({ where: { id }, data: { activo: false } });
  }
}
