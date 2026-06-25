import { Schema, model, Document, Types } from 'mongoose';
import { HEINRICH_LEVELS, RISK_LEVELS, ACTION_STATUS, HeinrichLevel, RiskLevel } from '../constants/enums';

/** Observación STOP (comportamiento seguro). Emite HeinrichRecord y, si aplica, Action. */
export interface IObservationStop extends Document {
  folio: string;
  date: Date;
  observer: string;
  area: string;
  machine?: string;
  observationType?: string;
  description: string;
  level: HeinrichLevel; // normalmente ACTO_INSEGURO / CONDICION_INSEGURA
  risk: RiskLevel;
  requiredAction?: string;
  responsible?: string;
  dueDate?: Date;
  actionStatus?: string;
  evidence?: string;
  createdBy?: Types.ObjectId;
}

const schema = new Schema<IObservationStop>(
  {
    folio: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, required: true },
    observer: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true, index: true },
    machine: { type: String, trim: true },
    observationType: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    level: { type: String, enum: HEINRICH_LEVELS, default: 'ACTO_INSEGURO', required: true },
    risk: { type: String, enum: RISK_LEVELS, default: 'MEDIO' },
    requiredAction: { type: String, trim: true },
    responsible: { type: String, trim: true },
    dueDate: { type: Date },
    actionStatus: { type: String, enum: ACTION_STATUS, default: 'ABIERTA' },
    evidence: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ObservationStop = model<IObservationStop>('ObservationStop', schema);
