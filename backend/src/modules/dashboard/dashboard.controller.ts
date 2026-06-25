import { Request, Response } from 'express';
import { buildFilter } from '../../utils/filters';
import * as svc from './dashboard.service';

/**
 * Endpoint único que arma todo el dashboard ejecutivo en una sola llamada,
 * respetando los filtros globales (fecha/área/máquina/origen/...).
 */
export async function overview(req: Request, res: Response) {
  const hFilter = buildFilter(req); // sobre heinrich_records (campo date)
  // Las acciones se filtran por área/riesgo/estatus; reutilizamos sin el campo level.
  const aFilter = buildFilter(req, 'dueDate');
  delete (aFilter as Record<string, unknown>).level;

  const [
    pyramid,
    bySource,
    monthly,
    byArea,
    byMachine,
    topConditions,
    topActs,
    actionsSummary,
    topResponsibles,
  ] = await Promise.all([
    svc.pyramidByLevel(hFilter),
    svc.bySource(hFilter),
    svc.monthlyTrend(hFilter),
    svc.byArea(hFilter),
    svc.byMachine(hFilter),
    svc.topAreasByLevel(hFilter, 'CONDICION_INSEGURA'),
    svc.topAreasByLevel(hFilter, 'ACTO_INSEGURO'),
    svc.actionsSummary(aFilter),
    svc.topResponsibles(aFilter),
  ]);

  res.json({
    success: true,
    data: {
      pyramid,
      bySource,
      monthly,
      byArea,
      byMachine,
      topConditions,
      topActs,
      actionsSummary,
      topResponsibles,
    },
  });
}

/** Pirámide aislada (módulo de Heinrich). */
export async function pyramid(req: Request, res: Response) {
  const filter = buildFilter(req);
  const [pyramid, monthly, bySource] = await Promise.all([
    svc.pyramidByLevel(filter),
    svc.monthlyTrend(filter),
    svc.bySource(filter),
  ]);
  res.json({ success: true, data: { pyramid, monthly, bySource } });
}
