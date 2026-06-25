import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ObservationStop } from '../../models/ObservationStop';
import * as service from './stop.service';
import { buildFilter, getPagination } from '../../utils/filters';
import { ApiError } from '../../utils/ApiError';
import { HEINRICH_LEVELS, RISK_LEVELS } from '../../constants/enums';

export const stopSchema = z.object({
  folio: z.string().min(1),
  date: z.coerce.date(),
  observer: z.string().min(1),
  area: z.string().min(1),
  machine: z.string().optional(),
  observationType: z.string().optional(),
  description: z.string().min(1),
  level: z.enum(HEINRICH_LEVELS).default('ACTO_INSEGURO'),
  risk: z.enum(RISK_LEVELS).default('MEDIO'),
  requiredAction: z.string().optional(),
  responsible: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  actionStatus: z.string().optional(),
  evidence: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const filter = buildFilter(req);
  const { page, limit, skip } = getPagination(req);
  const [items, total] = await Promise.all([
    ObservationStop.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    ObservationStop.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, limit });
}

export async function getOne(req: Request, res: Response) {
  const doc = await ObservationStop.findById(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function create(req: Request, res: Response) {
  const doc = await service.createStop(req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  res.status(201).json({ success: true, item: doc });
}

export async function update(req: Request, res: Response) {
  const doc = await service.updateStop(req.params.id, req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function remove(req: Request, res: Response) {
  const doc = await ObservationStop.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true });
}
