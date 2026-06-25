import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { IpercAction } from '../../models/IpercAction';
import * as service from './iperc.service';
import { buildFilter, getPagination } from '../../utils/filters';
import { ApiError } from '../../utils/ApiError';
import { RISK_LEVELS, ACTION_STATUS } from '../../constants/enums';

export const ipercSchema = z.object({
  folio: z.string().min(1),
  date: z.coerce.date().optional(),
  area: z.string().min(1),
  process: z.string().optional(),
  machine: z.string().optional(),
  risk: z.string().min(1),
  riskLevel: z.enum(RISK_LEVELS).default('MEDIO'),
  description: z.string().min(1),
  requiredAction: z.string().min(1),
  responsible: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  status: z.enum(ACTION_STATUS).default('ABIERTA'),
  comments: z.string().optional(),
  closeEvidence: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const filter = buildFilter(req);
  const { page, limit, skip } = getPagination(req);
  const [items, total] = await Promise.all([
    IpercAction.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    IpercAction.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, limit });
}

export async function getOne(req: Request, res: Response) {
  const doc = await IpercAction.findById(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function create(req: Request, res: Response) {
  const doc = await service.createIperc(req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  res.status(201).json({ success: true, item: doc });
}

export async function update(req: Request, res: Response) {
  const doc = await service.updateIperc(req.params.id, req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function remove(req: Request, res: Response) {
  const doc = await IpercAction.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true });
}
