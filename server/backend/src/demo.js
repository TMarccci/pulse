// Dev-only: populate the database with sample devices + 24h of activity so the
// dashboard/office have something to show. Usage: node src/demo.js
import { db, now } from './db.js';
import { hashPassword, randomToken, sha256 } from './auth.js';
import crypto from 'node:crypto';

const admin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!admin) {
  db.prepare('INSERT INTO admins (username, pass_hash, created_at) VALUES (?,?,?)')
    .run('admin', hashPassword('secret123'), now());
  console.log('Created admin "admin" / "secret123"');
}
db.prepare('INSERT INTO enroll_keys (key, label, created_at) VALUES (?,?,?)')
  .run(randomToken(18), 'demo', now());

const apps = [
  ['chrome.exe', 'Gmail — Inbox'], ['code.exe', 'main.js — pulse'],
  ['excel.exe', 'Q3 Budget.xlsx'], ['slack.exe', '#general'],
  ['outlook.exe', 'Calendar'], ['teams.exe', 'Standup'],
];
const names = [
  ['Reception PC', 'WS-RECEPTION'], ['Design-01', 'WS-DESIGN-01'],
  ['Sales-Anna', 'WS-SALES-02'], ['Dev-Box', 'WS-DEV-07'],
  ['Warehouse', 'WS-WH-01'], ['Meeting Room', 'WS-MEET'],
];

const t = now();
const insDev = db.prepare(`INSERT INTO devices
  (id, token_hash, device_name, nickname, hostname, os, agent_version, canvas_x, canvas_y, created_at, last_seen_at, last_window_app, last_window_title)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insSample = db.prepare(`INSERT INTO samples
  (device_id, ts, keypresses, mouse_clicks, mouse_active_sec, mouse_idle_sec, top_app, top_title)
  VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(device_id,ts) DO NOTHING`);
const insWin = db.prepare('INSERT INTO window_events (device_id, ts, app, title, seconds) VALUES (?,?,?,?,?)');

names.forEach(([nick, host], i) => {
  const id = crypto.randomUUID();
  // Vary last-seen so the office shows offline/idle/working colours.
  const lastSeenOffsets = [0, 30, 130, 350, 1000, 5000];
  const lastSeen = t - lastSeenOffsets[i];
  const [app, title] = apps[i % apps.length];
  insDev.run(id, sha256(randomToken()), host, nick, host, 'Windows 11', '0.1.0',
    60 + (i % 3) * 160, 60 + Math.floor(i / 3) * 150, t - 86400 * 3, lastSeen, app, title);

  for (let m = 0; m < 24 * 60; m++) {
    const ts = Math.floor((t - m * 60) / 60) * 60;
    const workingHour = new Date(ts * 1000).getHours();
    const busy = workingHour >= 8 && workingHour <= 18 ? 1 : 0.15;
    const active = Math.random() < 0.75 * busy;
    const keys = active ? Math.floor(Math.random() * 180 * busy) : 0;
    const clicks = active ? Math.floor(Math.random() * 40 * busy) : 0;
    const activeSec = active ? 40 + Math.floor(Math.random() * 20) : 0;
    const [a, ti] = apps[Math.floor(Math.random() * apps.length)];
    insSample.run(id, ts, keys, clicks, activeSec, 60 - activeSec, a, ti);
    if (active) insWin.run(id, ts, a, ti, activeSec);
  }
});

console.log(`Seeded ${names.length} demo devices with 24h of activity.`);
