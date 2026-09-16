import { Router } from 'express';
import { requireAdmin, requireCsrf } from '../middleware.js';
import { getUpdateStatus, checkForUpdate, applyUpdate } from '../services/updater.js';

export const updatesRouter = Router();
updatesRouter.use(requireAdmin);

updatesRouter.get('/', (req, res) => res.json(getUpdateStatus()));

updatesRouter.post('/check', requireCsrf, async (req, res) => {
  res.json(await checkForUpdate());
});

updatesRouter.post('/apply', requireCsrf, async (req, res) => {
  try {
    await applyUpdate();
    res.json({ ok: true, restarting: true });
  } catch (e) {
    res.status(400).json({ error: 'update_failed', message: e.message });
  }
});
