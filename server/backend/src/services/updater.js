import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..'); // backend root (holds src/, public/, package.json)
const TAG_PREFIX = 'server-v';

let status = {
  current: config.version,
  latest: null,
  tag: null,
  updateAvailable: false,
  releaseUrl: null,
  assetUrl: null,
  checkedAt: null,
  error: null,
  applying: false,
};

function parseVer(tag) {
  const m = String(tag || '').match(/\d+\.\d+\.\d+/);
  return m ? m[0] : '0.0.0';
}
function cmp(a, b) {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

export function getUpdateStatus() {
  return { ...status, repo: config.repo, inDocker: config.inDocker, canApply: !config.inDocker };
}

// Query GitHub for the newest server-v* release and refresh status.
export async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${config.repo}/releases?per_page=30`, {
      headers: { 'User-Agent': 'pulse-server', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const list = await res.json();
    const rel = (Array.isArray(list) ? list : [])
      .filter((r) => r.tag_name?.startsWith(TAG_PREFIX) && !r.draft && !r.prerelease)
      .sort((a, b) => cmp(parseVer(b.tag_name), parseVer(a.tag_name)))[0];

    if (rel) {
      const latest = parseVer(rel.tag_name);
      const asset = (rel.assets || []).find((a) => /pulse-server.*\.zip$/i.test(a.name));
      status = {
        ...status,
        latest,
        tag: rel.tag_name,
        releaseUrl: rel.html_url,
        assetUrl: asset?.browser_download_url || null,
        updateAvailable: cmp(latest, config.version) > 0 && !!asset,
        checkedAt: Math.floor(Date.now() / 1000),
        error: null,
      };
    } else {
      status = { ...status, checkedAt: Math.floor(Date.now() / 1000), error: null };
    }
  } catch (e) {
    status = { ...status, error: e.message, checkedAt: Math.floor(Date.now() / 1000) };
  }
  return getUpdateStatus();
}

// Download the new release zip, overwrite the app files, and exit so the
// service manager restarts the server on the new version.
export async function applyUpdate() {
  if (config.inDocker) throw new Error('Auto-update is disabled in Docker — pull the new image instead.');
  if (!status.updateAvailable || !status.assetUrl) throw new Error('No applicable update available.');

  status.applying = true;
  try {
    const res = await fetch(status.assetUrl, { headers: { 'User-Agent': 'pulse-server' } });
    if (!res.ok) throw new Error(`Download failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-upd-'));
    const zipPath = path.join(tmp, 'server.zip');
    fs.writeFileSync(zipPath, buf);
    const extractDir = path.join(tmp, 'extracted');
    new AdmZip(zipPath).extractAllTo(extractDir, true);

    for (const entry of ['src', 'public', 'package.json', 'node_modules']) {
      const from = path.join(extractDir, entry);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(appRoot, entry), { recursive: true, force: true });
    }

    console.log(`[pulse] Update applied (${status.current} → ${status.latest}); restarting.`);
    setTimeout(() => process.exit(0), 500); // let the HTTP response flush first
    return true;
  } finally {
    status.applying = false;
  }
}

// Poll on startup and every 6 hours; auto-apply if enabled and not in Docker.
export function startUpdateChecker() {
  checkForUpdate();
  setInterval(async () => {
    await checkForUpdate();
    if (config.autoUpdate && status.updateAvailable && !config.inDocker) {
      applyUpdate().catch((e) => console.warn('[pulse] auto-update failed:', e.message));
    }
  }, 6 * 3600 * 1000).unref();
}
