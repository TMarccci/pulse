import { getSession, deviceFromToken } from './auth.js';
import { db } from './db.js';

const SESSION_COOKIE = 'pulse_sid';

// Requires a valid admin session cookie. Attaches req.session + req.admin.
export function requireAdmin(req, res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  const session = getSession(sid);
  if (!session) {
    res.status(401).json({ error: 'unauthorized', reason: 'session_expired' });
    return;
  }
  const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(session.admin_id);
  if (!admin) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.session = session;
  req.admin = admin;
  next();
}

// CSRF guard for state-changing admin requests. The SPA sends the token it got
// at login back in the X-CSRF-Token header; it must match the session token.
export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const header = req.get('X-CSRF-Token');
  if (!header || !req.session || header !== req.session.csrf_token) {
    res.status(403).json({ error: 'csrf', reason: 'bad_csrf_token' });
    return;
  }
  next();
}

// Requires a valid device bearer token. Attaches req.device.
export function requireDevice(req, res, next) {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const device = deviceFromToken(token);
  if (!device) {
    res.status(401).json({ error: 'unauthorized', reason: 'bad_device_token' });
    return;
  }
  req.device = device;
  next();
}

export { SESSION_COOKIE };
