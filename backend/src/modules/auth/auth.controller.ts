import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { ROLES } from '../../constants/enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES).optional(),
  area: z.string().optional(),
});

export async function loginCtrl(req: Request, res: Response) {
  const data = await authService.login(req.body.email, req.body.password);
  res.json({ success: true, ...data });
}

export async function registerCtrl(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json({ success: true, user });
}

export async function meCtrl(req: Request, res: Response) {
  res.json({ success: true, user: req.user });
}
