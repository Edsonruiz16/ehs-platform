import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err && typeof err === 'object' && 'name' in err) {
    const e = err as { name: string; message: string; code?: number; errors?: unknown };
    if (e.name === 'ValidationError') {
      statusCode = 400;
      message = 'Error de validación';
      details = e.errors;
    } else if (e.name === 'CastError') {
      statusCode = 400;
      message = 'Identificador inválido';
    } else if (e.code === 11000) {
      statusCode = 409;
      message = 'Registro duplicado (clave única)';
    } else {
      message = e.message || message;
    }
  }

  if (statusCode === 500 && env.nodeEnv !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({ success: false, message, details });
}
