import { Router } from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { requireAdmin, requireCsrf } from '../middleware.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { randomToken } from '../auth.js';

export const settingsRouter = Router();
settingsRouter.use(requireAdmin);

settingsRouter.get('/', (req, res) => {
  res.json({
    settings: getSettings(),
    meta: {
      onlineWindowSeconds: config.onlineWindowSeconds,
      agentUpdateRepo: config.agentUpdateRepo || null,
    },
  });
});

settingsRouter.put('/', requireCsrf, (req, res) => {
  const patch = req.body || {};
  delete patch.rev;
  const next = updateSettings(patch);
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'settings_update', null, now());
  res.json({ settings: next });
});

// ---- Enrollment keys -------------------------------------------------------
settingsRouter.get('/keys', (req, res) => {
  const keys = db.prepare('SELECT id, key, label, created_at, revoked FROM enroll_keys ORDER BY created_at DESC').all();
  res.json({ keys });
});

settingsRouter.post('/keys', requireCsrf, (req, res) => {
  const key = randomToken(18);
  const label = (req.body?.label || '').toString().slice(0, 120) || null;
  const info = db.prepare('INSERT INTO enroll_keys (key, label, created_at) VALUES (?,?,?)')
    .run(key, label, now());
  res.json({ key: { id: Number(info.lastInsertRowid), key, label, created_at: now(), revoked: 0 } });
});

settingsRouter.post('/keys/:id/revoke', requireCsrf, (req, res) => {
  db.prepare('UPDATE enroll_keys SET revoked = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
