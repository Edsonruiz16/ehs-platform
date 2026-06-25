import { HeinrichRecord } from '../../models/HeinrichRecord';
import { Action, dueState } from '../../models/Action';
import { HEINRICH_LEVELS, HEINRICH_LABELS } from '../../constants/enums';

type Filter = Record<string, unknown>;

/** Conteo por nivel de pirámide (incluye niveles en cero para UI estable). */
export async function pyramidByLevel(filter: Filter) {
  const rows = await HeinrichRecord.aggregate([
    { $match: filter },
    { $group: { _id: '$level', count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return HEINRICH_LEVELS.map((level) => ({
    level,
    label: HEINRICH_LABELS[level],
    count: map.get(level) ?? 0,
  }));
}

/** Distribución por origen (STOP / Comisión / Incidente / IPERC / Excel). */
export async function bySource(filter: Filter) {
  return HeinrichRecord.aggregate([
    { $match: filter },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $project: { _id: 0, source: '$_id', count: 1 } },
    { $sort: { count: -1 } },
  ]);
}

/** Tendencia mensual por nivel (para gráfica de líneas/barras apiladas). */
export async function monthlyTrend(filter: Filter) {
  const rows = await HeinrichRecord.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { y: { $year: '$date' }, m: { $month: '$date' }, level: '$level' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);

  const byMonth = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, '0')}`;
    if (!byMonth.has(key)) {
      const base: Record<string, number | string> = { month: key };
      HEINRICH_LEVELS.forEach((l) => (base[l] = 0));
      byMonth.set(key, base);
    }
    byMonth.get(key)![r._id.level] = r.count;
  }
  return Array.from(byMonth.values());
}

/** Top áreas por nivel específico (condiciones, actos, etc.). */
export async function topAreasByLevel(filter: Filter, level: string, limit = 10) {
  return HeinrichRecord.aggregate([
    { $match: { ...filter, level } },
    { $group: { _id: '$area', count: { $sum: 1 } } },
    { $project: { _id: 0, area: '$_id', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

/** Registros por área (cualquier nivel). */
export async function byArea(filter: Filter, limit = 12) {
  return HeinrichRecord.aggregate([
    { $match: filter },
    { $group: { _id: '$area', count: { $sum: 1 } } },
    { $project: { _id: 0, area: '$_id', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

/** Registros por máquina/equipo. */
export async function byMachine(filter: Filter, limit = 12) {
  return HeinrichRecord.aggregate([
    { $match: { ...filter, machine: { $ne: null } } },
    { $group: { _id: '$machine', count: { $sum: 1 } } },
    { $project: { _id: 0, machine: '$_id', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

/** Resumen de acciones: estatus, riesgo y vencimiento. */
export async function actionsSummary(actionFilter: Filter) {
  const all = await Action.find(actionFilter).select('status risk dueDate').lean();
  const byStatus = { ABIERTA: 0, EN_PROCESO: 0, CERRADA: 0 };
  const byRisk = { BAJO: 0, MEDIO: 0, ALTO: 0 };
  const byDue = { AL_DIA: 0, POR_VENCER: 0, VENCIDA: 0, CERRADA: 0 };
  for (const a of all) {
    byStatus[a.status as keyof typeof byStatus]++;
    byRisk[a.risk as keyof typeof byRisk]++;
    byDue[dueState(a as never) as keyof typeof byDue]++;
  }
  return { total: all.length, byStatus, byRisk, byDue };
}

/** Top responsables con acciones abiertas / en proceso. */
export async function topResponsibles(actionFilter: Filter, limit = 10) {
  return Action.aggregate([
    { $match: { ...actionFilter, status: { $in: ['ABIERTA', 'EN_PROCESO'] } } },
    { $group: { _id: '$responsible', open: { $sum: 1 } } },
    { $project: { _id: 0, responsible: '$_id', open: 1 } },
    { $sort: { open: -1 } },
    { $limit: limit },
  ]);
}
