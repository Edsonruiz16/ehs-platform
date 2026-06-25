import { Schema, model, Document, Types } from 'mongoose';
import { HEINRICH_LEVELS, RISK_LEVELS, ACTION_STATUS, HeinrichLevel, RiskLevel } from '../constants/enums';

/** Hallazgo de la Comisión de Seguridad e Higiene. Emite HeinrichRecord y Action. */
export interface IObservationCommission extends Document {
  folio: string;
  date: Date;
  auditor: string;
  area: string;
  machine?: string;
  findingType?: string;
  description: string;
  level: HeinrichLevel;
  risk: RiskLevel;
  correctiveAction?: string;
  responsible?: string;
  dueDate?: Date;
  actionStatus?: string;
  comments?: string;
  createdBy?: Types.ObjectId;
}

const schema = new Schema<IObservationCommission>(
  {
    folio: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, required: true },
    auditor: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true, index: true },
    machine: { type: String, trim: true },
    findingType: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    level: { type: String, enum: HEINRICH_LEVELS, default: 'CONDICION_INSEGURA', required: true },
    risk: { type: String, enum: RISK_LEVELS, default: 'MEDIO' },
    correctiveAction: { type: String, trim: true },
    responsible: { type: String, trim: true },
    dueDate: { type: Date },
    actionStatus: { type: String, enum: ACTION_STATUS, default: 'ABIERTA' },
    comments: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ObservationCommission = model<IObservationCommission>('ObservationCommission', schema);
