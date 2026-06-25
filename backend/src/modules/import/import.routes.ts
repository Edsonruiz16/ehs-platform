import { Router } from 'express';
import multer from 'multer';
import * as ctrl from './import.controller';
import { protect, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(protect);

router.post('/preview', authorize('ADMIN', 'CAPTURISTA'), upload.single('file'), asyncHandler(ctrl.preview));
router.post('/commit', authorize('ADMIN', 'CAPTURISTA'), upload.single('file'), asyncHandler(ctrl.commit));
router.get('/history', asyncHandler(ctrl.history));

export default router;
