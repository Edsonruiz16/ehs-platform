import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Action, dueState } from '../../models/Action';
import { changeActionStatus } from '../../services/action.service';
import { buildFilter, getPagination } from '../../utils/filters';
import { ApiError } from '../../utils/ApiError';
import { ACTION_STATUS } from '../../constants/enums';

export const statusSchema = z.object({
  status: z.enum(ACTION_STATUS),
  evidence: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const filter = buildFilter(req, 'dueDate');
  // Soporte de filtro por estado de vencimiento.
  const { due } = req.query as Record<string, string>;
  const { page, limit, skip } = getPagination(req);

  let items = await Action.find(filter).sort({ dueDate: 1 }).skip(skip).limit(limit).lean();
  const total = await Action.countDocuments(filter);

  let withDue = items.map((a) => ({ ...a, dueState: dueState(a as never) }));
  if (due) withDue = withDue.filter((a) => a.dueState === due);

  res.json({ success: true, items: withDue, total, page, limit });
}

export async function getOne(req: Request, res: Response) {
  const doc = await Action.findById(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: { ...doc.toObject(), dueState: dueState(doc) } });
}

export async function updateStatus(req: Request, res: Response) {
  const doc = await changeActionStatus(
    req.params.id,
    req.body.status,
    req.user ? new Types.ObjectId(req.user.id) : undefined,
    req.body.evidence
  );
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

/** Resumen para tarjetas KPI del módulo de acciones. */
export async function summary(req: Request, res: Response) {
  const filter = buildFilter(req, 'dueDate');
  const all = await Action.find(filter).select('status risk dueDate').lean();

  const byStatus = { ABIERTA: 0, EN_PROCESO: 0, CERRADA: 0 };
  const byRisk = { BAJO: 0, MEDIO: 0, ALTO: 0 };
  const byDue = { AL_DIA: 0, POR_VENCER: 0, VENCIDA: 0, CERRADA: 0 };

  for (const a of all) {
    byStatus[a.status as keyof typeof byStatus]++;
    byRisk[a.risk as keyof typeof byRisk]++;
    byDue[dueState(a as never) as keyof typeof byDue]++;
  }

  res.json({ success: true, total: all.length, byStatus, byRisk, byDue });
}
