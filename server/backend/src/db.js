import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// better-sqlite3-style transaction wrapper on top of node:sqlite.
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

// ---- Schema (idempotent) --------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  pass_hash     TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,          -- session id (cookie value)
  admin_id      INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enroll_keys (
  id            INTEGER PRIMARY KEY,
  key           TEXT UNIQUE NOT NULL,
  label         TEXT,
  created_at    INTEGER NOT NULL,
  revoked       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,          -- uuid
  token_hash    TEXT NOT NULL,            -- sha256 of device token
  device_name   TEXT NOT NULL,
  nickname      TEXT,
  hostname      TEXT,
  os            TEXT,
  agent_version TEXT,
  canvas_x      REAL,
  canvas_y      REAL,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER,
  last_window_app   TEXT,
  last_window_title TEXT
);

-- Per-minute aggregated activity buckets.
CREATE TABLE IF NOT EXISTS samples (
  id               INTEGER PRIMARY KEY,
  device_id        TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts               INTEGER NOT NULL,       -- bucket start (unix seconds, minute-aligned)
  keypresses       INTEGER NOT NULL DEFAULT 0,
  mouse_active_sec INTEGER NOT NULL DEFAULT 0,
  mouse_idle_sec   INTEGER NOT NULL DEFAULT 0,
  top_app          TEXT,
  top_title        TEXT,
  UNIQUE(device_id, ts)
);
CREATE INDEX IF NOT EXISTS idx_samples_device_ts ON samples(device_id, ts);

-- Foreground window usage aggregated per bucket + app/title.
CREATE TABLE IF NOT EXISTS window_events (
  id           INTEGER PRIMARY KEY,
  device_id    TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts           INTEGER NOT NULL,           -- bucket start (minute-aligned)
  app          TEXT,
  title        TEXT,
  seconds      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_winev_device_ts ON window_events(device_id, ts);

CREATE TABLE IF NOT EXISTS settings (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  json    TEXT NOT NULL,
  rev     INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  admin_id   INTEGER,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
`);

// ---- Default monitoring settings ------------------------------------------
export const DEFAULT_SETTINGS = {
  // A second of mouse/keyboard inactivity beyond this counts as "idle".
  idleThresholdSeconds: 30,

  // Work hours used to focus analytics/exports. Evaluated in the SERVER's local
  // timezone (set TZ to match the workplace). days: 0=Sun … 6=Sat.
  workHours: {
    enabled: false,
    start: '09:00',
    end: '17:00',
    days: [1, 2, 3, 4, 5],
  },

  // Sync behaviour pushed to agents.
  sync: {
    mode: 'live',              // 'live' | 'timed'
    livePollSeconds: 60,       // live: flush + heartbeat cadence
    timedAt: '18:00',          // timed: wall-clock HH:mm local to the agent
  },

  // Office canvas colour rules, evaluated top-to-bottom; first match wins.
  // "offline" is implicit (grey) when last_seen exceeds onlineWindow.
  // idleForMinutes = minutes the device has been continuously idle.
  colorRules: [
    { color: '#ef4444', label: 'Idle 15m+', idleForMinutes: 15 },
    { color: '#f97316', label: 'Idle 5m+',  idleForMinutes: 5  },
    { color: '#eab308', label: 'Idle 2m+',  idleForMinutes: 2  },
    { color: '#3b82f6', label: 'Working',   idleForMinutes: 0  },
  ],
  offlineColor: '#9ca3af',

  // Force agents at/below this version to update.
  minAgentVersion: '0.0.0',
};

const row = db.prepare('SELECT json FROM settings WHERE id = 1').get();
if (!row) {
  db.prepare('INSERT INTO settings (id, json, rev, updated_at) VALUES (1, ?, 1, ?)')
    .run(JSON.stringify(DEFAULT_SETTINGS), Math.floor(Date.now() / 1000));
}

export function now() {
  return Math.floor(Date.now() / 1000);
}
