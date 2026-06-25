import { Schema, model, Document, Types } from 'mongoose';
import { SOURCES, Source } from '../constants/enums';

interface IRejected {
  row: number;
  folio?: string;
  reason: string;
}

/** Log de cada importación masiva de Excel. */
export interface IImportJob extends Document {
  fileName: string;
  target: 'HEINRICH' | 'STOP' | 'COMMISSION' | 'INCIDENT' | 'IPERC';
  source: Source;
  total: number;
  inserted: number;
  rejectedCount: number;
  rejected: IRejected[];
  mapping?: Record<string, string>;
  createdBy?: Types.ObjectId;
}

const schema = new Schema<IImportJob>(
  {
    fileName: { type: String, required: true },
    target: { type: String, enum: ['HEINRICH', 'STOP', 'COMMISSION', 'INCIDENT', 'IPERC'], required: true },
    source: { type: String, enum: SOURCES, required: true },
    total: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    rejected: {
      type: [new Schema<IRejected>({ row: Number, folio: String, reason: String }, { _id: false })],
      default: [],
    },
    mapping: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ImportJob = model<IImportJob>('ImportJob', schema);
