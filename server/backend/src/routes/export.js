import { Router } from 'express';
import * as XLSX from 'xlsx';
import { db, now } from '../db.js';
import { requireAdmin } from '../middleware.js';

export const exportRouter = Router();
exportRouter.use(requireAdmin);

function rangeSince(str) {
  const t = now();
  switch (str) {
    case '1h':  return t - 3600;
    case '7d':  return t - 7 * 86400;
    case '30d': return t - 30 * 86400;
    case 'all': return 0;
    case '24h':
    default:    return t - 86400;
  }
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function send(res, rows, format, name) {
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${name}.json"`);
    return res.json(rows);
  }
  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pulse');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    return res.send(buf);
  }
  // default CSV
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  return res.send(toCsv(rows));
}

// /api/export/samples?format=csv|json|xlsx&deviceId=&range=24h|7d|30d|all
exportRouter.get('/samples', (req, res) => {
  const format = String(req.query.format || 'csv');
  const since = rangeSince(req.query.range);
  const deviceId = req.query.deviceId;
  const where = deviceId ? 'AND s.device_id = ?' : '';
  const args = deviceId ? [since, deviceId] : [since];
  const rows = db.prepare(`
    SELECT d.device_name AS device, COALESCE(d.nickname,'') AS nickname,
           datetime(s.ts,'unixepoch') AS time_utc, s.ts AS unix,
           s.keypresses, s.mouse_active_sec, s.mouse_idle_sec,
           COALESCE(s.top_app,'') AS top_app, COALESCE(s.top_title,'') AS top_title
    FROM samples s JOIN devices d ON d.id = s.device_id
    WHERE s.ts >= ? ${where}
    ORDER BY s.ts ASC`).all(...args);
  send(res, rows, format, `pulse-samples-${req.query.range || '24h'}`);
});

// /api/export/windows?...
exportRouter.get('/windows', (req, res) => {
  const format = String(req.query.format || 'csv');
  const since = rangeSince(req.query.range);
  const deviceId = req.query.deviceId;
  const where = deviceId ? 'AND w.device_id = ?' : '';
  const args = deviceId ? [since, deviceId] : [since];
  const rows = db.prepare(`
    SELECT d.device_name AS device, COALESCE(d.nickname,'') AS nickname,
           datetime(w.ts,'unixepoch') AS time_utc,
           COALESCE(w.app,'') AS app, COALESCE(w.title,'') AS title, w.seconds
    FROM window_events w JOIN devices d ON d.id = w.device_id
    WHERE w.ts >= ? ${where}
    ORDER BY w.ts ASC`).all(...args);
  send(res, rows, format, `pulse-windows-${req.query.range || '24h'}`);
});

// /api/export/devices?format=
exportRouter.get('/devices', (req, res) => {
  const format = String(req.query.format || 'csv');
  const rows = db.prepare(`
    SELECT device_name AS device, COALESCE(nickname,'') AS nickname,
           COALESCE(hostname,'') AS hostname, COALESCE(os,'') AS os,
           COALESCE(agent_version,'') AS agent_version,
           archived, datetime(created_at,'unixepoch') AS enrolled_utc,
           CASE WHEN last_seen_at IS NULL THEN '' ELSE datetime(last_seen_at,'unixepoch') END AS last_seen_utc
    FROM devices ORDER BY created_at DESC`).all();
  send(res, rows, format, 'pulse-devices');
});
