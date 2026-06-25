import { Request, Response } from 'express';
import { Model } from 'mongoose';
import { ApiError } from '../../utils/ApiError';

/** Genera handlers CRUD estándar para catálogos simples. */
export function crudFactory<T>(model: Model<T>, options?: { searchFields?: string[]; sort?: Record<string, 1 | -1> }) {
  return {
    async list(req: Request, res: Response) {
      const q: Record<string, unknown> = {};
      if (req.query.type) q.type = req.query.type;
      if (req.query.active) q.active = req.query.active === 'true';
      if (req.query.q && options?.searchFields?.length) {
        const rx = new RegExp(String(req.query.q), 'i');
        q.$or = options.searchFields.map((f) => ({ [f]: rx }));
      }
      const items = await model.find(q).sort(options?.sort ?? { createdAt: -1 });
      res.json({ success: true, items });
    },
    async create(req: Request, res: Response) {
      const item = await model.create(req.body);
      res.status(201).json({ success: true, item });
    },
    async update(req: Request, res: Response) {
      const item = await model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!item) throw ApiError.notFound();
      res.json({ success: true, item });
    },
    async remove(req: Request, res: Response) {
      const item = await model.findByIdAndDelete(req.params.id);
      if (!item) throw ApiError.notFound();
      res.json({ success: true });
    },
  };
}
