import { Router } from 'express';
import { monthByMonth, subscriptions, yearInReview } from '../reports.js';

const router = Router();
router.get('/reports/months', (req, res) => res.json(monthByMonth(Math.min(24, Math.max(3, Number(req.query.months) || 12)))));
router.get('/reports/subscriptions', (_req, res) => res.json(subscriptions()));
router.get('/reports/year', (req, res) => res.json(yearInReview(Number(req.query.year) || new Date().getFullYear())));
export default router;
