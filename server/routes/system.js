import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, config, fromEnv } from '../config.js';
import db from '../db.js';
import plaid from '../plaid.js';
import { decrypt } from '../crypto.js';
import { classify } from '../categories.js';
import { listBackups } from '../backup.js';
import { assignTrips } from '../trips.js';
import { startupStatus, setStartup } from '../startup.js';
const router = Router();

// How this copy is running ('app' = npm run app / started at sign-in; 'dev' = npm start), and starting at sign-in.
const appMode = () => process.env.WEALTHFLOW_APP === '1';
router.get('/app', (_req, res) => res.json({ mode: appMode() ? 'app' : 'dev', startup: startupStatus() }));
router.put('/app/startup', (req, res) => {
  try { res.json({ mode: appMode() ? 'app' : 'dev', startup: setStartup(!!req.body.enabled) }); }
  catch (e) { res.status(400).json({ error_message: e.message }); }
});
// Stop the background copy (app mode only; in development, stop npm start instead).
router.post('/app/quit', (_req, res) => {
  if (!appMode()) return res.status(400).json({ error_message: 'WealthFlow is running from npm start; stop it there.' });
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});

router.get('/system', (_req, res) => {
  const c = config();
  res.json({ plaidEnv: c.PLAID_ENV || 'sandbox', redirectUri: c.PLAID_REDIRECT_URI || null, dataDir, keyInEnv: fromEnv('ENCRYPTION_KEY') });
});

// Consistent snapshot of the database (safe while the app is running). Keeps the 5 newest copies on disk.
router.get('/backups', (_req, res) => res.json(listBackups()));

// Dashboard layout: { order: [panel ids], hidden: [panel ids], rail: [panel ids in the side column] }.
// Stored in the database (so it's in backups); unknown ids are ignored by the page, and new panels slot in at
// their default position, so a saved layout never hides features added later.
const getMeta = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value;
router.get('/settings/dashboard', (_req, res) => res.json(JSON.parse(getMeta('dashboard_layout') ?? 'null')));
router.put('/settings/dashboard', (req, res) => {
  const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^[a-z]{1,20}$/.test(x)).slice(0, 50) : []);
  const layout = req.body?.reset ? null : { order: ids(req.body.order), hidden: ids(req.body.hidden), rail: ids(req.body.rail) };
  if (layout) db.prepare("INSERT INTO meta (key, value) VALUES ('dashboard_layout', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(layout));
  else db.prepare("DELETE FROM meta WHERE key = 'dashboard_layout'").run();
  res.json({ ok: true });
});

router.get('/backup/download', async (_req, res) => {
  try {
    const dir = path.join(dataDir, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toLocaleString('sv').replace(/[: ]/g, '-').slice(0, 16);
    const file = path.join(dir, `wealthflow-${stamp}.db`);
    await db.backup(file);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.db')).sort().slice(0, -5)) fs.unlinkSync(path.join(dir, f));
    res.download(file);
  } catch (e) { res.status(500).json({ error_message: e.message }); }
});

router.patch('/accounts/:id', (req, res) => {
  db.prepare('UPDATE accounts SET in_networth = ? WHERE id = ?').run(req.body.in_networth ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// Change what kind of account this is ({ type, subtype }), or { reset: true } to go back to the bank's type.
// Type decides whether it counts as an asset or a debt, its allocation bucket, and whether transfers into it are savings.
const TYPES = { depository: 1, credit: 1, loan: 1, investment: 1, other: 1 };
router.patch('/accounts/:id/type', (req, res) => {
  if (req.body.reset) {
    db.prepare('UPDATE accounts SET type = plaid_type, subtype = plaid_subtype, type_overridden = 0 WHERE id = ?').run(req.params.id);
  } else {
    const { type, subtype } = req.body;
    if (!TYPES[type]) return res.status(400).json({ error_message: 'Unknown account type.' });
    db.prepare('UPDATE accounts SET type = ?, subtype = ?, type_overridden = 1 WHERE id = ?').run(type, String(subtype ?? type).slice(0, 40), req.params.id);
  }
  classify(); assignTrips(); // savings detection depends on account types
  res.json({ ok: true });
});

// Disconnects the Item at Plaid, then deletes everything local that belongs to it.
// If Plaid refuses (e.g. already invalid), the caller can retry with ?force=1 to delete locally anyway.
router.delete('/items/:id', async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error_message: 'Unknown connection.' });
  try { await plaid.itemRemove({ access_token: decrypt(item.access_token) }); }
  catch (e) {
    if (req.query.force !== '1') return res.status(502).json({ error_message: e.response?.data?.error_message || e.message, can_force: true });
  }
  const ids = db.prepare('SELECT id FROM accounts WHERE item_id = ?').all(item.id).map((a) => a.id);
  const ph = ids.map(() => '?').join(',');
  db.transaction(() => {
    if (ids.length) {
      // goals linked to these accounts keep their last known balance as a manual amount
      db.prepare(`UPDATE goals SET saved = COALESCE((SELECT balance FROM accounts WHERE id = goals.account_id), saved), account_id = NULL
        WHERE account_id IN (${ph})`).run(...ids);
      for (const t of ['transactions', 'balance_snapshots', 'holdings']) db.prepare(`DELETE FROM ${t} WHERE account_id IN (${ph})`).run(...ids);
    }
    db.prepare('DELETE FROM recurring WHERE item_id = ?').run(item.id);
    db.prepare('DELETE FROM accounts WHERE item_id = ?').run(item.id);
    db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  })();
  res.json({ ok: true });
});

export default router;
