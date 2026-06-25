import { Schema, model, Document } from 'mongoose';

export interface IArea extends Document {
  code: string;
  name: string;
  plant?: string;
  active: boolean;
}

const areaSchema = new Schema<IArea>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    plant: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Area = model<IArea>('Area', areaSchema);
