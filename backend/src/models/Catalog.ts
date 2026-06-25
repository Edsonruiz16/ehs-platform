import { Schema, model, Document } from 'mongoose';
import { CATALOG_TYPES, CatalogType } from '../constants/enums';

/** Catálogo genérico configurable: tipos de observación, incidente, hallazgo, evento. */
export interface ICatalog extends Document {
  type: CatalogType;
  code: string;
  label: string;
  order: number;
  active: boolean;
}

const catalogSchema = new Schema<ICatalog>(
  {
    type: { type: String, enum: CATALOG_TYPES, required: true },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

catalogSchema.index({ type: 1, code: 1 }, { unique: true });

export const Catalog = model<ICatalog>('Catalog', catalogSchema);
