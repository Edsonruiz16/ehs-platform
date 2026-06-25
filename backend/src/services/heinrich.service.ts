import { Types } from 'mongoose';
import { HeinrichRecord } from '../models/HeinrichRecord';
import { HeinrichLevel, RiskLevel, Source } from '../constants/enums';

export interface EmitHeinrichInput {
  folio: string;
  date: Date;
  level: HeinrichLevel;
  source: Source;
  sourceRef?: Types.ObjectId;
  severity?: number;
  risk?: RiskLevel;
  area?: string;
  machine?: string;
  description?: string;
  createdBy?: Types.ObjectId;
}

/**
 * Inserta/actualiza (upsert por folio+source) el registro normalizado que
 * alimenta la pirámide y el dashboard. Llamado desde cada fuente al crear/editar.
 */
export async function emitHeinrichRecord(input: EmitHeinrichInput) {
  return HeinrichRecord.findOneAndUpdate(
    { folio: input.folio, source: input.source },
    { $set: input },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Elimina el registro normalizado asociado a una fuente (al borrar el origen). */
export async function removeHeinrichRecord(folio: string, source: Source) {
  return HeinrichRecord.deleteOne({ folio, source });
}
