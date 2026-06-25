import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, Role } from '../constants/enums';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: Role;
  area?: string;
  active: boolean;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'CAPTURISTA', required: true },
    area: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
