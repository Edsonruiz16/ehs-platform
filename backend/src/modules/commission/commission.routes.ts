import { Router } from 'express';
import * as ctrl from './commission.controller';
import { validateBody } from '../../middleware/validate';
import { protect, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
router.use(protect);

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', authorize('ADMIN', 'CAPTURISTA'), validateBody(ctrl.commissionSchema), asyncHandler(ctrl.create));
router.put('/:id', authorize('ADMIN', 'CAPTURISTA'), validateBody(ctrl.commissionSchema.partial()), asyncHandler(ctrl.update));
router.delete('/:id', authorize('ADMIN'), asyncHandler(ctrl.remove));

export default router;
