// Seeder minimo para empezar a usar el sistema "de verdad" (no es el dataset sintetico
// grande de seed-demo.ts + seed-demo-live.ts, pensado para entrenar el modelo de IA).
// Crea solo lo indispensable para poder loguearte con cada rol y agendar la primera cita
// real desde la UI: especialidades con precio, 1 admin, 1 recepcionista, 2 medicos (con
// horario semanal y cupos ya generados) y 3 pacientes con distintos tipos de documento.
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

// ---------- generación de cupos (mismo criterio que SchedulesService.generateSlots,
// reimplementado acá para no depender de que el backend esté corriendo al sembrar) ----------
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const DIAS_AHEAD = 30;

async function generarCuposDesdeDisponibilidad(): Promise<number> {
  const availabilities = await prisma.doctorWeeklyAvailability.findMany({ where: { activo: true } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let creados = 0;

  for (let i = 0; i < DIAS_AHEAD; i++) {
    const fecha = addDays(today, i);
    const diaSemana = fecha.getDay();
    const delDia = availabilities.filter((a) => a.diaSemana === diaSemana);

    for (const avail of delDia) {
      const start = toMinutes(avail.horaInicio);
      const end = toMinutes(avail.horaFin);
      const step = avail.duracionSlotMinutos;
      for (let t = start; t + step <= end; t += step) {
        await prisma.appointmentSlot.create({
          data: {
            doctorId: avail.doctorId,
            fecha,
            horaInicio: toHHMM(t),
            horaFin: toHHMM(t + step),
            estado: 'DISPONIBLE',
          },
        });
        creados++;
      }
    }
  }
  return creados;
}

async function main() {
  console.log('=== Sembrando datos iniciales para uso real ===\n');

  // ---------- Especialidades (con precio de consulta ya cargado, para probar el
  // autocompletado de "Monto pagado" en Nueva cita) ----------
  const medicinaGeneral = await prisma.specialty.create({
    data: { nombre: 'Medicina General', precioConsulta: 60 },
  });
  const cardiologia = await prisma.specialty.create({
    data: { nombre: 'Cardiologia', precioConsulta: 150 },
  });
  console.log('Especialidades: Medicina General (S/ 60), Cardiologia (S/ 150)');

  // ---------- Administrador ----------
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.create({
    data: {
      nombre: 'Administrador del Sistema',
      email: 'admin@clinica-amazonas.pe',
      passwordHash: adminHash,
      rol: 'ADMIN',
    },
  });

  // ---------- Recepcionista (no pedida explícitamente, pero recomendada: es un rol
  // de primera clase en el sistema —agenda citas, lista de espera, check-in— y conviene
  // tener una cuenta real para probar sus permisos, distintos a los del admin) ----------
  const recepcionHash = await bcrypt.hash('Recepcion123!', 10);
  const recepcionista = await prisma.user.create({
    data: {
      nombre: 'Recepcion Clinica Amazonas',
      email: 'recepcion@clinica-amazonas.pe',
      passwordHash: recepcionHash,
      rol: 'RECEPCIONISTA',
    },
  });

  // ---------- Médicos (2 especialidades distintas, cada uno con su cuenta de acceso a
  // "Mi agenda") ----------
  const medicoHash = await bcrypt.hash('Medico123!', 10);

  const doctor1 = await prisma.doctor.create({
    data: {
      nombres: 'Carlos',
      apellidos: 'Garcia Flores',
      tipoDocumento: 'DNI',
      documentoIdentidad: '10203040',
      telefono: '987654321',
      email: 'carlos.garcia@clinica-amazonas.pe',
      specialtyId: medicinaGeneral.id,
    },
  });
  await prisma.user.create({
    data: {
      nombre: 'Carlos Garcia Flores',
      email: 'carlos.garcia.medico@clinica-amazonas.pe',
      passwordHash: medicoHash,
      rol: 'MEDICO',
      doctorId: doctor1.id,
    },
  });

  const doctor2 = await prisma.doctor.create({
    data: {
      nombres: 'Ana',
      apellidos: 'Rengifo Saldana',
      tipoDocumento: 'DNI',
      documentoIdentidad: '10203041',
      telefono: '987654322',
      email: 'ana.rengifo@clinica-amazonas.pe',
      specialtyId: cardiologia.id,
    },
  });
  await prisma.user.create({
    data: {
      nombre: 'Ana Rengifo Saldana',
      email: 'ana.rengifo.medico@clinica-amazonas.pe',
      passwordHash: medicoHash,
      rol: 'MEDICO',
      doctorId: doctor2.id,
    },
  });
  console.log('Medicos: Carlos Garcia Flores (Medicina General), Ana Rengifo Saldana (Cardiologia)');

  // ---------- Disponibilidad semanal (lunes a viernes) y cupos ----------
  await prisma.doctorWeeklyAvailability.createMany({
    data: [1, 2, 3, 4, 5].map((dia) => ({
      doctorId: doctor1.id,
      diaSemana: dia,
      horaInicio: '08:00',
      horaFin: '13:00',
      duracionSlotMinutos: 20,
    })),
  });
  await prisma.doctorWeeklyAvailability.createMany({
    data: [1, 2, 3, 4, 5].map((dia) => ({
      doctorId: doctor2.id,
      diaSemana: dia,
      horaInicio: '14:00',
      horaFin: '18:00',
      duracionSlotMinutos: 30,
    })),
  });
  const cuposCreados = await generarCuposDesdeDisponibilidad();
  console.log(`Disponibilidad semanal (lunes a viernes) y ${cuposCreados} cupos generados para los proximos ${DIAS_AHEAD} dias.`);

  // ---------- Pacientes (cubriendo distintos tipos de documento y con/sin email, para
  // probar ambas ramas del envio de correo) ----------
  await prisma.patient.create({
    data: {
      nombres: 'Maria',
      apellidos: 'Lopez Torres',
      tipoDocumento: 'DNI',
      documentoIdentidad: '45678912',
      sexo: 'FEMENINO',
      telefono: '911111111',
      email: 'maria.lopez@gmail.com',
      fechaNacimiento: new Date(Date.UTC(1990, 4, 12)),
    },
  });
  await prisma.patient.create({
    data: {
      nombres: 'Jose',
      apellidos: 'Ramirez Diaz',
      tipoDocumento: 'DNI',
      documentoIdentidad: '78912345',
      sexo: 'MASCULINO',
      telefono: '922222222',
      email: 'jose.ramirez@gmail.com',
      fechaNacimiento: new Date(Date.UTC(1985, 8, 3)),
    },
  });
  await prisma.patient.create({
    data: {
      nombres: 'Lucia',
      apellidos: 'Fernandez Rios',
      tipoDocumento: 'CARNET_EXTRANJERIA',
      documentoIdentidad: 'CE-99887766',
      sexo: 'FEMENINO',
      telefono: '933333333',
      fechaNacimiento: new Date(Date.UTC(1998, 1, 20)),
    },
  });
  console.log('Pacientes: Maria Lopez Torres (DNI, con email), Jose Ramirez Diaz (DNI, con email), Lucia Fernandez Rios (Carne de extranjeria, sin email)');

  console.log('\n=== Listo. Credenciales de acceso ===');
  console.log(`Admin:       ${admin.email} / Admin123!`);
  console.log(`Recepcion:   ${recepcionista.email} / Recepcion123!`);
  console.log('Medico 1:    carlos.garcia.medico@clinica-amazonas.pe / Medico123! (Medicina General)');
  console.log('Medico 2:    ana.rengifo.medico@clinica-amazonas.pe / Medico123! (Cardiologia)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
