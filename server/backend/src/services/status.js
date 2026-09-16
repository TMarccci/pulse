import { db, now } from '../db.js';
import { config } from '../config.js';

// Last minute-bucket in which the device showed any activity.
export function lastActiveMap() {
  const rows = db.prepare(`
    SELECT device_id, MAX(ts) AS last_active
    FROM samples
    WHERE keypresses > 0 OR mouse_active_sec > 0
    GROUP BY device_id
  `).all();
  const map = new Map();
  for (const r of rows) map.set(r.device_id, r.last_active);
  return map;
}

/**
 * Derive online/idle state + office-canvas colour for one device.
 * @param device       row from `devices`
 * @param settings     merged settings object
 * @param lastActiveTs unix seconds of last activity, or undefined
 */
export function deviceStatus(device, settings, lastActiveTs) {
  const t = now();
  const online = device.last_seen_at != null &&
    (t - device.last_seen_at) <= config.onlineWindowSeconds;

  if (!online) {
    return {
      online: false,
      state: 'offline',
      idleMinutes: null,
      color: settings.offlineColor || '#9ca3af',
      label: 'Offline',
    };
  }

  // Minutes since the device was last active. If it has been seen but never
  // active, measure idleness from last_seen's baseline (created recently → 0).
  const base = lastActiveTs ?? device.created_at;
  const idleMinutes = Math.max(0, Math.floor((t - base) / 60));

  const rules = [...(settings.colorRules || [])].sort(
    (a, b) => (b.idleForMinutes || 0) - (a.idleForMinutes || 0),
  );
  let match = rules[rules.length - 1] || { color: '#3b82f6', label: 'Working' };
  for (const rule of rules) {
    if (idleMinutes >= (rule.idleForMinutes || 0)) { match = rule; break; }
  }

  return {
    online: true,
    state: idleMinutes > 0 ? 'idle' : 'active',
    idleMinutes,
    color: match.color,
    label: match.label,
  };
}
