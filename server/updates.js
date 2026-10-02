// Update notice: about once a day, ask GitHub for the newest release of this app's repository (package.json
// "repository") and say so in the app when it's newer than this copy. Nothing about you is sent: it's an anonymous
// request for public release information. A private repository (or no releases yet) just means nothing to report.
// Can be turned off in Settings › App (meta update_checks = '0').
import fs from 'node:fs';
import path from 'node:path';
import db from './db.js';
import { appRoot, portable } from './config.js';

const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
export const version = pkg.version;
// "owner/name" from package.json's repository (a string or { url }), or null.
export const repoSlug = (repo = pkg.repository) => (typeof repo === 'string' ? repo : repo?.url ?? '')
  .match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1] ?? null;
// a > b for versions like 1.2.3 (a leading v is ignored).
export function newer(a, b) {
  const p = (v) => String(v).replace(/^v/, '').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

const DAY = 864e5;
const getMeta = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value;
const setMeta = (k, v) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
const last = () => { try { return JSON.parse(getMeta('update_check') ?? 'null'); } catch { return null; } };
export const checksOn = () => process.env.WEALTHFLOW_UPDATE_CHECKS !== '0' && getMeta('update_checks') !== '0'; // the env switch is for tests
export const setChecks = (on) => setMeta('update_checks', on ? '1' : '0');

// Ask GitHub, at most once a day unless forced. Keeps the last good answer if a check fails (e.g. offline).
export async function refreshUpdate({ force = false, slug = repoSlug() } = {}) {
  const prev = last();
  if (!checksOn() || !slug || (!force && prev && Date.now() - Date.parse(prev.checked) < DAY)) return prev;
  const checked = new Date().toISOString();
  let next;
  try {
    const r = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      headers: { 'User-Agent': 'WealthFlow', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (r.status === 404) next = { checked, latest: null }; // no releases yet, or a private repository
    else if (!r.ok) next = { ...prev, checked, error: `GitHub answered ${r.status}` };
    else {
      const j = await r.json();
      const zip = j.assets?.find((a) => /win-x64\.zip$/.test(a.name));
      next = { checked, latest: j.tag_name?.replace(/^v/, '') ?? null, page: j.html_url, download: zip?.browser_download_url ?? j.html_url,
        published: j.published_at };
    }
  } catch (e) { next = { ...prev, checked, error: e.name === 'TimeoutError' ? 'GitHub took too long to answer' : e.message }; }
  setMeta('update_check', JSON.stringify(next));
  return next;
}

// What the page shows. how: 'download' for the downloaded copy (replace the folder), 'git' when run from the code.
export function updateStatus() {
  const c = last() ?? {};
  return { version, enabled: checksOn(), repo: repoSlug(), checked: c.checked ?? null, latest: c.latest ?? null,
    available: !!(c.latest && newer(c.latest, version)), download: c.download ?? null, page: c.page ?? null,
    published: c.published ?? null, error: c.error ?? null, how: portable ? 'download' : 'git' };
}
