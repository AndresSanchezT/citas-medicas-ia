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
  });
}

const prisma = new PrismaClient({ adapter: buildAdapter() });

// ---------- utilidades ----------
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function utcMidnightFromLocal(baseDate: Date, dayOffset: number): Date {
  return new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + dayOffset));
}
function toHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function franjaFrom(horaInicio: string): string {
  const h = Number(horaInicio.split(':')[0]);
  return `${h.toString().padStart(2, '0')}:00-${(h + 1).toString().padStart(2, '0')}:00`;
}

const NOMBRES_M = ['Carlos', 'Jose', 'Luis', 'Miguel', 'Jorge', 'Pedro', 'Manuel', 'Fernando', 'Ricardo', 'Diego', 'Alberto', 'Raul', 'Victor', 'Julio', 'Cesar', 'Martin', 'Enrique', 'Roberto', 'Gustavo', 'Oscar'];
const NOMBRES_F = ['Maria', 'Ana', 'Rosa', 'Carmen', 'Luz', 'Patricia', 'Elena', 'Sandra', 'Claudia', 'Veronica', 'Silvia', 'Monica', 'Gabriela', 'Teresa', 'Lucia', 'Karina', 'Diana', 'Paola', 'Ines', 'Yolanda'];
const APELLIDOS = ['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Reyes', 'Morales', 'Gutierrez', 'Chavez', 'Ramos', 'Vargas', 'Castillo', 'Romero', 'Mendoza', 'Ruiz', 'Rojas', 'Medina', 'Vasquez', 'Paredes', 'Pinedo', 'Tuesta', 'Rengifo', 'Vela', 'Amasifuen', 'Saldana', 'Del Aguila'];

function randomPatientName(): { nombres: string; apellidos: string } {
  const esMujer = Math.random() > 0.5;
  const nombres = pick(esMujer ? NOMBRES_F : NOMBRES_M);
  const apellidos = `${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
  return { nombres, apellidos };
}

async function main() {
  console.log('=== Sembrando datos de ejemplo realistas ===');

  // ---------- Especialidades ----------
  const especialidadesNombres = ['Medicina General', 'Pediatria', 'Ginecologia y Obstetricia', 'Cardiologia', 'Traumatologia', 'Odontologia'];
  const especialidades = new Map<string, number>();
  for (const nombre of especialidadesNombres) {
    const esp = await prisma.specialty.create({ data: { nombre } });
    especialidades.set(nombre, esp.id);
  }
  console.log(`Especialidades creadas: ${especialidades.size}`);

  // ---------- Médicos (con "perfil" de velocidad y horario propio) ----------
  interface DoctorSeed {
    nombres: string; apellidos: string; documentoIdentidad: string;
    especialidad: string; horaInicio: string; horaFin: string; duracionSlot: number;
    esperaBaseMin: number; citasPorDiaMin: number; citasPorDiaMax: number;
  }
  const doctorSeeds: DoctorSeed[] = [
    { nombres: 'Carlos', apellidos: 'Garcia Flores', documentoIdentidad: '10203040', especialidad: 'Medicina General', horaInicio: '08:00', horaFin: '13:00', duracionSlot: 20, esperaBaseMin: 15, citasPorDiaMin: 4, citasPorDiaMax: 8 },
    { nombres: 'Rosa', apellidos: 'Pinedo Vasquez', documentoIdentidad: '10203041', especialidad: 'Medicina General', horaInicio: '14:00', horaFin: '18:00', duracionSlot: 20, esperaBaseMin: 22, citasPorDiaMin: 3, citasPorDiaMax: 6 },
    { nombres: 'Ana', apellidos: 'Rengifo Saldana', documentoIdentidad: '10203042', especialidad: 'Pediatria', horaInicio: '08:00', horaFin: '12:00', duracionSlot: 15, esperaBaseMin: 12, citasPorDiaMin: 3, citasPorDiaMax: 7 },
    { nombres: 'Jorge', apellidos: 'Del Aguila Ruiz', documentoIdentidad: '10203043', especialidad: 'Pediatria', horaInicio: '09:00', horaFin: '13:00', duracionSlot: 20, esperaBaseMin: 28, citasPorDiaMin: 2, citasPorDiaMax: 5 },
    { nombres: 'Patricia', apellidos: 'Vela Chavez', documentoIdentidad: '10203044', especialidad: 'Ginecologia y Obstetricia', horaInicio: '08:00', horaFin: '12:00', duracionSlot: 25, esperaBaseMin: 20, citasPorDiaMin: 2, citasPorDiaMax: 5 },
    { nombres: 'Manuel', apellidos: 'Tuesta Romero', documentoIdentidad: '10203045', especialidad: 'Cardiologia', horaInicio: '08:00', horaFin: '11:00', duracionSlot: 30, esperaBaseMin: 35, citasPorDiaMin: 3, citasPorDiaMax: 6 },
    { nombres: 'Ricardo', apellidos: 'Torres Mendoza', documentoIdentidad: '10203046', especialidad: 'Traumatologia', horaInicio: '14:00', horaFin: '18:00', duracionSlot: 20, esperaBaseMin: 18, citasPorDiaMin: 2, citasPorDiaMax: 5 },
    { nombres: 'Silvia', apellidos: 'Amasifuen Rojas', documentoIdentidad: '10203047', especialidad: 'Odontologia', horaInicio: '08:00', horaFin: '16:00', duracionSlot: 15, esperaBaseMin: 10, citasPorDiaMin: 4, citasPorDiaMax: 9 },
  ];

  const doctores: (DoctorSeed & { id: number })[] = [];
  for (const seed of doctorSeeds) {
    const doctor = await prisma.doctor.create({
      data: {
        nombres: seed.nombres,
        apellidos: seed.apellidos,
        documentoIdentidad: seed.documentoIdentidad,
        specialtyId: especialidades.get(seed.especialidad)!,
        telefono: `9${randInt(10000000, 99999999)}`,
        email: Math.random() > 0.4 ? `${seed.nombres.toLowerCase()}.${seed.apellidos.split(' ')[0].toLowerCase()}@clinica-amazonas.pe` : null,
      },
    });
    doctores.push({ ...seed, id: doctor.id });
  }
  console.log(`Médicos creados: ${doctores.length}`);

  // ---------- Pacientes ----------
  // Cada paciente recibe una tendencia real (oculta, no se guarda en BD) a no asistir a sus
  // citas: la mayoría son "confiables" y una minoría "inconstantes". Esto le da al histórico
  // una correlación real entre inasistencias pasadas y futuras, necesaria para que el modelo
  // de clasificación de riesgo de inasistencia tenga algo genuino que aprender (antes, la
  // probabilidad era fija e independiente del paciente, así que el modelo no podía superar
  // el azar).
  const pacientes: { id: number; nombres: string; apellidos: string; noShowTendencia: number }[] = [];
  const documentosUsados = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const { nombres, apellidos } = randomPatientName();
    let doc: string;
    do { doc = String(randInt(20000000, 79999999)); } while (documentosUsados.has(doc));
    documentosUsados.add(doc);

    const patient = await prisma.patient.create({
      data: {
        nombres,
        apellidos,
        documentoIdentidad: doc,
        telefono: Math.random() > 0.3 ? `9${randInt(10000000, 99999999)}` : null,
        email: Math.random() > 0.5 ? `${nombres.toLowerCase()}.${apellidos.split(' ')[0].toLowerCase()}${randInt(1, 99)}@gmail.com` : null,
        fechaNacimiento: new Date(Date.UTC(randInt(1950, 2020), randInt(0, 11), randInt(1, 28))),
      },
    });
    const noShowTendencia = Math.random() < 0.25 ? randInt(20, 40) / 100 : randInt(1, 6) / 100;
    pacientes.push({ id: patient.id, nombres, apellidos, noShowTendencia });
  }
  console.log(`Pacientes creados: ${pacientes.length}`);

  // ---------- Historial de citas pasadas (últimos 35 días) ----------
  const hoy = new Date();
  const DIAS_HISTORIA = 35;
  let totalHistoricas = 0;

  for (let dayOffset = -DIAS_HISTORIA; dayOffset < 0; dayOffset++) {
    const fecha = utcMidnightFromLocal(hoy, dayOffset);
    const diaSemanaLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dayOffset).getDay();
    if (diaSemanaLocal === 0 || diaSemanaLocal === 6) continue; // fines de semana sin atención

    for (const doc of doctores) {
      const inicioMin = Number(doc.horaInicio.split(':')[0]) * 60 + Number(doc.horaInicio.split(':')[1]);
      const finMin = Number(doc.horaFin.split(':')[0]) * 60 + Number(doc.horaFin.split(':')[1]);
      const slotsDisponibles = Math.floor((finMin - inicioMin) / doc.duracionSlot);
      const numCitas = Math.min(randInt(doc.citasPorDiaMin, doc.citasPorDiaMax), slotsDisponibles);

      const horariosUsados = new Set<number>();
      for (let c = 0; c < numCitas; c++) {
        let slotIdx: number;
        do { slotIdx = randInt(0, slotsDisponibles - 1); } while (horariosUsados.has(slotIdx));
        horariosUsados.add(slotIdx);

        const horaInicio = toHHMM(inicioMin + slotIdx * doc.duracionSlot);
        const horaFin = toHHMM(inicioMin + (slotIdx + 1) * doc.duracionSlot);
        const paciente = pick(pacientes);

        const roll = Math.random();
        const [h, m] = horaInicio.split(':').map(Number);
        const horaBase = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), h, m));

        // Anticipación real de reserva (1-14 días antes de la cita), en vez de dejar
        // created_at en el momento de la siembra para todas las citas históricas por igual
        // (eso hacía que "días de anticipación" fuera siempre 0 para el entrenamiento).
        const diasAnticipacion = randInt(1, 14);
        const createdAt = new Date(fecha.getTime() - diasAnticipacion * 24 * 60 * 60 * 1000);
        // Una anticipación más larga incrementa levemente el riesgo real de inasistencia
        // (patrón documentado en la literatura de no-show clínico).
        const umbralNoShow = paciente.noShowTendencia + diasAnticipacion * 0.004;

        if (roll < umbralNoShow) {
          // No asistió
          await prisma.appointment.create({
            data: {
              patientId: paciente.id, doctorId: doc.id, fecha, horaInicio, horaFin,
              estado: 'NO_ASISTIO', motivoConsulta: 'Consulta programada', createdAt,
            },
          });
        } else if (roll < umbralNoShow + 0.05) {
          // Cancelada
          await prisma.appointment.create({
            data: {
              patientId: paciente.id, doctorId: doc.id, fecha, horaInicio, horaFin,
              estado: 'CANCELADA', motivoConsulta: 'Consulta programada', createdAt,
            },
          });
        } else {
          // Completada, con tiempos reales realistas
          const esperaMin = Math.max(2, Math.round(doc.esperaBaseMin + (Math.random() - 0.5) * 16 + (diaSemanaLocal === 1 ? 6 : 0)));
          const duracionConsultaMin = randInt(10, 25);
          const llegada = horaBase;
          const inicioAtencion = new Date(llegada.getTime() + esperaMin * 60000);
          const finAtencion = new Date(inicioAtencion.getTime() + duracionConsultaMin * 60000);

          await prisma.appointment.create({
            data: {
              patientId: paciente.id, doctorId: doc.id, fecha, horaInicio, horaFin,
              estado: 'COMPLETADA', motivoConsulta: 'Consulta programada', createdAt,
              horaLlegadaReal: llegada, horaAtencionInicioReal: inicioAtencion, horaAtencionFinReal: finAtencion,
              waitTimeHistory: {
                create: {
                  doctorId: doc.id,
                  diaSemana: diaSemanaLocal,
                  franjaHoraria: franjaFrom(horaInicio),
                  tiempoEsperaMinutosReal: esperaMin,
                  fechaRegistro: fecha,
                },
              },
            },
          });
        }
        totalHistoricas++;
      }
    }
  }
  console.log(`Citas históricas creadas: ${totalHistoricas}`);

  // ---------- DailyStats agregados a partir del histórico ----------
  let statsCreados = 0;
  for (const doc of doctores) {
    const citas = await prisma.appointment.findMany({ where: { doctorId: doc.id } });
    const porFecha = new Map<string, typeof citas>();
    for (const c of citas) {
      const key = c.fecha.toISOString().split('T')[0];
      if (!porFecha.has(key)) porFecha.set(key, []);
      porFecha.get(key)!.push(c);
    }
    for (const [key, citasDelDia] of porFecha) {
      const completadas = citasDelDia.filter((c) => c.estado === 'COMPLETADA').length;
      const noShow = citasDelDia.filter((c) => c.estado === 'NO_ASISTIO').length;
      const historial = await prisma.waitTimeHistory.findMany({
        where: { doctorId: doc.id, fechaRegistro: new Date(key) },
      });
      const tiempos = historial.map((h) => h.tiempoEsperaMinutosReal);
      const promedio = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
      const maximo = tiempos.length ? Math.max(...tiempos) : null;

      await prisma.dailyStats.upsert({
        where: { doctorId_fecha: { doctorId: doc.id, fecha: new Date(key) } },
        create: {
          doctorId: doc.id, fecha: new Date(key),
          totalCitasProgramadas: citasDelDia.length, totalCitasCompletadas: completadas,
          totalNoShow: noShow, tiempoEsperaPromedioMinutos: promedio, tiempoEsperaMaxMinutos: maximo,
        },
        update: {
          totalCitasProgramadas: citasDelDia.length, totalCitasCompletadas: completadas,
          totalNoShow: noShow, tiempoEsperaPromedioMinutos: promedio, tiempoEsperaMaxMinutos: maximo,
        },
      });
      statsCreados++;
    }
  }
  console.log(`DailyStats generados: ${statsCreados}`);

  console.log('\n=== Datos históricos listos ===');
  console.log('Ahora corre: npx tsx prisma/seed-demo-live.ts');
  console.log('para generar disponibilidad, cupos futuros, citas próximas, lista de espera y alertas reales via API.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
