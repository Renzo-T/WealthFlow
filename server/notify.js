// "Tell me when something needs me": a few notices worth interrupting for, worked out after each sync.
// notices() only reads the database and decides; sending them is a separate, thin step (Windows only).
// Notice text can show on a lock screen, so it never contains an amount, a balance, an account number or a name:
// "A large bill is due tomorrow", not the figure or the payee.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import db from './db.js';
import { occurrences, freeToSpend } from './recurring.js';
import { describeStatus } from './sync.js';

// What was sent: one row per mark (a bank, a bill on its due date, a month), so nothing is sent twice.
db.exec('CREATE TABLE IF NOT EXISTS notified (key TEXT PRIMARY KEY, date TEXT NOT NULL)');

export const KINDS = ['signin', 'bill', 'free'];
export const BILL_MIN = 200; // default for meta notify_bill_min
export const notifySupported = process.platform === 'win32';

const meta = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value;
const setMeta = (k, v) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);

// Off until you turn it on; then every kind is on unless you untick it.
export function notifySettings() {
  let s = {};
  try { s = JSON.parse(meta('notify') ?? '{}') ?? {}; } catch { /* unreadable: defaults */ }
  const min = Number(meta('notify_bill_min') ?? NaN);
  return {
    supported: notifySupported,
    enabled: s.enabled === true,
    kinds: Object.fromEntries(KINDS.map((k) => [k, s.kinds?.[k] !== false])),
    billMin: Number.isFinite(min) && min >= 0 ? min : BILL_MIN,
  };
}

// { enabled?, kinds?: { signin?, bill?, free? }, billMin? } → the settings now. Throws on a bad threshold.
export function setNotifySettings(body = {}) {
  const cur = notifySettings();
  if (body.billMin !== undefined) {
    const v = Number(body.billMin);
    if (body.billMin === null || body.billMin === '' || !Number.isFinite(v) || v < 0) throw new Error('The bill amount must be a number, 0 or more.');
    setMeta('notify_bill_min', String(Math.round(v)));
  }
  const kinds = { ...cur.kinds };
  for (const k of KINDS) if (typeof body.kinds?.[k] === 'boolean') kinds[k] = body.kinds[k];
  setMeta('notify', JSON.stringify({ enabled: typeof body.enabled === 'boolean' ? body.enabled : cur.enabled, kinds }));
  return notifySettings();
}

const localDay = (d) => d.toLocaleDateString('en-CA');
const nextDay = (iso) => new Date(Date.parse(iso + 'T00:00Z') + 864e5).toISOString().slice(0, 10);
const count = (n) => (['', 'A', 'Two', 'Three'][n] ?? 'Several');

// The words for each kind, given how many things it's about. No amounts, balances, account numbers or names.
const TEXT = {
  signin: (n) => ({ title: n === 1 ? 'A bank needs you to sign in again' : `${count(n)} banks need you to sign in again`,
    body: 'Until then its balances and transactions stop updating. Reconnect on the Net worth page.', page: '#/networth' }),
  bill: (n) => ({ title: n === 1 ? 'A large bill is due tomorrow' : `${count(n)} large bills are due tomorrow`,
    body: 'Check there is enough in the account it is paid from.', page: '#/bills' }),
  free: () => ({ title: 'Free to spend is below zero',
    body: 'Bills and card balances due this month add up to more than your everyday cash.', page: '#/' }),
};
// marks: what notified records (a bank, a bill on its due date, a month); key: the notice's own identity.
const notice = (kind, marks) => ({ kind, key: marks.join('|'), marks, ...TEXT[kind](marks.length) });

// What applies right now, by kind, as marks.
function applying(now) {
  const today = localDay(now), tomorrow = nextDay(today);
  // A bank that needs you to sign in again (Plaid's sign-in errors only; other errors fix themselves).
  const signin = db.prepare('SELECT id, status FROM items ORDER BY id').all()
    .filter((i) => describeStatus(i.status).state === 'sign-in').map((i) => `signin:${i.id}`);
  // A large bill due tomorrow (meta notify_bill_min, $200 unless changed).
  const min = notifySettings().billMin;
  const bill = occurrences(tomorrow, tomorrow, today).filter((o) => o.direction === 'out' && o.amount >= min)
    .map((o) => `bill:${o.key}:${o.date}`);
  // Free to spend below zero: what's still due this month is more than the cash for it. At most once a month.
  const f = freeToSpend(today);
  const free = f.accounts.length && f.free < 0 ? [`free:${today.slice(0, 7)}`] : [];
  return { signin, bill, free };
}

// Every notice that applies now, whether or not it was sent or its kind is turned on.
export function candidates(now = new Date()) {
  const a = applying(now);
  return KINDS.filter((k) => a[k].length).map((k) => notice(k, a[k]));
}

// What to send now: at most three (one of each kind), only kinds you turned on, and never a mark already sent;
// a notice about several banks or bills counts only the ones not sent yet.
export function notices(now = new Date()) {
  const s = notifySettings();
  if (!s.enabled) return [];
  const sent = new Set(db.prepare('SELECT key FROM notified').all().map((r) => r.key));
  const a = applying(now);
  return KINDS.filter((k) => s.kinds[k]).map((k) => [k, a[k].filter((m) => !sent.has(m))])
    .filter(([, marks]) => marks.length).map(([k, marks]) => notice(k, marks)).slice(0, 3);
}

// Record what was sent.
export function markSent(list, now = new Date()) {
  const ins = db.prepare('INSERT OR IGNORE INTO notified (key, date) VALUES (?, ?)');
  db.transaction(() => { for (const n of list) for (const m of n.marks) ins.run(m, localDay(now)); })();
}

// Housekeeping before deciding: a bank that's fine again may be told about again if it later needs signing in;
// bill and month marks carry their own date, so old ones can go without anything repeating.
export function settle(now = new Date()) {
  const needs = new Set(db.prepare('SELECT id, status FROM items').all().filter((i) => describeStatus(i.status).state === 'sign-in').map((i) => `signin:${i.id}`));
  for (const { key } of db.prepare("SELECT key FROM notified WHERE key LIKE 'signin:%'").all())
    if (!needs.has(key)) db.prepare('DELETE FROM notified WHERE key = ?').run(key);
  const cutoff = localDay(new Date(now.getTime() - 60 * 864e5));
  db.prepare("DELETE FROM notified WHERE key NOT LIKE 'signin:%' AND date < ?").run(cutoff);
}

// ---------- Delivery (Windows): a toast through Windows PowerShell 5.1, which can reach the Windows notification
// API without a compiled add-on or a package. Kept apart from deciding, so the rest is testable anywhere.

// The name and icon Windows shows on the toast (and lists under Settings › System › Notifications), registered for
// the current user like the sign-in entry in startup.js. No admin rights needed.
export const APP_ID = 'WealthFlow.MizoMoney';
const APP_KEY = String.raw`HKCU\Software\Classes\AppUserModelId\WealthFlow.MizoMoney`;
const reg = (...args) => execFileSync('reg', args, { stdio: 'ignore', windowsHide: true });
function registerApp(root = process.cwd()) {
  reg('add', APP_KEY, '/v', 'DisplayName', '/d', 'Mizo Money', '/f');
  const icon = ['web/dist/seal-192.png', 'web/public/seal-192.png'].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  if (icon) reg('add', APP_KEY, '/v', 'IconUri', '/d', icon, '/f');
}

// Where a click on the toast goes. Normally the wealthflow-open: link below, which opens the installed app window on
// the notice's page (scripts/open-page.mjs); if that link couldn't be set up, the page in your default browser.
export const pageBase = () => `${fs.existsSync('certs/localhost.pem') ? 'https' : 'http'}://localhost:${+(process.env.WEALTHFLOW_PORT || 3000)}`;
const LINK_PAGE = { '#/networth': 'networth', '#/bills': 'bills', '#/': 'dashboard' };
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export function toastXml(n, { base = pageBase(), link = false } = {}) {
  const launch = link ? `wealthflow-open:${LINK_PAGE[n.page] ?? 'dashboard'}` : `${base}/${n.page}`;
  return `<toast activationType="protocol" launch="${esc(launch)}">`
    + `<visual><binding template="ToastGeneric"><text>${esc(n.title)}</text><text>${esc(n.body)}</text></binding></visual></toast>`;
}

// The installed app: Chrome's or Edge's Install makes a Start-menu shortcut "Mizo Money" that runs the browser's
// app launcher (chrome_proxy.exe / msedge_proxy.exe) with a profile and the app's id. Read straight from the shortcut
// file (the launcher path is stored as plain text, the arguments as UTF-16), so no PowerShell is needed.
export function parseAppShortcut(buf) {
  const text = [buf.toString('latin1'), buf.toString('utf16le'), buf.subarray(1).toString('utf16le')].join('\n');
  const proxy = /[A-Za-z]:\\[^\0\n"<>|?*]*?\\(?:chrome|msedge)_proxy\.exe/i.exec(text)?.[0];
  const appId = /--app-id=([a-p]{32})\b/.exec(text)?.[1];
  const p = /--profile-directory=(?:"([\w .-]{1,64})"|([\w.-]{1,64}))/.exec(text);
  return proxy && appId && p ? { proxy, profile: p[1] ?? p[2], appId } : null;
}
export function installedApp(env = process.env) {
  const roots = [env.APPDATA, env.ProgramData].filter(Boolean).map((d) => path.join(d, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  for (const r of roots) for (const sub of ['Chrome Apps', 'Edge Apps', '']) {
    const f = path.join(r, sub, 'Mizo Money.lnk');
    if (fs.existsSync(f)) { const app = parseAppShortcut(fs.readFileSync(f)); if (app) return app; }
  }
  return null;
}

// The wealthflow-open: link (current user only). Windows hands the link's address to open-page.mjs, which reads it
// only as one of three page names. Rewritten before each delivery, so a reinstalled app or a moved folder is picked
// up. Like startup.js, conhost --headless keeps a console window from flashing.
const LINK = String.raw`HKCU\Software\Classes\wealthflow-open`;
export const openerCommand = (app, base = pageBase(), root = process.cwd(), node = process.execPath) =>
  `conhost.exe --headless "${node}" "${path.win32.join(root, 'scripts', 'open-page.mjs')}" "${base}"`
  + (app ? ` "${app.proxy}" "${app.profile}" "${app.appId}"` : '') + ' "%1"';
function registerOpener(root = process.cwd()) {
  if (!fs.existsSync(path.join(root, 'scripts', 'open-page.mjs'))) return false;
  reg('add', LINK, '/ve', '/d', 'URL:Mizo Money page', '/f');
  reg('add', LINK, '/v', 'URL Protocol', '/d', '', '/f');
  reg('add', `${LINK}\\shell\\open\\command`, '/ve', '/d', openerCommand(installedApp(), pageBase(), root), '/f');
  return true;
}

// The script is fixed; the toasts reach it through an environment variable, so nothing in them is run as code.
const SCRIPT = `$ErrorActionPreference = 'Stop'
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:MIZO_TOAST_APP)
foreach ($t in ($env:MIZO_TOASTS | ConvertFrom-Json)) {
  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml($t)
  $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($xml))
}`;
const powershell = () => path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

// Show the toasts. Resolves when Windows accepted them; rejects with PowerShell's error otherwise.
export function deliver(list) {
  if (!notifySupported) return Promise.reject(new Error('Notifications are only available on Windows for now.'));
  registerApp();
  let link = false;
  try { link = registerOpener(); } catch { /* the click opens the browser instead */ }
  return new Promise((ok, fail) => {
    const p = spawn(powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
      Buffer.from(SCRIPT, 'utf16le').toString('base64')], {
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, MIZO_TOAST_APP: APP_ID, MIZO_TOASTS: JSON.stringify(list.map((n) => toastXml(n, { link }))) },
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.trim().split(/\r?\n/)[0] || `PowerShell exited with ${code}`))));
  });
}

// After a sync: decide, send, and record what was sent (only once Windows took it, so a failure is tried again next
// sync). Never runs in tests, which use an in-memory database.
export async function notifyAfterSync(now = new Date()) {
  if (!notifySupported || process.env.WEALTHFLOW_DB === ':memory:') return [];
  settle(now);
  const list = notices(now);
  if (!list.length) return [];
  await deliver(list);
  markSent(list, now);
  return list;
}
