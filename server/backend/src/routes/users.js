import { Router } from 'express';
import { db, now } from '../db.js';
import { hashPassword } from '../auth.js';
import { requireAdmin, requireCsrf } from '../middleware.js';

export const usersRouter = Router();
usersRouter.use(requireAdmin);

usersRouter.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, created_at FROM admins ORDER BY created_at ASC').all();
  res.json({ users, me: req.admin.id });
});

usersRouter.post('/', requireCsrf, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 6 characters.' });
  const exists = db.prepare('SELECT 1 FROM admins WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'username_taken' });

  const info = db.prepare('INSERT INTO admins (username, pass_hash, created_at) VALUES (?,?,?)')
    .run(username, hashPassword(password), now());
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'user_create', username, now());
  res.json({ user: { id: Number(info.lastInsertRowid), username, created_at: now() } });
});

// Change a user's password.
usersRouter.patch('/:id', requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 6 characters.' });
  db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(hashPassword(password), id);
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'user_password_change', user.username, now());
  res.json({ ok: true });
});

usersRouter.delete('/:id', requireCsrf, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.admin.id) return res.status(400).json({ error: 'cannot_delete_self' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count <= 1) return res.status(400).json({ error: 'last_admin' });
  const user = db.prepare('SELECT username FROM admins WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM admins WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?,?,?,?)')
    .run(req.admin.id, 'user_delete', user.username, now());
  res.json({ ok: true });
});
