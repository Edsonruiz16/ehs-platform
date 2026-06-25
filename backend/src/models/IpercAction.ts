import { Schema, model, Document, Types } from 'mongoose';
import { RISK_LEVELS, ACTION_STATUS, RiskLevel } from '../constants/enums';

/**
 * Acción derivada de matriz IPERC. No es nivel de pirámide: sólo genera Action
 * en el motor central (source = IPERC).
 */
export interface IIpercAction extends Document {
  folio: string;
  date: Date;
  area: string;
  process?: string;
  machine?: string;
  risk: string;
  riskLevel: RiskLevel;
  description: string;
  requiredAction: string;
  responsible: string;
  dueDate?: Date;
  status: string;
  comments?: string;
  closeEvidence?: string;
  createdBy?: Types.ObjectId;
}

const schema = new Schema<IIpercAction>(
  {
    folio: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, required: true, default: Date.now },
    area: { type: String, required: true, trim: true, index: true },
    process: { type: String, trim: true },
    machine: { type: String, trim: true },
    risk: { type: String, required: true, trim: true },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'MEDIO' },
    description: { type: String, required: true, trim: true },
    requiredAction: { type: String, required: true, trim: true },
    responsible: { type: String, required: true, trim: true },
    dueDate: { type: Date },
    status: { type: String, enum: ACTION_STATUS, default: 'ABIERTA' },
    comments: { type: String, trim: true },
    closeEvidence: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const IpercAction = model<IIpercAction>('IpercAction', schema);
