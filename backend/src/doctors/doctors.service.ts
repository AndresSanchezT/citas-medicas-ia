import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specialtiesService: SpecialtiesService,
  ) {}

  async create(dto: CreateDoctorDto) {
    await this.specialtiesService.findOne(dto.specialtyId);

    const existing = await this.prisma.doctor.findUnique({
      where: { documentoIdentidad: dto.documentoIdentidad },
    });
    if (existing) {
      throw new ConflictException('Ya existe un médico registrado con ese documento de identidad');
    }

    return this.prisma.doctor.create({ data: dto, include: { specialty: true } });
  }

  findAll() {
    return this.prisma.doctor.findMany({
      where: { activo: true },
      include: { specialty: true },
      orderBy: { apellidos: 'asc' },
    });
  }

  async findOne(id: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: { specialty: true },
    });
    if (!doctor) {
      throw new NotFoundException(`Médico ${id} no encontrado`);
    }
    return doctor;
  }

  async update(id: number, dto: UpdateDoctorDto) {
    await this.findOne(id);
    if (dto.specialtyId) {
      await this.specialtiesService.findOne(dto.specialtyId);
    }
    return this.prisma.doctor.update({ where: { id }, data: dto, include: { specialty: true } });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.doctor.update({ where: { id }, data: { activo: false } });
  }
}
