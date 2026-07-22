import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function buildAdapter(): PrismaMariaDb {
  const dbUrl = new URL(process.env.DATABASE_URL as string);
  return new PrismaMariaDb({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
  });
}

const prisma = new PrismaClient({ adapter: buildAdapter() });

const DOCTOR_PASSWORD = 'Medico123!';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

async function main() {
  const passwordHash = await bcrypt.hash(DOCTOR_PASSWORD, 10);
  const doctors = await prisma.doctor.findMany({ where: { activo: true } });

  for (const doctor of doctors) {
    const email = `${slugify(doctor.nombres)}.${slugify(doctor.apellidos.split(' ')[0])}.medico@clinica-amazonas.pe`;
    const user = await prisma.user.upsert({
      where: { doctorId: doctor.id },
      update: { email, passwordHash, nombre: `${doctor.nombres} ${doctor.apellidos}`, rol: 'MEDICO' },
      create: {
        nombre: `${doctor.nombres} ${doctor.apellidos}`,
        email,
        passwordHash,
        rol: 'MEDICO',
        doctorId: doctor.id,
      },
    });
    console.log(`Usuario médico creado/actualizado: ${user.email} (doctorId=${doctor.id})`);
  }

  console.log(`\nContraseña compartida para todas las cuentas de médico: ${DOCTOR_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
