import { Router } from 'express';
import { loginCtrl, registerCtrl, meCtrl, loginSchema, registerSchema } from './auth.controller';
import { validateBody } from '../../middleware/validate';
import { protect, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.post('/login', validateBody(loginSchema), asyncHandler(loginCtrl));
router.post('/register', protect, authorize('ADMIN'), validateBody(registerSchema), asyncHandler(registerCtrl));
router.get('/me', protect, asyncHandler(meCtrl));

export default router;
