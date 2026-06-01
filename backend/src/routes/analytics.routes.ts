// analytics.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getDashboardStats, getAnalytics } from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate);
router.get('/dashboard', getDashboardStats);
router.get('/', getAnalytics);

export default router;
