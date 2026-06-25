import { Schema, model, Document, Types } from 'mongoose';
import { SOURCES, RISK_LEVELS, ACTION_STATUS, Source, RiskLevel, ActionStatus } from '../constants/enums';

interface IHistoryEntry {
  at: Date;
  by?: Types.ObjectId;
  field: string;
  from?: string;
  to?: string;
}

/**
 * MOTOR ÚNICO DE ACCIONES. Toda acción correctiva/preventiva —venga de STOP,
 * Comisión, Incidente, IPERC o Excel— termina aquí para análisis global.
 */
export interface IAction extends Document {
  folio: string;
  source: Source;
  sourceRef?: Types.ObjectId;
  area?: string;
  machine?: string;
  description: string;
  requiredAction: string;
  risk: RiskLevel;
  responsible: string;
  dueDate?: Date;
  status: ActionStatus;
  closedAt?: Date;
  evidence: string[];
  comments?: string;
  history: IHistoryEntry[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const actionSchema = new Schema<IAction>(
  {
    folio: { type: String, required: true, trim: true },
    source: { type: String, enum: SOURCES, required: true, index: true },
    sourceRef: { type: Schema.Types.ObjectId },
    area: { type: String, trim: true, index: true },
    machine: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    requiredAction: { type: String, required: true, trim: true },
    risk: { type: String, enum: RISK_LEVELS, default: 'MEDIO', index: true },
    responsible: { type: String, required: true, trim: true, index: true },
    dueDate: { type: Date, index: true },
    status: { type: String, enum: ACTION_STATUS, default: 'ABIERTA', index: true },
    closedAt: { type: Date },
    evidence: { type: [String], default: [] },
    comments: { type: String, trim: true },
    history: {
      type: [
        new Schema<IHistoryEntry>(
          {
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: 'User' },
            field: String,
            from: String,
            to: String,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

actionSchema.index({ status: 1, dueDate: 1 });

/** Semáforo de vencimiento, derivado en lectura. */
export function dueState(action: Pick<IAction, 'dueDate' | 'status'>): 'AL_DIA' | 'POR_VENCER' | 'VENCIDA' | 'CERRADA' {
  if (action.status === 'CERRADA') return 'CERRADA';
  if (!action.dueDate) return 'AL_DIA';
  const now = new Date();
  const diffDays = (action.dueDate.getTime() - now.getTime()) / 86_400_000;
  if (diffDays < 0) return 'VENCIDA';
  if (diffDays <= 7) return 'POR_VENCER';
  return 'AL_DIA';
}

export const Action = model<IAction>('Action', actionSchema);
