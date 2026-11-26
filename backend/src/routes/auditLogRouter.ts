import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLogController.ts';
import { authenticate } from '../middlewares/auth.ts';
import { authorize } from '../middlewares/authorize.ts';

const auditLogRouter = Router();
const auditLogController = new AuditLogController();

// Seluruh endpoint audit log hanya dapat diakses oleh role admin.
// Append-only: tidak ada endpoint POST/PUT/PATCH/DELETE dari aplikasi.
auditLogRouter.use(authenticate, authorize('admin'));

auditLogRouter.get('/', auditLogController.getAll);
auditLogRouter.get('/:id', auditLogController.getById);

export { auditLogRouter };
