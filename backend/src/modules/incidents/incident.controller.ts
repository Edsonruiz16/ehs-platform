import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Incident } from '../../models/Incident';
import * as service from './incident.service';
import { buildFilter, getPagination } from '../../utils/filters';
import { ApiError } from '../../utils/ApiError';
import { HEINRICH_LEVELS, RISK_LEVELS } from '../../constants/enums';

export const incidentSchema = z.object({
  folio: z.string().min(1),
  eventDate: z.coerce.date(),
  captureDate: z.coerce.date().optional(),
  area: z.string().min(1),
  machine: z.string().optional(),
  person: z.string().optional(),
  eventType: z.string().optional(),
  description: z.string().min(1),
  level: z.enum(HEINRICH_LEVELS).default('CASI_INCIDENTE'),
  severity: z.coerce.number().min(1).max(5).optional(),
  lostDays: z.coerce.number().min(0).optional(),
  firstAid: z.boolean().optional(),
  medicalTreatment: z.boolean().optional(),
  restricted: z.boolean().optional(),
  lostTime: z.boolean().optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  responsible: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  actionStatus: z.string().optional(),
  risk: z.enum(RISK_LEVELS).default('ALTO'),
  evidence: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const filter = buildFilter(req, 'eventDate');
  const { page, limit, skip } = getPagination(req);
  const [items, total] = await Promise.all([
    Incident.find(filter).sort({ eventDate: -1 }).skip(skip).limit(limit),
    Incident.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, limit });
}

export async function getOne(req: Request, res: Response) {
  const doc = await Incident.findById(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function create(req: Request, res: Response) {
  const doc = await service.createIncident(req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  res.status(201).json({ success: true, item: doc });
}

export async function update(req: Request, res: Response) {
  const doc = await service.updateIncident(req.params.id, req.body, req.user ? new Types.ObjectId(req.user.id) : undefined);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
}

export async function remove(req: Request, res: Response) {
  const doc = await Incident.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound();
  res.json({ success: true });
}
