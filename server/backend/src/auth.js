import crypto from 'node:crypto';
import { db, now } from './db.js';
import { config } from './config.js';

// ---- Password hashing (scrypt, no native deps) ----------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ---- Admin sessions --------------------------------------------------------
export function createSession(adminId) {
  const id = randomToken(32);
  const csrf = randomToken(24);
  const created = now();
  const expires = created + config.sessionTtlMinutes * 60;
  db.prepare(`INSERT INTO sessions (id, admin_id, csrf_token, created_at, expires_at)
              VALUES (?, ?, ?, ?, ?)`).run(id, adminId, csrf, created, expires);
  return { id, csrf, expiresAt: expires };
}

export function getSession(id) {
  if (!id) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!s) return null;
  if (s.expires_at <= now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }
  return s;
}

export function destroySession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
}

// ---- Device tokens ---------------------------------------------------------
export function deviceFromToken(token) {
  if (!token) return null;
  const hash = sha256(token);
  return db.prepare('SELECT * FROM devices WHERE token_hash = ? AND archived = 0').get(hash) || null;
}
