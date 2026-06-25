import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

/** Valida req.body contra un esquema Zod; reemplaza body por la versión parseada. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest('Datos inválidos', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}
