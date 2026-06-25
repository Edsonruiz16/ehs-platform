import { Schema, model, Document, Types } from 'mongoose';
import { HEINRICH_LEVELS, SOURCES, RISK_LEVELS, HeinrichLevel, Source, RiskLevel } from '../constants/enums';

/**
 * Tabla NORMALIZADA que alimenta la Pirámide de Heinrich y todo el dashboard.
 * Cada fuente (STOP, Comisión, Incidente, Excel) emite aquí un registro.
 * La severidad es atributo ordinal (1..5), no nivel.
 */
export interface IHeinrichRecord extends Document {
  folio: string;
  date: Date;
  level: HeinrichLevel;
  severity?: number;
  risk?: RiskLevel;
  source: Source;
  sourceRef?: Types.ObjectId; // documento de negocio original
  area?: string;
  machine?: string;
  description?: string;
  createdBy?: Types.ObjectId;
}

const heinrichSchema = new Schema<IHeinrichRecord>(
  {
    folio: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    level: { type: String, enum: HEINRICH_LEVELS, required: true, index: true },
    severity: { type: Number, min: 1, max: 5 },
    risk: { type: String, enum: RISK_LEVELS },
    source: { type: String, enum: SOURCES, required: true, index: true },
    sourceRef: { type: Schema.Types.ObjectId },
    area: { type: String, trim: true, index: true },
    machine: { type: String, trim: true },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Índices compuestos para los filtros del dashboard.
heinrichSchema.index({ date: -1, area: 1, level: 1 });
heinrichSchema.index({ source: 1, date: -1 });
// Evita que una misma fuente duplique el registro normalizado.
heinrichSchema.index({ folio: 1, source: 1 }, { unique: true });

export const HeinrichRecord = model<IHeinrichRecord>('HeinrichRecord', heinrichSchema);
