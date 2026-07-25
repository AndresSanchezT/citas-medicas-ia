import 'dotenv/config';
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
    allowPublicKeyRetrieval: true,
  });
}

const prisma = new PrismaClient({ adapter: buildAdapter() });

const TABLAS = [
  'alerts',
  'triage',
  'wait_time_history',
  'daily_stats',
  'waitlist_entries',
  'doctor_time_off',
  'appointments',
  'appointment_slots',
  'doctor_weekly_availability',
  'users',
  'doctors',
  'specialties',
  'patients',
];

async function main() {
  // $transaction (interactivo) garantiza que todas las sentencias corran sobre la MISMA
  // conexión del pool; con $executeRawUnsafe suelto, cada llamada puede tomar una conexión
  // distinta del pool y el SET FOREIGN_KEY_CHECKS=0 de una no aplica en la de la siguiente.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
      for (const tabla of TABLAS) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tabla}`);
        console.log(`Vaciada: ${tabla}`);
      }
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
    },
    { timeout: 30000 },
  );
  console.log('Listo: datos de demo reiniciados por completo (incluye el usuario admin).');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
