import { Schema, model, Document } from 'mongoose';

export interface IMachine extends Document {
  code: string;
  name: string;
  area?: string;
  active: boolean;
}

const machineSchema = new Schema<IMachine>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

machineSchema.index({ area: 1 });

export const Machine = model<IMachine>('Machine', machineSchema);
