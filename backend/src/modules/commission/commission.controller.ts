import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ObservationCommission } from '../../models/ObservationCommission';
import * as service from './commission.service';
import { buildFilter, getPagination } from '../../utils/filters';
import { ApiError } from '../../utils/ApiError';
import { HEINRICH_LEVELS, RISK_LEVELS } from '../../constants/enums';

export const commissionSchema = z.object({
  folio: z.string().min(1),
  date: z.coerce.date(),
  auditor: z.string().min(1),
  area: z.string().min(1),
  machine: z.string().optional(),
  findingType: z.string().optional(),
  description: z.string().min(1),
  level: z.enum(HEINRICH_LEVELS).default('CONDICION_INSEGURA'),
  risk: z.enum(RISK_LEVELS).default('MEDIO'),
  correctiveAction: z.string().optional(),
  responsible: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  actionStatus: z.string().optional(),
  comments: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const filter = buildFilter(req);
  const { page, limit, skip } = getPagination(req);
  const [items, total] = await Promise.all([
    ObservationCommission.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    ObservationCommission.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, limit });
}

export async function getOne(req: Request, res: Response) {
  const doc = await ObservationCommission.findById(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function create(req: Request, res: Response) {
  const doc = await service.createCommission(req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  res.status(201).json({ success: true, item: doc });
}

export async function update(req: Request, res: Response) {
  const doc = await service.updateCommission(
    req.params.id,
    req.body,
    req.user ? new Types.ObjectId(req.user.id) : undefined
  );
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function remove(req: Request, res: Response) {
  const doc = await ObservationCommission.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true });
}
