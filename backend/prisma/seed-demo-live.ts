// Segunda fase del seeding de demo: usa la API REST real (backend ya corriendo en localhost:3000)
// para generar disponibilidad semanal, cupos futuros, citas próximas en distintos estados,
// entradas de lista de espera y alertas generadas de forma auténtica (eventos reales).

const BASE_URL = 'http://localhost:3000';

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@clinica-amazonas.pe', password: 'Admin123!' }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.accessToken;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

async function main() {
  const token = await login();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  console.log('Login OK. Cargando médicos y pacientes...');
  const doctors: any[] = await call('GET', '/doctors');
  const patients: any[] = await call('GET', '/patients');
  console.log(`Médicos: ${doctors.length}, Pacientes: ${patients.length}`);

  // ---------- Disponibilidad semanal por médico (según su horario ya usado en el histórico) ----------
  const horarios: Record<string, { horaInicio: string; horaFin: string; duracion: number }> = {
    'Carlos Garcia Flores': { horaInicio: '08:00', horaFin: '13:00', duracion: 20 },
    'Rosa Pinedo Vasquez': { horaInicio: '14:00', horaFin: '18:00', duracion: 20 },
    'Ana Rengifo Saldana': { horaInicio: '08:00', horaFin: '12:00', duracion: 15 },
    'Jorge Del Aguila Ruiz': { horaInicio: '09:00', horaFin: '13:00', duracion: 20 },
    'Patricia Vela Chavez': { horaInicio: '08:00', horaFin: '12:00', duracion: 25 },
    'Manuel Tuesta Romero': { horaInicio: '08:00', horaFin: '11:00', duracion: 30 },
    'Ricardo Torres Mendoza': { horaInicio: '14:00', horaFin: '18:00', duracion: 20 },
    'Silvia Amasifuen Rojas': { horaInicio: '08:00', horaFin: '16:00', duracion: 15 },
  };

  const SKIP_AVAILABILITY_AND_SLOTS = true; // ya se generaron en una corrida previa (2508 slots, 40 disponibilidades)

  if (!SKIP_AVAILABILITY_AND_SLOTS) {
    console.log('Creando disponibilidad semanal (lunes a viernes) para cada médico...');
    for (const doctor of doctors) {
      const nombreCompleto = `${doctor.nombres} ${doctor.apellidos}`;
      const cfg = horarios[nombreCompleto];
      if (!cfg) continue;
      for (let dia = 1; dia <= 5; dia++) {
        await call('POST', '/schedules/availability', {
          doctorId: doctor.id,
          diaSemana: dia,
          horaInicio: cfg.horaInicio,
          horaFin: cfg.horaFin,
          duracionSlotMinutos: cfg.duracion,
        });
      }
    }
    console.log('Disponibilidad creada.');

    console.log('Generando cupos (slots) para los próximos días (puede tardar varios minutos)...');
    await fetch(`${BASE_URL}/schedules/generate-slots`, {
      method: 'POST',
      headers,
      body: '{}',
      signal: AbortSignal.timeout(9 * 60 * 1000),
    });
    console.log('Cupos generados.');
  } else {
    console.log('Disponibilidad y cupos ya existentes de una corrida previa; se omite regenerarlos.');
  }

  // ---------- Citas próximas en distintos estados ----------
  const slots: any[] = await call('GET', '/schedules/slots');
  const disponibles = slots.filter((s) => s.estado === 'DISPONIBLE');
  console.log(`Cupos disponibles: ${disponibles.length}`);

  const citasCreadas: any[] = [];
  const numCitasProximas = Math.min(18, disponibles.length);
  const usados = new Set<number>();
  for (let i = 0; i < numCitasProximas; i++) {
    let slot;
    do { slot = pick(disponibles); } while (usados.has(slot.id));
    usados.add(slot.id);

    const patient = pick(patients);
    try {
      const cita = await call('POST', '/appointments', {
        patientId: patient.id,
        doctorId: slot.doctorId,
        slotId: slot.id,
        motivoConsulta: pick(['Control de rutina', 'Dolor persistente', 'Seguimiento de tratamiento', 'Chequeo general', 'Consulta por síntomas recientes']),
      });
      citasCreadas.push(cita);
    } catch (e) {
      console.log('  (aviso) no se pudo crear cita:', (e as Error).message);
    }
  }
  console.log(`Citas próximas creadas: ${citasCreadas.length}`);

  // Avanzar algunas citas de hoy en el flujo real (check-in -> en curso -> completada)
  // para que la pantalla de Citas muestre variedad de estados, no solo PENDIENTE.
  const hoyISO = new Date().toISOString().split('T')[0];
  const citasDeHoy = citasCreadas.filter((c) => c.fecha?.startsWith(hoyISO));
  for (const [idx, cita] of citasDeHoy.entries()) {
    try {
      await call('PATCH', `/appointments/${cita.id}/check-in`, {});
      if (idx % 2 === 0) {
        await call('PATCH', `/appointments/${cita.id}/start`, {});
        if (idx % 4 === 0) {
          await call('PATCH', `/appointments/${cita.id}/complete`, {});
        }
      }
    } catch (e) {
      console.log('  (aviso) no se pudo avanzar estado de cita', cita.id, (e as Error).message);
    }
  }
  console.log(`Citas de hoy con estado avanzado: ${citasDeHoy.length}`);

  // ---------- Lista de espera ----------
  console.log('Creando entradas de lista de espera...');
  const patientsUsados = new Set(citasCreadas.map((c) => c.patientId));
  const patientsLibres = patients.filter((p) => !patientsUsados.has(p.id));
  let waitlistCreadas = 0;
  for (let i = 0; i < Math.min(6, patientsLibres.length); i++) {
    const patient = patientsLibres[i];
    const doctor = pick(doctors);
    try {
      await call('POST', '/waitlist', {
        patientId: patient.id,
        doctorId: doctor.id,
        prioridad: i === 0 ? 'URGENTE' : 'NORMAL',
      });
      waitlistCreadas++;
    } catch (e) {
      console.log('  (aviso) no se pudo crear entrada de lista de espera:', (e as Error).message);
    }
  }
  console.log(`Entradas de lista de espera creadas: ${waitlistCreadas}`);

  // ---------- Disparar alertas reales ----------
  console.log('Disparando eventos reales para generar alertas auténticas...');

  // 1) Cancelar una cita para que, si hay alguien en lista de espera para ese médico, se genere SLOT_LIBRE_DISPONIBLE
  const waitlistEntries: any[] = await call('GET', '/waitlist');
  const esperando = waitlistEntries.find((w: any) => w.estado === 'ESPERANDO' && w.doctorId);
  if (esperando) {
    const citaParaCancelar = citasCreadas.find((c) => c.doctorId === esperando.doctorId);
    if (citaParaCancelar) {
      await call('PATCH', `/appointments/${citaParaCancelar.id}/cancel`);
      console.log(`  Cita ${citaParaCancelar.id} cancelada -> debería generar alerta SLOT_LIBRE_DISPONIBLE para lista de espera ${esperando.id}`);
    }
  }

  // 2) Generar 3 inasistencias reales para un mismo paciente (vía API) -> INASISTENCIA_FRECUENTE
  const pacientePropenso = patients[0];
  for (let i = 0; i < 3; i++) {
    const slotLibre = disponibles.find((s) => !usados.has(s.id));
    if (!slotLibre) break;
    usados.add(slotLibre.id);
    try {
      const cita = await call('POST', '/appointments', {
        patientId: pacientePropenso.id,
        doctorId: slotLibre.doctorId,
        slotId: slotLibre.id,
        motivoConsulta: 'Consulta programada',
      });
      await call('PATCH', `/appointments/${cita.id}/no-show`, {});
      console.log(`  Cita ${cita.id} marcada NO_ASISTIO para paciente ${pacientePropenso.nombres} ${pacientePropenso.apellidos} (${i + 1}/3)`);
    } catch (e) {
      console.log('  (aviso) no se pudo generar no-show:', (e as Error).message);
    }
  }

  const alerts: any[] = await call('GET', '/alerts');
  console.log(`\nTotal de alertas generadas: ${alerts.length}`);
  for (const a of alerts) console.log(`  [${a.tipo}] ${a.mensaje}`);

  console.log('\n=== Seeding de demo completo ===');
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
