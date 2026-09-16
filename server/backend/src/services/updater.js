import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file is at <root>/src/services/updater.js, so the app root (holding
// src/, public/, package.json) is TWO levels up.
const appRoot = path.resolve(__dirname, '..', '..');
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
    console.log(`[pulse] Downloading update ${status.current} → ${status.latest} …`);
    const res = await fetch(status.assetUrl, { headers: { 'User-Agent': 'pulse-server' } });
    if (!res.ok) throw new Error(`Download failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-upd-'));
    const zipPath = path.join(tmp, 'server.zip');
    fs.writeFileSync(zipPath, buf);
    const extractDir = path.join(tmp, 'extracted');
    new AdmZip(zipPath).extractAllTo(extractDir, true);

    // Find the folder that actually holds the app, tolerating a nested top dir.
    let srcRoot = extractDir;
    if (!fs.existsSync(path.join(srcRoot, 'package.json'))) {
      const nested = fs.readdirSync(extractDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(extractDir, d.name))
        .find((p) => fs.existsSync(path.join(p, 'package.json')));
      if (nested) srcRoot = nested;
    }
    const stagedPkgPath = path.join(srcRoot, 'package.json');
    if (!fs.existsSync(stagedPkgPath) || !fs.existsSync(path.join(srcRoot, 'src', 'index.js'))) {
      throw new Error('Downloaded package has an unexpected layout (no package.json / src).');
    }
    const stagedVersion = JSON.parse(fs.readFileSync(stagedPkgPath, 'utf8')).version;

    // Copy code over the app root. package.json goes LAST so a half-finished
    // copy never leaves the version marker ahead of the actual files.
    for (const entry of ['src', 'public', 'node_modules', 'package.json']) {
      const from = path.join(srcRoot, entry);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(appRoot, entry), { recursive: true, force: true });
    }

    // Verify the swap actually landed before we hand off to a restart.
    const nowVersion = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version;
    if (nowVersion !== stagedVersion) {
      throw new Error(`Update did not take effect (package.json still ${nowVersion}). Check write permissions on ${appRoot}.`);
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }

    console.log(`[pulse] Update applied (${status.current} → ${stagedVersion}) at ${appRoot}; exiting to restart.`);
    status.current = stagedVersion;
    // Exit NON-ZERO so the service manager's on-failure restart relaunches us on
    // the new version. A clean exit 0 is treated as "stopped" and is NOT restarted.
    setTimeout(() => process.exit(1), 400); // let the HTTP response flush first
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
