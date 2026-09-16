import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Read our own version from package.json (used by the self-updater).
let pkgVersion = '0.0.0';
try {
  pkgVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '0.0.0';
} catch { /* ignore */ }

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function bool(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(v);
}

export const config = {
  root,
  port: int('PULSE_PORT', 8080),
  host: process.env.PULSE_HOST || '0.0.0.0',

  // Where the SQLite file lives.
  dbPath: process.env.PULSE_DB || path.join(root, 'data', 'pulse.db'),

  // Directory the compiled SPA is served from.
  publicDir: process.env.PULSE_PUBLIC || path.join(root, 'public'),

  // Admin session / CSRF lifetime (minutes). Token expiry forces re-login.
  sessionTtlMinutes: int('PULSE_SESSION_TTL_MIN', 60),

  // A device is considered "online" if seen within this many seconds.
  onlineWindowSeconds: int('PULSE_ONLINE_WINDOW_SEC', 120),

  // Allow a cross-origin dev frontend (Vite) to call the API.
  corsDevOrigin: process.env.PULSE_CORS_DEV_ORIGIN || '',

  // Cookies flagged Secure (set true behind HTTPS / a TLS terminating proxy).
  secureCookies: bool('PULSE_SECURE_COOKIES', false),

  // Bootstrap admin created on first run if no admin exists.
  bootstrapAdminUser: process.env.PULSE_ADMIN_USER || 'admin',
  bootstrapAdminPass: process.env.PULSE_ADMIN_PASS || '',

  // Pulse monorepo (owner/repo). Hardcoded default; both the agent update-check
  // and the server self-updater use it. Override with PULSE_REPO if you fork.
  repo: process.env.PULSE_REPO || process.env.PULSE_AGENT_REPO || 'TMarccci/pulse',

  // This server's own version (from package.json).
  version: pkgVersion,

  // Auto-apply server updates when a newer server-v* release exists.
  // Ignored inside Docker (update the image instead).
  autoUpdate: bool('PULSE_AUTO_UPDATE', false),

  // True when running inside the official container image.
  inDocker: bool('PULSE_IN_DOCKER', false) || fs.existsSync('/.dockerenv'),
};

// Back-compat alias.
config.agentUpdateRepo = config.repo;
