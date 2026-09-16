import { db, DEFAULT_SETTINGS, now } from '../db.js';

// Deep-merge stored settings over defaults so new keys appear automatically.
function merge(base, override) {
  if (Array.isArray(override)) return override;
  if (override && typeof override === 'object' && base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(override)) out[k] = merge(base[k], override[k]);
    return out;
  }
  return override === undefined ? base : override;
}

export function getSettings() {
  const row = db.prepare('SELECT json, rev FROM settings WHERE id = 1').get();
  const stored = row ? JSON.parse(row.json) : {};
  return { ...merge(DEFAULT_SETTINGS, stored), rev: row ? row.rev : 1 };
}

export function updateSettings(patch) {
  const current = getSettings();
  delete current.rev;
  const next = merge(current, patch);
  const rev = (db.prepare('SELECT rev FROM settings WHERE id = 1').get()?.rev || 1) + 1;
  db.prepare('UPDATE settings SET json = ?, rev = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify(next), rev, now());
  return { ...next, rev };
}
