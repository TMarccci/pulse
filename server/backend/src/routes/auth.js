import { Router } from 'express';
import { db, now } from '../db.js';
import { config } from '../config.js';
import {
  verifyPassword, createSession, destroySession, getSession,
} from '../auth.js';
import { requireAdmin, SESSION_COOKIE } from '../middleware.js';

export const authRouter = Router();

function cookieOpts(expiresAt) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: new Date(expiresAt * 1000),
  };
}

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(username));
  if (!admin || !verifyPassword(String(password), admin.pass_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const session = createSession(admin.id);
  res.cookie(SESSION_COOKIE, session.id, cookieOpts(session.expiresAt));
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(admin.id, 'login', null, now());
  res.json({
    user: { id: admin.id, username: admin.username },
    csrfToken: session.csrf,
    expiresAt: session.expiresAt,
    ttlSeconds: config.sessionTtlMinutes * 60,
  });
});

authRouter.post('/logout', requireAdmin, (req, res) => {
  destroySession(req.session.id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Returns current session state; the SPA polls this to detect token expiry.
authRouter.get('/me', (req, res) => {
  const session = getSession(req.cookies?.[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'unauthorized', reason: 'session_expired' });
  const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(session.admin_id);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  res.json({
    user: { id: admin.id, username: admin.username },
    csrfToken: session.csrf_token,
    expiresAt: session.expires_at,
  });
});
