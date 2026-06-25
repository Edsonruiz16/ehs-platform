import { Router } from 'express';
import { crudFactory } from './crud.factory';
import { Area } from '../../models/Area';
import { Machine } from '../../models/Machine';
import { Catalog } from '../../models/Catalog';
import { User } from '../../models/User';
import { protect, authorize } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
router.use(protect);

function mount(path: string, handlers: ReturnType<typeof crudFactory>) {
  router.get(path, asyncHandler(handlers.list));
  router.post(path, authorize('ADMIN'), asyncHandler(handlers.create));
  router.put(`${path}/:id`, authorize('ADMIN'), asyncHandler(handlers.update));
  router.delete(`${path}/:id`, authorize('ADMIN'), asyncHandler(handlers.remove));
}

mount('/areas', crudFactory(Area, { searchFields: ['code', 'name'], sort: { name: 1 } }));
mount('/machines', crudFactory(Machine, { searchFields: ['code', 'name'], sort: { name: 1 } }));
mount('/catalogs', crudFactory(Catalog, { searchFields: ['code', 'label'], sort: { type: 1, order: 1 } }));

// Usuarios: listado sin password.
const users = crudFactory(User, { searchFields: ['name', 'email'], sort: { name: 1 } });
router.get('/users', authorize('ADMIN'), asyncHandler(users.list));
router.put('/users/:id', authorize('ADMIN'), asyncHandler(users.update));
router.delete('/users/:id', authorize('ADMIN'), asyncHandler(users.remove));

export default router;
