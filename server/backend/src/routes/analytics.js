import { Router } from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware.js';
import { getSettings } from '../services/settings.js';
import { workHoursClause } from '../services/workhours.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAdmin);

// Pick a timeseries bucket size from the window span.
function bucketForSpan(span) {
  if (span <= 3 * 3600) return 300;        // ≤3h  → 5-min
  if (span <= 26 * 3600) return 3600;      // ≤~1d → hourly
  if (span <= 60 * 86400) return 86400;    // ≤60d → daily
  return 7 * 86400;                        // else → weekly
}

// Resolve the query window from either explicit from/to (unix seconds) or a
// named range preset. Returns { since, until, bucket, key }.
function resolveWindow(query) {
  const t = now();
  const from = parseInt(query.from, 10);
  const to = parseInt(query.to, 10);
  if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
    return { since: from, until: to, bucket: bucketForSpan(to - from), key: `${from}-${to}` };
  }
  switch (query.range) {
    case '1h':  return { since: t - 3600, until: t, bucket: 300, key: '1h' };
    case '7d':  return { since: t - 7 * 86400, until: t, bucket: 3600, key: '7d' };
    case '30d': return { since: t - 30 * 86400, until: t, bucket: 86400, key: '30d' };
    case '24h':
    default:    return { since: t - 86400, until: t, bucket: 3600, key: '24h' };
  }
}

function overviewFor(deviceId, r, wh) {
  const dev = deviceId ? 'AND device_id = ?' : '';
  const args = deviceId ? [r.since, r.until, deviceId] : [r.since, r.until];
  const whc = wh.clause;

  const totals = db.prepare(`
    SELECT COALESCE(SUM(keypresses),0) AS keypresses,
           COALESCE(SUM(mouse_clicks),0) AS mouseClicks,
           COALESCE(SUM(mouse_active_sec),0) AS mouseActiveSec,
           COALESCE(SUM(mouse_idle_sec),0) AS mouseIdleSec
    FROM samples WHERE ts >= ? AND ts < ? ${dev}${whc}`).get(...args);

  const series = db.prepare(`
    SELECT (ts / ${r.bucket}) * ${r.bucket} AS bucket,
           SUM(keypresses) AS keypresses,
           SUM(mouse_clicks) AS mouseClicks,
           SUM(mouse_active_sec) AS mouseActiveSec,
           SUM(mouse_idle_sec) AS mouseIdleSec
    FROM samples WHERE ts >= ? AND ts < ? ${dev}${whc}
    GROUP BY bucket ORDER BY bucket ASC`).all(...args);

  const topApps = db.prepare(`
    SELECT app, SUM(seconds) AS seconds
    FROM window_events WHERE ts >= ? AND ts < ? ${dev}${whc} AND app IS NOT NULL
    GROUP BY app ORDER BY seconds DESC LIMIT 15`).all(...args);

  return { totals, series, topApps };
}

// Whole-workplace analytics.
analyticsRouter.get('/overview', (req, res) => {
  const r = resolveWindow(req.query);
  const settings = getSettings();
  const wh = workHoursClause(settings, req.query.workHours === '1', 'ts');
  const t = now();
  const deviceCounts = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN archived = 0 AND last_seen_at >= ? THEN 1 ELSE 0 END) AS online
    FROM devices`).get(t - config.onlineWindowSeconds);

  res.json({
    range: r.key, bucket: r.bucket, since: r.since, until: r.until,
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
  const r = resolveWindow(req.query);
  const settings = getSettings();
  const wh = workHoursClause(settings, req.query.workHours === '1', 'ts');
  res.json({
    range: r.key, bucket: r.bucket, since: r.since, until: r.until,
    device: { id: d.id, displayName: d.nickname || d.device_name },
    workHours: settings.workHours,
    workHoursApplied: wh.applied,
    ...overviewFor(d.id, r, wh),
  });
});

// Timeline of window titles for ONE application (dominant + all titles per bucket).
analyticsRouter.get('/device/:id/app-titles', (req, res) => {
  const app = String(req.query.app || '');
  if (!app) return res.status(400).json({ error: 'app_required' });
  const r = resolveWindow(req.query);
  const wh = workHoursClause(getSettings(), req.query.workHours === '1', 'ts');

  const rows = db.prepare(`
    SELECT (ts / ${r.bucket}) * ${r.bucket} AS bucket, title, SUM(seconds) AS seconds
    FROM window_events
    WHERE device_id = ? AND app = ? AND ts >= ? AND ts < ? ${wh.clause} AND title IS NOT NULL
    GROUP BY bucket, title ORDER BY bucket ASC`).all(req.params.id, app, r.since, r.until);

  const totals = new Map();
  for (const row of rows) totals.set(row.title, (totals.get(row.title) || 0) + row.seconds);
  const titles = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([title, seconds]) => ({ title, seconds }));
  const keep = new Set(titles.map((t) => t.title));

  res.json({ app, bucket: r.bucket, since: r.since, until: r.until,
    titles, points: rows.filter((row) => keep.has(row.title)) });
});

// Timeline of every foreground app (dominant title per app per bucket).
analyticsRouter.get('/device/:id/windows-timeline', (req, res) => {
  const r = resolveWindow(req.query);
  const wh = workHoursClause(getSettings(), req.query.workHours === '1', 'ts');

  const points = db.prepare(`
    WITH agg AS (
      SELECT (ts / ${r.bucket}) * ${r.bucket} AS bucket, app, title, SUM(seconds) AS seconds
      FROM window_events
      WHERE device_id = ? AND ts >= ? AND ts < ? ${wh.clause} AND app IS NOT NULL
      GROUP BY bucket, app, title
    )
    SELECT bucket, app, title, seconds FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY bucket, app ORDER BY seconds DESC) AS rn FROM agg
    ) WHERE rn = 1 ORDER BY bucket ASC`).all(req.params.id, r.since, r.until);

  const totals = new Map();
  for (const p of points) totals.set(p.app, (totals.get(p.app) || 0) + p.seconds);
  const apps = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([app]) => app);
  const keep = new Set(apps);

  res.json({ bucket: r.bucket, since: r.since, until: r.until,
    apps, points: points.filter((p) => keep.has(p.app)) });
});
