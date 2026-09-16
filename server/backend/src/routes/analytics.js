import { Router } from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware.js';
import { getSettings } from '../services/settings.js';
import { workHoursClause } from '../services/workhours.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAdmin);

// Map a range string to a window + timeseries bucket size.
function range(str) {
  const t = now();
  switch (str) {
    case '1h':  return { since: t - 3600, bucket: 300 };        // 5-min buckets
    case '7d':  return { since: t - 7 * 86400, bucket: 3600 };  // hourly
    case '30d': return { since: t - 30 * 86400, bucket: 86400 };// daily
    case '24h':
    default:    return { since: t - 86400, bucket: 3600 };      // hourly
  }
}

function overviewFor(deviceId, r, wh) {
  const where = deviceId ? 'AND device_id = ?' : '';
  const args = deviceId ? [r.since, deviceId] : [r.since];
  const whc = wh.clause; // work-hours filter (numeric, no params)

  const totals = db.prepare(`
    SELECT COALESCE(SUM(keypresses),0) AS keypresses,
           COALESCE(SUM(mouse_active_sec),0) AS mouseActiveSec,
           COALESCE(SUM(mouse_idle_sec),0) AS mouseIdleSec
    FROM samples WHERE ts >= ? ${where}${whc}`).get(...args);

  const series = db.prepare(`
    SELECT (ts / ${r.bucket}) * ${r.bucket} AS bucket,
           SUM(keypresses) AS keypresses,
           SUM(mouse_active_sec) AS mouseActiveSec,
           SUM(mouse_idle_sec) AS mouseIdleSec
    FROM samples WHERE ts >= ? ${where}${whc}
    GROUP BY bucket ORDER BY bucket ASC`).all(...args);

  const topApps = db.prepare(`
    SELECT app, SUM(seconds) AS seconds
    FROM window_events WHERE ts >= ? ${where}${whc} AND app IS NOT NULL
    GROUP BY app ORDER BY seconds DESC LIMIT 15`).all(...args);

  return { totals, series, topApps };
}

// Whole-workplace analytics.
analyticsRouter.get('/overview', (req, res) => {
  const r = range(req.query.range);
  const settings = getSettings();
  const wh = workHoursClause(settings, req.query.workHours === '1', 'ts');
  const t = now();
  const deviceCounts = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN archived = 0 AND last_seen_at >= ? THEN 1 ELSE 0 END) AS online
    FROM devices`).get(t - config.onlineWindowSeconds);

  res.json({
    range: req.query.range || '24h',
    devices: deviceCounts,
    workHours: settings.workHours,
    workHoursApplied: wh.applied,
    ...overviewFor(null, r, wh),
  });
});

// Per-device analytics.
analyticsRouter.get('/device/:id', (req, res) => {
  const d = db.prepare('SELECT id, device_name, nickname FROM devices WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  const r = range(req.query.range);
  const settings = getSettings();
  const wh = workHoursClause(settings, req.query.workHours === '1', 'ts');
  res.json({
    range: req.query.range || '24h',
    device: { id: d.id, displayName: d.nickname || d.device_name },
    workHours: settings.workHours,
    workHoursApplied: wh.applied,
    ...overviewFor(d.id, r, wh),
  });
});
