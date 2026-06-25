import { Schema, model, Document, Types } from 'mongoose';
import { HEINRICH_LEVELS, RISK_LEVELS, ACTION_STATUS, HeinrichLevel, RiskLevel } from '../constants/enums';

/** Incidente / Accidente. Emite HeinrichRecord (con severidad) y Action. */
export interface IIncident extends Document {
  folio: string;
  eventDate: Date;
  captureDate: Date;
  area: string;
  machine?: string;
  person?: string;
  eventType?: string;
  description: string;
  level: HeinrichLevel;
  severity?: number; // 1..5
  lostDays?: number;
  firstAid?: boolean;
  medicalTreatment?: boolean;
  restricted?: boolean;
  lostTime?: boolean;
  immediateCause?: string;
  rootCause?: string;
  correctiveAction?: string;
  responsible?: string;
  dueDate?: Date;
  actionStatus?: string;
  risk: RiskLevel;
  evidence?: string;
  createdBy?: Types.ObjectId;
}

const schema = new Schema<IIncident>(
  {
    folio: { type: String, required: true, unique: true, trim: true },
    eventDate: { type: Date, required: true },
    captureDate: { type: Date, default: Date.now },
    area: { type: String, required: true, trim: true, index: true },
    machine: { type: String, trim: true },
    person: { type: String, trim: true },
    eventType: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    level: { type: String, enum: HEINRICH_LEVELS, default: 'CASI_INCIDENTE', required: true },
    severity: { type: Number, min: 1, max: 5 },
    lostDays: { type: Number, default: 0 },
    firstAid: { type: Boolean, default: false },
    medicalTreatment: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false },
    lostTime: { type: Boolean, default: false },
    immediateCause: { type: String, trim: true },
    rootCause: { type: String, trim: true },
    correctiveAction: { type: String, trim: true },
    responsible: { type: String, trim: true },
    dueDate: { type: Date },
    actionStatus: { type: String, enum: ACTION_STATUS, default: 'ABIERTA' },
    risk: { type: String, enum: RISK_LEVELS, default: 'ALTO' },
    evidence: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Incident = model<IIncident>('Incident', schema);
