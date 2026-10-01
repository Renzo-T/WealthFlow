import { Router } from 'express';
import { Products, CountryCode } from 'plaid';
import plaid, { plaidClient, resetPlaid } from '../plaid.js';
import db from '../db.js';
import { config, saveConfig, fromEnv, plaidConfigured } from '../config.js';
import { encrypt, decrypt } from '../crypto.js';
import { syncItem } from '../sync.js';

export const MAX_ITEMS = 10; // Plaid Trial plan cap
const router = Router();
const fail = (res, e) => res.status(500).json(e.response?.data || { error_message: e.message });

// Hosted Link (default): Plaid's own page, opened in the browser. It handles banks' sign-in redirects itself, so no
// https or redirect address is needed; the page polls /status until the session finishes. ?hosted=0 asks for the
// embedded Link instead (then PLAID_REDIRECT_URI, if set, is used for banks' redirects).
const hosted = (req) => req.query.hosted !== '0';
const linkOptions = (req) => (hosted(req) ? { hosted_link: {} } : config().PLAID_REDIRECT_URI ? { redirect_uri: config().PLAID_REDIRECT_URI } : {});

router.post('/token', async (req, res) => {
  try {
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'WealthFlow',
      products: [Products.Transactions],
      optional_products: [Products.Investments, Products.Liabilities], // holdings; card statements and due dates
      transactions: { days_requested: 730 }, // Plaid's max; only applies when a bank is first connected
      country_codes: [CountryCode.Us],
      language: 'en',
      ...linkOptions(req),
    });
    res.json({ link_token: data.link_token, hosted_link_url: data.hosted_link_url ?? null });
  } catch (e) { fail(res, e); }
});

// Institution can't provide the Investments product, so update mode for holdings will never work.
const unsupported = (e) => ['PRODUCTS_NOT_SUPPORTED', 'PRODUCT_NOT_ENABLED', 'INSTITUTION_NOT_SUPPORTED'].includes(e.response?.data?.error_code)
  || /not supported/i.test(e.response?.data?.error_message ?? '');

// Update mode: re-login for an expired Item (default), or grant consent for more products
// (?products=investments,liabilities). A product the bank can't provide is remembered and dropped, and the
// rest still go ahead, so one unsupported product doesn't block the others.
const PRODUCTS = { investments: [Products.Investments, 'no_investments', 'investment holdings'], liabilities: [Products.Liabilities, 'no_liabilities', 'card statements'] };
router.post('/update-token/:id', async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error_message: 'Unknown connection.' });
  let wanted = String(req.query.products ?? (req.query.investments === '1' ? 'investments' : '')).split(',').filter((p) => PRODUCTS[p]);
  const token = (products) => plaid.linkTokenCreate({
    user: { client_user_id: 'local-user' }, client_name: 'WealthFlow', country_codes: [CountryCode.Us], language: 'en',
    access_token: decrypt(item.access_token),
    ...(products.length && { additional_consented_products: products.map((p) => PRODUCTS[p][0]) }),
    ...linkOptions(req),
  });
  const dropped = [];
  try {
    for (;;) {
      try { const { data } = await token(wanted); return res.json({ link_token: data.link_token, hosted_link_url: data.hosted_link_url ?? null, dropped }); }
      catch (e) {
        if (!wanted.length || !unsupported(e)) throw e;
        // Find which product the bank refuses by trying each alone.
        let bad = null;
        for (const p of wanted) { try { await token([p]); } catch (e2) { if (unsupported(e2)) { bad = p; break; } throw e2; } }
        if (!bad) throw e;
        db.prepare(`UPDATE items SET ${PRODUCTS[bad][1]} = 1 WHERE id = ?`).run(item.id);
        dropped.push(PRODUCTS[bad][2]);
        wanted = wanted.filter((p) => p !== bad);
        if (!wanted.length) return res.status(400).json({ error_message: `${item.institution} doesn't share ${dropped.join(' or ')} through Plaid.`, dismissed: true });
      }
    }
  } catch (e) { fail(res, e); }
});

// The user just approved more products for this bank in Link. Record it now so the prompt disappears at once.
router.post('/granted/:id', (req, res) => {
  const cols = { investments: 'investments_consented', liabilities: 'liabilities_consented' };
  for (const p of req.body.products ?? []) if (cols[p]) db.prepare(`UPDATE items SET ${cols[p]} = 1 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

async function addBank(public_token, institution) {
  const used = db.prepare('SELECT COUNT(*) n FROM items').get().n;
  if (used >= MAX_ITEMS) throw Object.assign(new Error(`Item limit reached (${MAX_ITEMS}).`), { status: 400 });
  const { data } = await plaid.itemPublicTokenExchange({ public_token });
  db.prepare('INSERT OR REPLACE INTO items (id, institution, access_token) VALUES (?,?,?)')
    .run(data.item_id, institution ?? 'Unknown', encrypt(data.access_token));
  return syncItem(db.prepare('SELECT * FROM items WHERE id = ?').get(data.item_id));
}
router.post('/exchange', async (req, res) => {
  try { res.json(await addBank(req.body.public_token, req.body.institution)); }
  catch (e) { e.status ? res.status(e.status).json({ error_message: e.message }) : fail(res, e); }
});

// What a Hosted Link session ended with (from /link/token/get): still open, connected (with the public token and
// bank), finished (update mode returns no token), or left without connecting. Exported for tests.
export function sessionResult(data) {
  const s = (data.link_sessions ?? []).filter((x) => x.finished_at).at(-1);
  if (!s) return { done: false };
  const added = s.results?.item_add_results?.[0];
  const token = added?.public_token ?? s.on_success?.public_token;
  if (token) return { done: true, public_token: token, institution: added?.institution?.name ?? s.on_success?.metadata?.institution?.name ?? null };
  if (s.exit && !s.on_success && !s.results?.item_add_results?.length && !s.results?.item_update_results?.length) return { done: true, cancelled: true, error: s.exit.error?.display_message ?? null };
  return { done: true };
}

// Polled by the page while the Hosted Link tab is open. A new bank is added here (once per token); ?update=1 is an
// existing bank signing in again, which has nothing to exchange.
const handled = new Map();
router.get('/status/:token', async (req, res) => {
  try {
    if (handled.has(req.params.token)) return res.json(handled.get(req.params.token));
    const { data } = await plaid.linkTokenGet({ link_token: req.params.token });
    const r = sessionResult(data);
    if (!r.done) return res.json(r);
    let out = { done: true, cancelled: !!r.cancelled, error: r.error ?? null };
    if (r.public_token && req.query.update !== '1') { await addBank(r.public_token, r.institution); out = { done: true, added: r.institution ?? 'your bank' }; }
    handled.set(req.params.token, out);
    res.json(out);
  } catch (e) { e.status ? res.status(e.status).json({ error_message: e.message }) : fail(res, e); }
});

// ---------- First-run setup: Plaid keys ----------
// Whether keys are set (and where), and the environment. Secrets are never sent back.
router.get('/setup', (_req, res) => {
  const c = config();
  res.json({ configured: plaidConfigured(), env: c.PLAID_ENV || 'sandbox', client_id: c.PLAID_CLIENT_ID ? `${c.PLAID_CLIENT_ID.slice(0, 4)}…` : null,
    fromEnv: fromEnv('PLAID_CLIENT_ID') || fromEnv('PLAID_SECRET') });
});
// Save keys after checking them with Plaid (creating a link token proves the client ID, secret and environment match).
router.post('/setup', async (req, res) => {
  const client_id = String(req.body.client_id ?? '').trim(), secret = String(req.body.secret ?? '').trim();
  const env = ['sandbox', 'production'].includes(req.body.env) ? req.body.env : 'sandbox';
  if (!client_id || !secret) return res.status(400).json({ error_message: 'Paste both the client ID and the secret.' });
  if (fromEnv('PLAID_CLIENT_ID') || fromEnv('PLAID_SECRET')) return res.status(400).json({ error_message: 'Your keys are set in .env; change them there.' });
  try {
    await plaidClient({ PLAID_CLIENT_ID: client_id, PLAID_SECRET: secret, PLAID_ENV: env }).linkTokenCreate({
      user: { client_user_id: 'local-user' }, client_name: 'WealthFlow', products: [Products.Transactions], country_codes: [CountryCode.Us], language: 'en' });
  } catch (e) {
    const d = e.response?.data;
    return res.status(400).json({ error_message: d
      ? `Plaid didn't accept those keys for ${env === 'production' ? 'Production' : 'Sandbox'}. Check that you copied the whole client ID and the ${env === 'production' ? 'Production' : 'Sandbox'} secret (each environment has its own). Plaid said: ${d.error_message}`
      : `Couldn't reach Plaid (${e.message}). Check your internet connection and try again.` });
  }
  saveConfig({ PLAID_CLIENT_ID: client_id, PLAID_SECRET: secret, PLAID_ENV: env });
  resetPlaid();
  res.json({ ok: true, env });
});

export default router;
