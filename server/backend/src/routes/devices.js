import { Router } from 'express';
import { db, now } from '../db.js';
import { requireAdmin, requireCsrf } from '../middleware.js';
import { getSettings } from '../services/settings.js';
import { deviceStatus, lastActiveMap } from '../services/status.js';

export const devicesRouter = Router();
devicesRouter.use(requireAdmin);

function publicDevice(d, settings, lastActive) {
  const status = deviceStatus(d, settings, lastActive.get(d.id));
  return {
    id: d.id,
    deviceName: d.device_name,
    nickname: d.nickname,
    displayName: d.nickname || d.device_name,
    hostname: d.hostname,
    os: d.os,
    agentVersion: d.agent_version,
    archived: !!d.archived,
    canvasX: d.canvas_x,
    canvasY: d.canvas_y,
    createdAt: d.created_at,
    lastSeenAt: d.last_seen_at,
    lastWindow: d.last_window_app
      ? { app: d.last_window_app, title: d.last_window_title } : null,
    status,
  };
}

devicesRouter.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === '1';
  const rows = db.prepare(
    `SELECT * FROM devices ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at DESC`,
  ).all();
  const settings = getSettings();
  const active = lastActiveMap();
  res.json({ devices: rows.map((d) => publicDevice(d, settings, active)) });
});

devicesRouter.get('/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  const settings = getSettings();
  const active = lastActiveMap();

  const since = now() - 24 * 3600;
  const totals = db.prepare(`
    SELECT COALESCE(SUM(keypresses),0) AS keypresses,
           COALESCE(SUM(mouse_active_sec),0) AS mouse_active_sec,
           COALESCE(SUM(mouse_idle_sec),0) AS mouse_idle_sec
    FROM samples WHERE device_id = ? AND ts >= ?`).get(d.id, since);

  res.json({ device: publicDevice(d, settings, active), last24h: totals });
});

devicesRouter.use(requireCsrf);

devicesRouter.patch('/:id', (req, res) => {
  const d = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  const { nickname, deviceName, canvasX, canvasY, archived } = req.body || {};
  const fields = [];
  const vals = [];
  if (nickname !== undefined) { fields.push('nickname = ?'); vals.push(nickname || null); }
  if (deviceName !== undefined) { fields.push('device_name = ?'); vals.push(String(deviceName)); }
  if (canvasX !== undefined) { fields.push('canvas_x = ?'); vals.push(Number(canvasX)); }
  if (canvasY !== undefined) { fields.push('canvas_y = ?'); vals.push(Number(canvasY)); }
  if (archived !== undefined) { fields.push('archived = ?'); vals.push(archived ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'no_fields' });
  vals.push(req.params.id);
  db.prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

devicesRouter.post('/:id/archive', (req, res) => {
  db.prepare('UPDATE devices SET archived = 1 WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'device_archive', req.params.id, now());
  res.json({ ok: true });
});

devicesRouter.post('/:id/unarchive', (req, res) => {
  db.prepare('UPDATE devices SET archived = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Hard delete removes the device and all its samples (cascade).
devicesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'device_delete', req.params.id, now());
  res.json({ ok: true });
});
