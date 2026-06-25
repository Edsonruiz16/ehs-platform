import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ImportJob } from '../../models/ImportJob';
import * as svc from './import.service';

/** Paso 1: sube el archivo y devuelve columnas + primeras filas (preview). */
export async function preview(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('Archivo no proporcionado (campo "file")');
  const { columns, rows } = svc.parseExcel(req.file.buffer);
  res.json({
    success: true,
    columns,
    preview: rows.slice(0, 10),
    totalRows: rows.length,
  });
}

/**
 * Paso 2: importa con el mapeo confirmado. El archivo se reenvía junto con
 * el mapping y el target. Genera log de importación.
 */
export async function commit(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest('Archivo no proporcionado (campo "file")');
  const target = req.body.target as svc.ImportTarget;
  if (!['HEINRICH', 'STOP', 'COMMISSION', 'INCIDENT', 'IPERC'].includes(target)) {
    throw ApiError.badRequest('Destino (target) inválido');
  }
  let mapping: Record<string, string> = {};
  try {
    mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping ?? {};
  } catch {
    throw ApiError.badRequest('Mapping inválido (JSON)');
  }

  const { rows } = svc.parseExcel(req.file.buffer);
  const userId = req.user ? new Types.ObjectId(req.user.id) : undefined;
  const result = await svc.importRows(target, rows, mapping, userId);
  const job = await svc.logImport(req.file.originalname, target, result, mapping, userId);

  res.json({ success: true, result, jobId: job._id });
}

/** Historial de importaciones. */
export async function history(_req: Request, res: Response) {
  const items = await ImportJob.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, items });
}
