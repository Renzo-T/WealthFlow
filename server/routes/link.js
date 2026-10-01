import { Router } from 'express';
import { Products, CountryCode } from 'plaid';
import plaid from '../plaid.js';
import db from '../db.js';
import { encrypt, decrypt } from '../crypto.js';
import { syncItem } from '../sync.js';

export const MAX_ITEMS = 10; // Plaid Trial plan cap
const router = Router();
const fail = (res, e) => res.status(500).json(e.response?.data || { error_message: e.message });

router.post('/token', async (_req, res) => {
  try {
    const redirect = process.env.PLAID_REDIRECT_URI;
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'WealthFlow',
      products: [Products.Transactions],
      optional_products: [Products.Investments, Products.Liabilities], // holdings; card statements and due dates
      transactions: { days_requested: 730 }, // Plaid's max; only applies when a bank is first connected
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirect && { redirect_uri: redirect }),
    });
    res.json({ link_token: data.link_token });
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
    ...(process.env.PLAID_REDIRECT_URI && { redirect_uri: process.env.PLAID_REDIRECT_URI }),
  });
  const dropped = [];
  try {
    for (;;) {
      try { const { data } = await token(wanted); return res.json({ link_token: data.link_token, dropped }); }
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

router.post('/exchange', async (req, res) => {
  try {
    const used = db.prepare('SELECT COUNT(*) n FROM items').get().n;
    if (used >= MAX_ITEMS) return res.status(400).json({ error_message: `Item limit reached (${MAX_ITEMS}).` });
    const { public_token, institution } = req.body;
    const { data } = await plaid.itemPublicTokenExchange({ public_token });
    db.prepare('INSERT OR REPLACE INTO items (id, institution, access_token) VALUES (?,?,?)')
      .run(data.item_id, institution ?? 'Unknown', encrypt(data.access_token));
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(data.item_id);
    res.json(await syncItem(item));
  } catch (e) { fail(res, e); }
});

export default router;
