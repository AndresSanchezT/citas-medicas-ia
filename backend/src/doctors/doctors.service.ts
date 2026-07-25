import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

const PASSWORD_SALT_ROUNDS = 10;

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

    const { password, ...doctorData } = dto;
    if (password) {
      await this.assertEmailAvailableForCredentials(dto.email);
    }

    return this.prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.create({ data: doctorData, include: { specialty: true } });
      if (password) {
        const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
        await tx.user.create({
          data: {
            nombre: `${doctor.nombres} ${doctor.apellidos}`,
            email: dto.email!,
            passwordHash,
            rol: Role.MEDICO,
            doctorId: doctor.id,
          },
        });
      }
      return doctor;
    });
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
    const doctor = await this.findOne(id);
    if (dto.specialtyId) {
      await this.specialtiesService.findOne(dto.specialtyId);
    }

    const { password, ...doctorData } = dto;
    const credentialsEmail = dto.email ?? doctor.email ?? undefined;
    if (password) {
      await this.assertEmailAvailableForCredentials(credentialsEmail, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.doctor.update({ where: { id }, data: doctorData, include: { specialty: true } });
      if (password) {
        const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
        await tx.user.upsert({
          where: { doctorId: id },
          create: {
            nombre: `${updated.nombres} ${updated.apellidos}`,
            email: credentialsEmail!,
            passwordHash,
            rol: Role.MEDICO,
            doctorId: id,
          },
          update: {
            nombre: `${updated.nombres} ${updated.apellidos}`,
            email: credentialsEmail!,
            passwordHash,
          },
        });
      }
      return updated;
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);
    return this.prisma.doctor.update({ where: { id }, data: { activo: false } });
  }

  private async assertEmailAvailableForCredentials(email: string | undefined, excludeDoctorId?: number) {
    if (!email) {
      throw new BadRequestException('Se requiere un email para crear las credenciales de acceso del médico');
    }
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.doctorId !== excludeDoctorId) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }
  }
}
