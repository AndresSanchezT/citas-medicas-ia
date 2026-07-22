import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    const existing = await this.prisma.patient.findUnique({
      where: { documentoIdentidad: dto.documentoIdentidad },
    });
    if (existing) {
      throw new ConflictException('Ya existe un paciente registrado con ese documento de identidad');
    }

    return this.prisma.patient.create({
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      },
    });
  }

  async findAll(search?: string) {
    return this.prisma.patient.findMany({
      where: search
        ? {
            activo: true,
            OR: [
              { nombres: { contains: search } },
              { apellidos: { contains: search } },
              { documentoIdentidad: { contains: search } },
            ],
          }
        : { activo: true },
      orderBy: { apellidos: 'asc' },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Paciente ${id} no encontrado`);
    }
    return patient;
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.patient.update({ where: { id }, data: { activo: false } });
  }
}
