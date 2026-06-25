/**
 * Seed inicial: usuario admin, catálogos de ejemplo y datos demo que pueblan
 * la pirámide, las acciones y el dashboard. Ejecutar: `npm run seed`.
 */
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { User } from './models/User';
import { Area } from './models/Area';
import { Machine } from './models/Machine';
import { Catalog } from './models/Catalog';
import { HeinrichRecord } from './models/HeinrichRecord';
import { Action } from './models/Action';
import { ObservationStop } from './models/ObservationStop';
import { ObservationCommission } from './models/ObservationCommission';
import { Incident } from './models/Incident';
import { IpercAction } from './models/IpercAction';
import { createStop } from './modules/observationsStop/stop.service';
import { createCommission } from './modules/commission/commission.service';
import { createIncident } from './modules/incidents/incident.service';
import { createIperc } from './modules/iperc/iperc.service';
import { HEINRICH_LEVELS } from './constants/enums';

const AREAS = [
  { code: 'PROD', name: 'Producción' },
  { code: 'MANT', name: 'Mantenimiento' },
  { code: 'ALM', name: 'Almacén' },
  { code: 'CALID', name: 'Calidad' },
  { code: 'LOG', name: 'Logística' },
];

const MACHINES = [
  { code: 'TORNO-01', name: 'Torno CNC 01', area: 'PROD' },
  { code: 'PRENSA-02', name: 'Prensa Hidráulica 02', area: 'PROD' },
  { code: 'MONTAC-01', name: 'Montacargas 01', area: 'ALM' },
  { code: 'BANDA-03', name: 'Banda transportadora 03', area: 'LOG' },
];

const OBSERVERS = ['J. Pérez', 'M. López', 'R. Sánchez', 'A. Torres', 'L. Gómez'];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randDate(monthsBack = 6): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(Math.random() * monthsBack));
  d.setDate(1 + Math.floor(Math.random() * 27));
  return d;
}

async function run() {
  await connectDB();
  console.log('[seed] Limpiando colecciones demo...');
  await Promise.all([
    User.deleteMany({}),
    Area.deleteMany({}),
    Machine.deleteMany({}),
    Catalog.deleteMany({}),
    HeinrichRecord.deleteMany({}),
    Action.deleteMany({}),
    ObservationStop.deleteMany({}),
    ObservationCommission.deleteMany({}),
    Incident.deleteMany({}),
    IpercAction.deleteMany({}),
  ]);

  // --- Usuarios ---
  const admin = await User.create({
    name: 'Administrador EHS',
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    role: 'ADMIN',
  });
  await User.create({ name: 'Capturista Demo', email: 'capturista@ehs.local', password: 'Captura123*', role: 'CAPTURISTA', area: 'PROD' });
  await User.create({ name: 'Gerencia Demo', email: 'gerencia@ehs.local', password: 'Consulta123*', role: 'CONSULTA' });

  // --- Catálogos ---
  await Area.insertMany(AREAS);
  await Machine.insertMany(MACHINES);
  await Catalog.insertMany([
    { type: 'OBSERVATION_TYPE', code: 'EPP', label: 'Uso de EPP', order: 1 },
    { type: 'OBSERVATION_TYPE', code: 'PROC', label: 'Procedimiento', order: 2 },
    { type: 'OBSERVATION_TYPE', code: 'ORDEN', label: 'Orden y limpieza', order: 3 },
    { type: 'INCIDENT_TYPE', code: 'CAIDA', label: 'Caída', order: 1 },
    { type: 'INCIDENT_TYPE', code: 'GOLPE', label: 'Golpe / Atrapamiento', order: 2 },
    { type: 'INCIDENT_TYPE', code: 'CORTE', label: 'Corte', order: 3 },
    { type: 'FINDING_TYPE', code: 'ELEC', label: 'Riesgo eléctrico', order: 1 },
    { type: 'FINDING_TYPE', code: 'MECAN', label: 'Riesgo mecánico', order: 2 },
  ]);

  console.log('[seed] Generando observaciones STOP...');
  for (let i = 1; i <= 40; i++) {
    await createStop(
      {
        folio: `STOP-${String(i).padStart(4, '0')}`,
        date: randDate(),
        observer: rand(OBSERVERS),
        area: rand(AREAS).code,
        machine: Math.random() > 0.5 ? rand(MACHINES).code : undefined,
        description: 'Observación de comportamiento durante recorrido.',
        level: Math.random() > 0.5 ? 'ACTO_INSEGURO' : 'CONDICION_INSEGURA',
        risk: rand(['BAJO', 'MEDIO', 'ALTO'] as const),
        requiredAction: Math.random() > 0.4 ? 'Reforzar capacitación y señalización.' : undefined,
        responsible: rand(OBSERVERS),
        dueDate: randDate(-2),
      } as never,
      admin._id as never
    );
  }

  console.log('[seed] Generando hallazgos de Comisión...');
  for (let i = 1; i <= 20; i++) {
    await createCommission(
      {
        folio: `COM-${String(i).padStart(4, '0')}`,
        date: randDate(),
        auditor: rand(OBSERVERS),
        area: rand(AREAS).code,
        machine: rand(MACHINES).code,
        description: 'Hallazgo detectado en inspección de comisión.',
        level: rand(['CONDICION_INSEGURA', 'ACTO_INSEGURO', 'CASI_INCIDENTE'] as const),
        risk: rand(['BAJO', 'MEDIO', 'ALTO'] as const),
        correctiveAction: 'Corregir condición detectada.',
        responsible: rand(OBSERVERS),
        dueDate: randDate(-2),
      } as never,
      admin._id as never
    );
  }

  console.log('[seed] Generando incidentes...');
  const incidentLevels = ['CASI_INCIDENTE', 'PRIMEROS_AUXILIOS', 'TRATAMIENTO_MEDICO', 'ACTIVIDAD_RESTRINGIDA', 'LOST_TIME'] as const;
  for (let i = 1; i <= 14; i++) {
    const level = rand(incidentLevels);
    await createIncident(
      {
        folio: `INC-${String(i).padStart(4, '0')}`,
        eventDate: randDate(),
        area: rand(AREAS).code,
        machine: rand(MACHINES).code,
        person: rand(OBSERVERS),
        description: 'Evento registrado en planta.',
        level,
        severity: 1 + Math.floor(Math.random() * 5),
        lostDays: level === 'LOST_TIME' ? 1 + Math.floor(Math.random() * 10) : 0,
        lostTime: level === 'LOST_TIME',
        rootCause: 'Análisis de causa raíz pendiente de cierre.',
        correctiveAction: 'Implementar medida correctiva.',
        responsible: rand(OBSERVERS),
        dueDate: randDate(-2),
        risk: 'ALTO',
      } as never,
      admin._id as never
    );
  }

  console.log('[seed] Generando acciones IPERC...');
  for (let i = 1; i <= 18; i++) {
    await createIperc(
      {
        folio: `IPERC-${String(i).padStart(4, '0')}`,
        date: randDate(),
        area: rand(AREAS).code,
        process: 'Proceso productivo',
        machine: rand(MACHINES).code,
        risk: 'Riesgo identificado en matriz IPERC',
        riskLevel: rand(['BAJO', 'MEDIO', 'ALTO'] as const),
        description: 'Hallazgo de matriz IPERC.',
        requiredAction: 'Acción preventiva derivada de IPERC.',
        responsible: rand(OBSERVERS),
        dueDate: randDate(-2),
        status: rand(['ABIERTA', 'EN_PROCESO', 'CERRADA'] as const),
      } as never,
      admin._id as never
    );
  }

  // Asegura al menos un registro por nivel para visualizar la pirámide completa.
  for (const level of HEINRICH_LEVELS) {
    const folio = `DEMO-${level}`;
    await HeinrichRecord.findOneAndUpdate(
      { folio, source: 'EXCEL' },
      { folio, source: 'EXCEL', date: randDate(), level, area: rand(AREAS).code },
      { upsert: true }
    );
  }

  const counts = {
    heinrich: await HeinrichRecord.countDocuments(),
    actions: await Action.countDocuments(),
  };
  console.log('[seed] Listo. Registros pirámide:', counts.heinrich, '| Acciones:', counts.actions);
  console.log(`[seed] Login admin -> ${env.seedAdminEmail} / ${env.seedAdminPassword}`);

  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
