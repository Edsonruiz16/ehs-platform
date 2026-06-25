import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import stopRoutes from '../modules/observationsStop/stop.routes';
import commissionRoutes from '../modules/commission/commission.routes';
import incidentRoutes from '../modules/incidents/incident.routes';
import ipercRoutes from '../modules/iperc/iperc.routes';
import actionRoutes from '../modules/actions/action.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import catalogRoutes from '../modules/catalogs/catalogs.routes';
import importRoutes from '../modules/import/import.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', ts: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/observations-stop', stopRoutes);
router.use('/commission', commissionRoutes);
router.use('/incidents', incidentRoutes);
router.use('/iperc', ipercRoutes);
router.use('/actions', actionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/import', importRoutes);
router.use('/', catalogRoutes); // /areas, /machines, /catalogs, /users

export default router;
