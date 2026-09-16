import { Router } from 'express';
import crypto from 'node:crypto';
import { db, now } from '../db.js';
import { config } from '../config.js';
import { randomToken, sha256 } from '../auth.js';
import { requireDevice } from '../middleware.js';
import { getSettings } from '../services/settings.js';

export const agentRouter = Router();

// Settings payload the agent actually needs (idle threshold + sync mode + rev).
function agentSettings() {
  const s = getSettings();
  return {
    rev: s.rev,
    idleThresholdSeconds: s.idleThresholdSeconds,
    sync: s.sync,
    minAgentVersion: s.minAgentVersion,
  };
}

agentRouter.post('/enroll', (req, res) => {
  const { enrollKey, deviceName, hostname, os, agentVersion } = req.body || {};
  if (!enrollKey || !deviceName) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  const key = db.prepare('SELECT * FROM enroll_keys WHERE key = ? AND revoked = 0').get(String(enrollKey));
  if (!key) return res.status(403).json({ error: 'invalid_enroll_key' });

  const id = crypto.randomUUID();
  const token = randomToken(32);
  db.prepare(`INSERT INTO devices
      (id, token_hash, device_name, hostname, os, agent_version, created_at, last_seen_at)
      VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, sha256(token), String(deviceName), hostname || null, os || null,
         agentVersion || null, now(), now());

  db.prepare('INSERT INTO audit_log (action, detail, created_at) VALUES (?,?,?)')
    .run('device_enroll', `${deviceName} (${hostname || '?'})`, now());

  res.json({ deviceId: id, deviceToken: token, settings: agentSettings() });
});

agentRouter.post('/sync', requireDevice, (req, res) => {
  const { agentVersion, buckets } = req.body || {};
  const device = req.device;

  const upsertSample = db.prepare(`
    INSERT INTO samples (device_id, ts, keypresses, mouse_active_sec, mouse_idle_sec, top_app, top_title)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id, ts) DO UPDATE SET
      keypresses       = excluded.keypresses,
      mouse_active_sec = excluded.mouse_active_sec,
      mouse_idle_sec   = excluded.mouse_idle_sec,
      top_app          = excluded.top_app,
      top_title        = excluded.top_title
  `);
  const delWin = db.prepare('DELETE FROM window_events WHERE device_id = ? AND ts = ?');
  const insWin = db.prepare(`INSERT INTO window_events (device_id, ts, app, title, seconds)
                             VALUES (?,?,?,?,?)`);

  let lastApp = device.last_window_app;
  let lastTitle = device.last_window_title;

  const apply = db.transaction((list) => {
    for (const b of list) {
      const ts = Math.floor(Number(b.ts) / 60) * 60; // minute-align defensively
      if (!Number.isFinite(ts)) continue;
      const windows = Array.isArray(b.windows) ? b.windows : [];
      let top = null;
      for (const w of windows) if (!top || (w.seconds || 0) > (top.seconds || 0)) top = w;

      upsertSample.run(
        device.id,
        ts,
        Math.max(0, Math.trunc(b.keypresses || 0)),
        Math.max(0, Math.trunc(b.mouseActiveSec || 0)),
        Math.max(0, Math.trunc(b.mouseIdleSec || 0)),
        top?.app || null,
        top?.title || null,
      );

      delWin.run(device.id, ts);
      for (const w of windows) {
        insWin.run(device.id, ts, w.app || null, w.title || null,
                   Math.max(0, Math.trunc(w.seconds || 0)));
      }
      if (top) { lastApp = top.app || lastApp; lastTitle = top.title || lastTitle; }
    }
  });

  if (Array.isArray(buckets) && buckets.length) apply(buckets);

  db.prepare(`UPDATE devices SET last_seen_at = ?, agent_version = ?,
              last_window_app = ?, last_window_title = ? WHERE id = ?`)
    .run(now(), agentVersion || device.agent_version, lastApp, lastTitle, device.id);

  res.json({ ok: true, settings: agentSettings(), serverTime: now() });
});

// Advertises the update source + a mandatory-version floor. The agent queries
// GitHub Releases directly; this tells it where and whether it must update.
agentRouter.get('/update-check', (req, res) => {
  const s = getSettings();
  const version = String(req.query.version || '0.0.0');
  res.json({
    repo: config.agentUpdateRepo || null,
    minVersion: s.minAgentVersion || '0.0.0',
    mandatory: cmpVersion(version, s.minAgentVersion || '0.0.0') < 0,
  });
});

function cmpVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}
