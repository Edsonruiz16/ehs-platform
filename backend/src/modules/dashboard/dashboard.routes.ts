import { Router } from 'express';
import { overview, pyramid } from './dashboard.controller';
import { protect } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
router.use(protect);

router.get('/overview', asyncHandler(overview));
router.get('/pyramid', asyncHandler(pyramid));

export default router;
