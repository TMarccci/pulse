import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, now } from './db.js';
import { hashPassword, purgeExpiredSessions } from './auth.js';
import { authRouter } from './routes/auth.js';
import { agentRouter } from './routes/agent.js';
import { devicesRouter } from './routes/devices.js';
import { analyticsRouter } from './routes/analytics.js';
import { settingsRouter } from './routes/settings.js';
import { exportRouter } from './routes/export.js';
import { updatesRouter } from './routes/updates.js';
import { startUpdateChecker } from './services/updater.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

// Optional CORS for a cross-origin Vite dev server.
if (config.corsDevOrigin) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsDevOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));

app.use('/api/auth', authRouter);
app.use('/api/agent', agentRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);
app.use('/api/updates', updatesRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// ---- Serve the compiled SPA (if built) ------------------------------------
if (fs.existsSync(config.publicDir)) {
  app.use(express.static(config.publicDir));
  app.get('*', (req, res) => {
    const index = path.join(config.publicDir, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    res.status(404).send('SPA not built. Run the frontend build.');
  });
} else {
  app.get('/', (req, res) => res.type('text/plain').send(
    'Pulse server running. Build the frontend (server/frontend) to serve the dashboard.'));
}

// ---- Bootstrap admin -------------------------------------------------------
function bootstrap() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count === 0) {
    if (config.bootstrapAdminPass) {
      db.prepare('INSERT INTO admins (username, pass_hash, created_at) VALUES (?,?,?)')
        .run(config.bootstrapAdminUser, hashPassword(config.bootstrapAdminPass), now());
      console.log(`[pulse] Created bootstrap admin "${config.bootstrapAdminUser}".`);
    } else {
      console.warn('[pulse] No admin accounts exist. Set PULSE_ADMIN_PASS or run `npm run seed`.');
    }
  }
}
bootstrap();

// Periodically clear expired sessions.
setInterval(purgeExpiredSessions, 5 * 60 * 1000).unref();

// Self-update checker (GitHub Releases → optional auto-apply).
startUpdateChecker();

app.listen(config.port, config.host, () => {
  console.log(`[pulse] Server listening on http://${config.host}:${config.port}`);
});
