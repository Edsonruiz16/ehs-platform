import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { Role } from '../constants/enums';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  area?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Verifica el JWT y adjunta el usuario a la request. */
export function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Token no proporcionado');
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw ApiError.unauthorized('Token inválido o expirado');
  }
}

/** Restringe el acceso a uno o más roles. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('No tienes permisos para esta acción');
    }
    next();
  };
}
