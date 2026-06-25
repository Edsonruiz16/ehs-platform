import { Request } from 'express';

/** Construye un filtro Mongo a partir de los query params globales del dashboard. */
export function buildFilter(req: Request, dateField = 'date'): Record<string, unknown> {
  const { from, to, area, machine, source, status, risk, responsible, level, year, month } = req.query as Record<
    string,
    string
  >;
  const filter: Record<string, unknown> = {};

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);
  if (year) {
    const y = Number(year);
    const m = month ? Number(month) - 1 : undefined;
    if (m !== undefined) {
      dateFilter.$gte = new Date(y, m, 1);
      dateFilter.$lte = new Date(y, m + 1, 0, 23, 59, 59);
    } else {
      dateFilter.$gte = new Date(y, 0, 1);
      dateFilter.$lte = new Date(y, 11, 31, 23, 59, 59);
    }
  }
  if (Object.keys(dateFilter).length) filter[dateField] = dateFilter;

  if (area) filter.area = area;
  if (machine) filter.machine = machine;
  if (source) filter.source = source;
  if (status) filter.status = status;
  if (risk) filter.risk = risk;
  if (responsible) filter.responsible = responsible;
  if (level) filter.level = level;

  return filter;
}

/** Paginación estándar. */
export function getPagination(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 25)));
  return { page, limit, skip: (page - 1) * limit };
}
