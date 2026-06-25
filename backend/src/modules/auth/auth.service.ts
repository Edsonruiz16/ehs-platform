import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { User, IUser } from '../../models/User';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../middleware/auth';

function signToken(user: IUser): string {
  const payload: AuthUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    area: user.area,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true }).select('+password');
  if (!user) throw ApiError.unauthorized('Credenciales inválidas');

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Credenciales inválidas');

  return {
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, area: user.area },
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role?: string;
  area?: string;
}) {
  const exists = await User.findOne({ email: input.email.toLowerCase() });
  if (exists) throw ApiError.conflict('El correo ya está registrado');
  const user = await User.create(input);
  return { id: user._id, name: user.name, email: user.email, role: user.role, area: user.area };
}
