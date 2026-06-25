import { Router } from 'express';
import * as ctrl from './action.controller';
import { validateBody } from '../../middleware/validate';
import { protect, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
router.use(protect);

router.get('/', asyncHandler(ctrl.list));
router.get('/summary', asyncHandler(ctrl.summary));
router.get('/:id', asyncHandler(ctrl.getOne));
router.patch(
  '/:id/status',
  authorize('ADMIN', 'CAPTURISTA'),
  validateBody(ctrl.statusSchema),
  asyncHandler(ctrl.updateStatus)
);

export default router;
