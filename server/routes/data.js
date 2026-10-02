import { Router } from 'express';
import db from '../db.js';
import { syncAll, lastSync, AUTO_SYNC_HOURS, describeStatus } from '../sync.js';
import { MAX_ITEMS } from './link.js';
import { summary, netWorthBreakdown } from '../summary.js';
import { cashFlow, topCategories, allocation, upcoming, flow, accountFlow, holdingKind, coverage, investmentSummary, ACCT } from '../insights.js';
import { classify, CATEGORIES, GROUPS, NOT_SPENDING, pickerGroups, peerOf, SPEND_SQL, reviewSince, historyStart, historyCapped } from '../categories.js';
import { describe } from '../describe.js';
import { accountHistory } from '../summary.js';
import { bills, calendar, seriesKey, freeToSpend, paycheckCandidates, paycheckRule, markPaycheckHandled } from '../recurring.js';
import { budgetMonth } from '../budget.js';
import { whatChanged, groupChanges, frequentSpend, watchlist, addWatch, topMerchants } from '../watch.js';

import { assignTrips } from '../trips.js';
const router = Router();

router.get('/items', (_req, res) =>
  res.json({ max: MAX_ITEMS, items: db.prepare(`SELECT i.id, i.institution, i.status,
    (NOT i.no_investments AND NOT i.investments_consented
     AND EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = i.id AND a.type = 'investment')) AS needs_investments,
    (i.investments_consented AND NOT EXISTS (SELECT 1 FROM holdings h JOIN accounts a ON a.id = h.account_id WHERE a.item_id = i.id)
     AND EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = i.id AND a.type = 'investment')) AS holdings_pending,
    (NOT i.no_liabilities AND NOT i.liabilities_consented
     AND EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = i.id AND a.type = 'credit')) AS needs_liabilities
    FROM items i`).all().map((i) => ({ ...i, ...describeStatus(i.status) })), lastSync: lastSync(), autoSyncHours: AUTO_SYNC_HOURS }));

// `name` is the nickname when set; `bank_name` is always what the bank calls it.
router.get('/accounts', (_req, res) =>
  res.json(db.prepare(`SELECT a.*, a.name AS bank_name, ${ACCT} AS name, i.institution FROM accounts a
    LEFT JOIN items i ON i.id = a.item_id ORDER BY i.institution, COALESCE(a.nickname, a.name)`).all()));

// Where charts and reports start (capped: 3 months before the first connection), and turning that off.
router.get('/settings/history', (_req, res) => res.json({ capped: historyCapped(), start: historyStart() ?? reviewSince() }));
router.put('/settings/history', (req, res) => {
  db.prepare("INSERT INTO meta (key, value) VALUES ('history_all', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(req.body.capped ? '0' : '1');
  res.json({ capped: historyCapped(), start: historyStart() ?? reviewSince() });
});

// What moved your net worth: saved vs market and other (period: month, 30d, all).
router.get('/networth/breakdown', (req, res) => res.json(netWorthBreakdown(String(req.query.period ?? 'month'))));

// Net worth page: every account with a 30-day balance trend and change (estimated where there's no real
// daily snapshot yet), plus manual assets and debts.
router.get('/networth', (_req, res) => {
  const accounts = db.prepare(`SELECT a.*, a.name AS bank_name, ${ACCT} AS name, i.institution FROM accounts a
    LEFT JOIN items i ON i.id = a.item_id ORDER BY i.institution, COALESCE(a.nickname, a.name)`).all();
  const hist = accountHistory(accounts, 30);
  res.json({
    accounts: accounts.map((a) => {
      const h = hist[a.id] ?? [];
      // Investment values can't be worked out backwards from transactions (prices move), so before WealthFlow's first
      // daily snapshot there's no history: no change to report yet, just when tracking started.
      const realFrom = h.find((p) => !p.est)?.date ?? null;
      const untracked = a.type === 'investment' && (!realFrom || realFrom > h[0]?.date);
      return { ...a, spark: untracked ? h.filter((p) => !p.est).map((p) => p.balance) : h.map((p) => p.balance), estimated: h.some((p) => p.est),
        change: untracked ? null : h.length > 1 ? h.at(-1).balance - h[0].balance : 0, tracking_since: untracked ? realFrom ?? new Date().toLocaleDateString('en-CA') : null };
    }),
    manual: db.prepare('SELECT * FROM manual_assets ORDER BY id').all(),
    lastSync: db.prepare("SELECT value FROM meta WHERE key = 'last_sync'").get()?.value ?? null,
  });
});

router.patch('/accounts/:id/nickname', (req, res) => {
  const nick = String(req.body.nickname ?? '').trim().slice(0, 60);
  db.prepare('UPDATE accounts SET nickname = ? WHERE id = ?').run(nick || null, req.params.id);
  res.json({ ok: true });
});

// A matched transfer is one row: the outgoing side, with the receiving account as `to_account`. If the
// receiving side carries the meaning (a withdrawal from savings), its category and group are shown.
// Filters: q (text), category=<sub> or g:<group>, account=<id> (either side of a transfer), from/to
// (YYYY-MM-DD, inclusive), sweeps=1 to include sweeps. summary=1 returns { rows, summary } where summary
// covers every matching row, not just the returned page.
const TX_ROWS = `SELECT t.*,
      CASE WHEN t.transfer_account IS NOT NULL AND t.amount < 0 THEN COALESCE(na.nickname, na.name) ELSE ${ACCT} END AS account,
      CASE WHEN t.transfer_account IS NOT NULL AND t.amount < 0 THEN ${ACCT}
        ELSE COALESCE(pa.nickname, pa.name, na.nickname, na.name) END AS to_account,
      CASE WHEN p.id IS NOT NULL AND t.category = 'Transfer' THEN p.category ELSE t.category END AS shown,
      CASE WHEN p.id IS NOT NULL AND t.category = 'Transfer' THEN p.grp ELSE t.grp END AS shown_grp,
      p.name AS pair_name, p.account_id AS pair_account_id, tr.name AS trip_name, tr.status AS trip_status, COALESCE(rb.merchant, rb.name) AS paidback_name, rb.date AS paidback_date, rb.amount AS paidback_amount,
      (SELECT COUNT(*) FROM transactions s WHERE s.name = t.name) AS same_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN transactions p ON p.id = t.transfer_pair LEFT JOIN accounts pa ON pa.id = p.account_id
    LEFT JOIN accounts na ON na.id = t.transfer_account
    LEFT JOIN transactions rb ON rb.id = t.reimburses
    LEFT JOIN trips tr ON tr.id = t.trip_id AND tr.status = 'confirmed'
    WHERE NOT (t.transfer_pair IS NOT NULL AND t.amount < 0)`;
// @parts: 0 for the list (originals, with their split parts attached), 1 for totals and CSV (the parts, not the originals).
const TX_WHERE = `(@q = '' OR name LIKE @like OR merchant LIKE @like OR pair_name LIKE @like)
  AND (CASE WHEN @parts = 1 THEN is_split = 0 ELSE split_of IS NULL END)
  AND (@category = '' OR shown = @category OR (@parts = 0 AND is_split = 1 AND id IN (SELECT split_of FROM transactions WHERE category = @category)))
  AND (@grp = '' OR shown_grp = @grp OR (@parts = 0 AND is_split = 1 AND id IN (SELECT split_of FROM transactions WHERE grp = @grp)))
  AND (@account = '' OR account_id = @account OR pair_account_id = @account OR transfer_account = @account)
  AND (@from = '' OR date >= @from) AND (@to = '' OR date <= @to)
  AND (@sweeps = 1 OR COALESCE(shown, '') != 'Sweep')
  AND (@unsure = 0 OR (cat_source = 'plaid' AND pfc_confidence = 'LOW' AND date >= @since))`; // Plaid's low-confidence guesses, recent ones only
const NOT_SPEND = NOT_SPENDING.map((g) => `'${g}'`).join(',');
function txParams(req) {
  const s = (k) => String(req.query[k] ?? '');
  const c = s('category'), grp = c.startsWith('g:') ? c.slice(2) : '', unsure = c === 'unsure' ? 1 : 0;
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const params = { q: s('q'), like: `%${s('q')}%`, category: grp ? '' : c, grp, account: s('account'),
    from: date(s('from')), to: date(s('to')), sweeps: s('sweeps') === '1' ? 1 : 0, parts: 0, unsure, since: reviewSince() };
  if (unsure) params.category = '';
  return params;
}
const IS_SPEND = `COALESCE(shown_grp, 'Misc') NOT IN (${NOT_SPEND})`;
const billOf = (b) => (b ? { recurring: true, bill: { name: b.name, schedule: b.schedule, next_date: b.next_date } } : { recurring: false });
router.get('/transactions', (req, res) => {
  const params = txParams(req);
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  // Rows that belong to a recurring bill get `recurring: true` (same series logic as the Bills page).
  const series = new Map(bills().filter((b) => !b.hidden && !b.ended && b.source !== 'manual').map((b) => [b.key, b]));
  const partsOf = db.prepare('SELECT id, amount, category, grp FROM transactions WHERE split_of = ? ORDER BY id');
  const rows = db.prepare(`SELECT * FROM (${TX_ROWS}) WHERE ${TX_WHERE} ORDER BY date DESC, id LIMIT @limit`)
    .all({ ...params, limit }).map((r) => ({ ...r, display: r.merchant || describe(r.name),
      ...billOf(series.get(seriesKey({ ...r, pair_account: r.pair_account_id }))), parts: r.is_split ? partsOf.all(r.id) : undefined }));
  if (req.query.summary !== '1') return res.json(rows);
  const summary = db.prepare(`SELECT COUNT(*) count,
      COALESCE(SUM(CASE WHEN shown_grp = 'Income' THEN -amount END), 0) income,
      COALESCE(SUM(CASE WHEN ${IS_SPEND} THEN amount END), 0) spent,
      MAX(CASE WHEN ${IS_SPEND} THEN amount END) largest_expense,
      MAX(CASE WHEN shown_grp = 'Income' THEN -amount END) largest_income,
      AVG(CASE WHEN ${IS_SPEND} AND amount > 0 THEN amount END) avg_expense,
      MIN(date) first, MAX(date) last
    FROM (${TX_ROWS}) WHERE ${TX_WHERE}`).get({ ...params, parts: 1 });
  res.json({ rows, summary });
});

// The current filters as a spreadsheet. Amounts use the everyday sign: negative = money out.
router.get('/transactions.csv', (req, res) => {
  const rows = db.prepare(`SELECT * FROM (${TX_ROWS}) WHERE ${TX_WHERE} ORDER BY date DESC, id`).all({ ...txParams(req), parts: 1 });
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['Date', 'Description', 'Merchant', 'Category', 'Group', 'Account', 'To account', 'Amount', 'Pending'].join(',')];
  for (const r of rows) lines.push([r.date, r.name, r.merchant, r.shown, r.shown_grp, r.account, r.to_account,
    (-r.amount).toFixed(2), r.pending ? 'yes' : ''].map(q).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="wealthflow-transactions-${new Date().toLocaleDateString('en-CA')}.csv"`);
  res.send(lines.join('\r\n'));
});

// Split a transaction into parts with their own categories (they must add up to it), or undo the split.
router.post('/transactions/:id/split', (req, res) => {
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!t || t.split_of) return res.status(404).json({ error_message: 'Unknown transaction.' });
  if (t.transfer_pair) return res.status(400).json({ error_message: "A transfer between your accounts can't be split." });
  const parts = (Array.isArray(req.body.parts) ? req.body.parts : []).map((p) => ({ amount: Math.round(Number(p.amount) * 100), category: p.category }));
  if (parts.length < 2 || parts.some((p) => !p.amount || !CATEGORIES.includes(p.category))) return res.status(400).json({ error_message: 'Give each part an amount and a category (at least two parts).' });
  const sign = Math.sign(t.amount) || 1;
  if (parts.reduce((s, p) => s + p.amount, 0) !== Math.round(Math.abs(t.amount) * 100)) return res.status(400).json({ error_message: `The parts need to add up to ${Math.abs(t.amount).toFixed(2)}.` });
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE split_of = ?').run(t.id);
    const ins = db.prepare(`INSERT INTO transactions (id, account_id, date, name, merchant, amount, pfc_primary, pfc_detailed, pending, logo_url,
      pfc_confidence, city, region, country, channel, counterparty, lat, lon, user_category, split_of)
      SELECT ?, account_id, date, name, merchant, ?, pfc_primary, pfc_detailed, pending, logo_url,
      pfc_confidence, city, region, country, channel, counterparty, lat, lon, ?, id FROM transactions WHERE id = ?`);
    parts.forEach((p, i) => ins.run(`${t.id}:${i + 1}`, (sign * p.amount) / 100, p.category, t.id));
    db.prepare('UPDATE transactions SET is_split = 1 WHERE id = ?').run(t.id);
  })();
  classify(); assignTrips();
  res.json({ ok: true });
});
router.delete('/transactions/:id/split', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE split_of = ?').run(req.params.id);
  db.prepare('UPDATE transactions SET is_split = 0 WHERE id = ?').run(req.params.id);
  classify(); assignTrips();
  res.json({ ok: true });
});

// Edit multiple: set one category on several transactions at once (each as a one-off choice).
router.post('/transactions/bulk', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 1000) : [];
  if (!ids.length || !CATEGORIES.includes(req.body.category)) return res.status(400).json({ error_message: 'Pick transactions and a category.' });
  const upd = db.prepare('UPDATE transactions SET user_category = ? WHERE id = ?');
  db.transaction(() => { for (const id of ids) upd.run(req.body.category, id); })();
  classify(); assignTrips();
  res.json({ ok: true, updated: ids.length });
});

// ---- Bills: everything recurring, with your edits. See recurring.js for the rule shapes.
const RULE_KINDS = { dom: 1, eom: 1, bday: 1, lastbday: 1, semi: 1, weeks: 1, months: 1, due: 1 };
const AMOUNT_MODES = ['fixed', 'last', 'average', 'statement', 'minimum', 'current'];
function cleanRule(r) {
  if (!r || !RULE_KINDS[r.kind]) return null;
  const n = Math.max(0, Math.min(r.kind === 'dom' ? 31 : 60, Math.round(Number(r.n) || 0)));
  const out = { kind: r.kind, n: r.kind === 'dom' || r.kind === 'bday' || r.kind === 'lastbday' || r.kind === 'weeks' || r.kind === 'months' ? Math.max(1, n) : n };
  if (r.kind === 'semi') out.n = Math.max(1, Math.min(28, n));
  if (r.kind === 'dom' || r.kind === 'eom' || r.kind === 'months' || r.kind === 'semi') out.roll = [1, -1].includes(Number(r.roll)) ? Number(r.roll) : 0;
  if (r.kind === 'weeks' || r.kind === 'months') out.anchor = /^\d{4}-\d{2}-\d{2}$/.test(r.anchor ?? '') ? r.anchor : new Date().toLocaleDateString('en-CA');
  if (r.kind === 'months') out.day = Math.max(1, Math.min(31, Math.round(Number(r.day) || +out.anchor.slice(8))));
  return out;
}
router.get('/bills', (_req, res) => res.json(bills()));
router.get('/coverage', (_req, res) => res.json(coverage()));
// Free to spend this month, and how much of it your flexible budget has already planned for.
router.get('/safe-to-spend', (_req, res) => {
  const f = freeToSpend(), today = new Date().toLocaleDateString('en-CA');
  const flex = budgetMonth(today.slice(0, 7), today).totals.flexible;
  res.json({ ...f, planned: flex.budget ? Math.max(0, flex.budget - flex.actual) : null });
});
router.put('/settings/cushion', (req, res) => {
  const v = Math.max(0, Math.round(Number(req.body.amount) || 0));
  db.prepare("INSERT INTO meta (key, value) VALUES ('safe_cushion', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(String(v));
  res.json({ amount: v });
});
router.get('/investments/summary', (_req, res) => res.json(investmentSummary()));
router.get('/bills/calendar', (req, res) => {
  const m = /^\d{4}-\d{2}$/.test(req.query.month ?? '') ? req.query.month : new Date().toLocaleDateString('en-CA').slice(0, 7);
  res.json(calendar(m));
});
// Save your version of a bill: any of name, rule, amount_mode (+ amount for "fixed"), hidden.
router.put('/bills/:key', (req, res) => {
  const b = req.body, key = req.params.key;
  const cur = db.prepare('SELECT * FROM bill_settings WHERE key = ?').get(key) ?? {};
  const rule = b.rule === undefined ? cur.rule : b.rule ? JSON.stringify(cleanRule(b.rule)) : null;
  const mode = b.amount_mode === undefined ? cur.amount_mode : AMOUNT_MODES.includes(b.amount_mode) ? b.amount_mode : null;
  const amount = b.amount === undefined ? cur.amount : Number(b.amount) >= 0 ? Number(b.amount) : null;
  if (mode === 'fixed' && !(amount > 0)) return res.status(400).json({ error_message: 'Enter the amount.' });
  db.prepare(`INSERT INTO bill_settings (key, name, rule, amount_mode, amount, hidden) VALUES (@key, @name, @rule, @mode, @amount, @hidden)
    ON CONFLICT(key) DO UPDATE SET name = @name, rule = @rule, amount_mode = @mode, amount = @amount, hidden = @hidden`)
    .run({ key, name: b.name === undefined ? cur.name ?? null : String(b.name).trim().slice(0, 60) || null, rule, mode, amount,
      hidden: b.hidden === undefined ? cur.hidden ?? 0 : b.hidden ? 1 : 0 });
  res.json({ ok: true });
});
// Add your own bill (or recurring income).
// Paychecks waiting for "how often are you paid?", and the answer: a recurring income on that schedule
// (category Salary, so Safe to spend uses it as payday), or 'no' when it isn't a paycheck.
router.get('/bills/paychecks', (_req, res) => res.json(paycheckCandidates()));
router.post('/bills/paychecks', (req, res) => {
  const c = paycheckCandidates().find((x) => x.key === req.body.key);
  if (!c) return res.status(404).json({ error_message: 'That paycheck is already handled.' });
  if (req.body.cadence !== 'no') {
    const rule = paycheckRule(req.body.cadence, c.date);
    if (!rule) return res.status(400).json({ error_message: 'Pick how often you are paid.' });
    db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, account_id, rule, amount_mode, amount, category)
      VALUES (?, 1, ?, 'in', ?, ?, 'fixed', ?, 'Salary')`).run(`man:${Date.now()}`, `${c.name} paycheck`.slice(0, 60), c.account_id, JSON.stringify(rule), c.amount);
  }
  markPaycheckHandled(c.key);
  res.json({ ok: true });
});

router.post('/bills', (req, res) => {
  const b = req.body, rule = cleanRule(b.rule), name = String(b.name ?? '').trim().slice(0, 60);
  if (!name || !rule || !(Number(b.amount) > 0)) return res.status(400).json({ error_message: 'Give it a name, an amount and a schedule.' });
  db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, account_id, rule, amount_mode, amount)
    VALUES (?, 1, ?, ?, ?, ?, 'fixed', ?)`).run(`man:${Date.now()}`, name, b.direction === 'in' ? 'in' : 'out', b.account_id || null, JSON.stringify(rule), Number(b.amount));
  res.json({ ok: true });
});
// Remove a bill you added, or reset a detected one to what was detected.
router.delete('/bills/:key', (req, res) => {
  db.prepare('DELETE FROM bill_settings WHERE key = ?').run(req.params.key);
  res.json({ ok: true });
});

// ---- Insights: what changed this month, frequent spending, and the watchlist.
router.get('/insights', (_req, res) => res.json({ changed: whatChanged(), frequent: frequentSpend(), groupChanges: groupChanges() }));
router.get('/watchlist', (_req, res) => res.json({ items: watchlist(), merchants: topMerchants(), categories: pickerGroups().flatMap((g) => g.subs) }));
router.post('/watchlist', (req, res) => {
  try { addWatch(req.body); res.json({ ok: true }); } catch (e) { res.status(400).json({ error_message: e.message }); }
});
router.delete('/watchlist/:id', (req, res) => { db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id); res.json({ ok: true }); });

router.get('/categories/all', (_req, res) => res.json(pickerGroups()));

// Change one transaction's category, or (all=1) every transaction with the same description via a rule.
router.patch('/transactions/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  const category = req.body.category;
  if (!t) return res.status(404).json({ error_message: 'Unknown transaction.' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error_message: 'Unknown category.' });
  // person=1: a rule for every payment with this person (Venmo/Zelle), e.g. all of Sam Lee's → Fitness.
  const peer = req.body.person ? peerOf(t, db.prepare('SELECT i.institution FROM accounts a JOIN items i ON i.id = a.item_id WHERE a.id = ?').get(t.account_id)?.institution) : null;
  const pattern = peer ? peer.pattern : req.body.all ? t.name : null;
  if (pattern) {
    db.prepare('DELETE FROM category_rules WHERE pattern = ?').run(pattern);
    db.prepare('INSERT INTO category_rules (pattern, category) VALUES (?, ?)').run(pattern, category);
    db.prepare('UPDATE transactions SET user_category = NULL WHERE instr(lower(name), lower(?)) > 0').run(pattern);
  } else db.prepare('UPDATE transactions SET user_category = ?, reimburses = NULL WHERE id = ?').run(category, t.id);
  classify(); assignTrips();
  res.json({ ok: true });
});

// ---- Payments with people that still need a category (no keyword in the note, no rule, not chosen by you).
// Money a friend sent you also gets the likely charges it paid back: your spending in the 30 days before it,
// best first when the charge splits evenly (e.g. $16.33 × 6 = $97.98) or shares a word with the note.
router.get('/review/people', (_req, res) => {
  const rows = db.prepare(`SELECT t.id, t.date, t.name, t.amount, t.counterparty, i.institution, ${ACCT} account FROM transactions t
    JOIN accounts a ON a.id = t.account_id LEFT JOIN items i ON i.id = a.item_id
    WHERE t.cat_source = 'person' AND t.date >= ? ORDER BY t.date DESC`).all(reviewSince());
  const charges = db.prepare(`SELECT t.id, t.date, COALESCE(t.merchant, t.name) name, t.amount, t.category FROM transactions t
    WHERE t.amount > 0 AND t.date >= date(?, '-30 days') AND t.date <= date(?, '+3 days') AND ${SPEND_SQL}
      AND COALESCE(t.cat_source, '') NOT IN ('person', 'note') ORDER BY t.date DESC`);
  const words = (s) => new Set((s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  const items = rows.map((r) => {
    const peer = peerOf(r, r.institution);
    let candidates = [];
    if (r.amount < 0) {
      const back = -r.amount, nw = words(peer?.note);
      candidates = charges.all(r.date, r.date).filter((c) => c.amount >= back * 1.2).map((c) => {
        const k = Math.round(c.amount / back), even = k >= 2 && k <= 12 && Math.abs(c.amount / back - k) < 0.03;
        const shared = [...words(c.name)].some((w) => nw.has(w));
        return { ...c, split: even ? k : null, likely: shared || even, score: (shared ? 4 : 0) + (even ? 2 : 0) - Math.abs(Date.parse(r.date) - Date.parse(c.date)) / 864e5 / 30 };
      }).sort((a, b) => b.score - a.score).slice(0, 4);
    }
    return { id: r.id, date: r.date, amount: r.amount, account: r.account, person: peer?.person ?? r.name, note: peer?.note ?? '', candidates };
  });
  res.json({ count: items.length, items: items.slice(0, 12) });
});

// Mark money from a friend as paying you back for one of your charges (charge: null to undo).
router.post('/transactions/:id/paidback', (req, res) => {
  const t = db.prepare('SELECT id FROM transactions WHERE id = ? AND amount < 0').get(req.params.id);
  if (!t) return res.status(404).json({ error_message: 'Unknown transaction.' });
  const charge = req.body.charge ? db.prepare('SELECT id FROM transactions WHERE id = ? AND amount > 0').get(req.body.charge) : null;
  if (req.body.charge && !charge) return res.status(400).json({ error_message: 'Unknown charge.' });
  db.prepare('UPDATE transactions SET reimburses = ?, user_category = NULL WHERE id = ?').run(charge?.id ?? null, t.id);
  classify(); assignTrips();
  res.json({ ok: true });
});

router.get('/rules', (_req, res) => res.json(db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM transactions t
  WHERE instr(lower(t.name), lower(r.pattern)) > 0) matches FROM category_rules r ORDER BY r.id DESC`).all()));
// Change what a rule files transactions as.
router.patch('/rules/:id', (req, res) => {
  if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ error_message: 'Unknown category.' });
  db.prepare('UPDATE category_rules SET category = ? WHERE id = ?').run(req.body.category, req.params.id);
  classify(); assignTrips();
  res.json({ ok: true });
});
router.delete('/rules/:id', (req, res) => {
  db.prepare('DELETE FROM category_rules WHERE id = ?').run(req.params.id);
  classify(); assignTrips();
  res.json({ ok: true });
});

// Money that arrived from somewhere not connected to WealthFlow (no matching transfer found).
// Could be a paycheck or your own money moving in, so the user decides. Money coming out of a fund
// (money-market sweeps, ETF sales) is always your own, so it's skipped.
// Unmatched transfers to or from accounts that aren't connected. Only the user knows what they are:
// money in could be pay; money out could be a savings or investment contribution. Each group includes its
// individual transactions so the user can judge (regular and similar-sized looks like pay).
const REVIEW_BASE = `t.category = 'Transfer' AND t.transfer_pair IS NULL AND t.transfer_account IS NULL AND t.date >= @since
    AND t.user_category IS NULL AND a.type = 'depository'
    AND COALESCE(t.pfc_detailed, '') NOT IN ('TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS')
    AND NOT EXISTS (SELECT 1 FROM category_rules r WHERE instr(lower(t.name), lower(r.pattern)) > 0)`;
const REVIEW = {
  in: `${REVIEW_BASE} AND t.amount < 0 AND t.pfc_primary = 'TRANSFER_IN'`,
  out: `${REVIEW_BASE} AND t.amount > 0 AND t.pfc_primary = 'TRANSFER_OUT'`,
};
// The unmatched-transfer groups ("Where did this go?"), each with its transactions.
function reviewGroups() {
  const out = {}, since = reviewSince();
  for (const [dir, where] of Object.entries(REVIEW)) {
    const groups = db.prepare(`SELECT t.name, COUNT(*) n, ABS(SUM(t.amount)) total, MAX(t.date) last, MIN(t.id) id,
        GROUP_CONCAT(DISTINCT i.institution) institutions, GROUP_CONCAT(DISTINCT ${ACCT}) accounts
      FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN items i ON i.id = a.item_id WHERE ${where}
      GROUP BY t.name HAVING total >= 100 ORDER BY total DESC LIMIT 8`).all({ since });
    const items = db.prepare(`SELECT t.id, t.date, ABS(t.amount) amount, t.pending, ${ACCT} account FROM transactions t
      JOIN accounts a ON a.id = t.account_id WHERE ${where} AND t.name = @name ORDER BY t.date DESC LIMIT 24`);
    out[dir] = groups.map((g) => ({ ...g, items: items.all({ since, name: g.name }) }));
  }
  return out;
}
router.get('/review', (_req, res) => res.json(reviewGroups()));

// Getting started: a short checklist on the dashboard for a new setup. Each step is worked out from the data
// (nothing to tick by hand except "home looks right"); it disappears when everything is done or you dismiss it.
const flag = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value === '1';
router.get('/setup', (_req, res) => {
  const n = (sql, ...a) => db.prepare(sql).get(...a).n;
  const r = reviewGroups(), since = reviewSince();
  const toSort = r.in.length + r.out.length + n("SELECT COUNT(*) n FROM transactions WHERE cat_source = 'person' AND date >= ?", since);
  const banks = n('SELECT COUNT(*) n FROM items');
  const income = bills().some((b) => b.direction === 'in' && !b.hidden && !b.ended && ['Salary', 'Income'].includes(b.category));
  const steps = [
    { key: 'banks', label: 'Connect your banks', done: banks > 0, detail: banks ? `${banks} connected` : 'Checking, cards, and any brokerage or retirement accounts', href: '#/settings' },
    { key: 'sort', label: 'Sort what WealthFlow couldn\'t', done: banks > 0 && toSort === 0, detail: toSort ? `${toSort} waiting` : 'Unmatched transfers and payments with people', href: '#/transactions' },
    { key: 'paycheck', label: 'Tell it about your paycheck', done: income && paycheckCandidates().length === 0, detail: 'So Upcoming and Free to spend know payday', href: '#/bills' },
    { key: 'budget', label: 'Set up a budget', done: n('SELECT (SELECT COUNT(*) FROM budgets) + (SELECT COUNT(*) FROM budget_groups WHERE amount IS NOT NULL) n') > 0, detail: 'Suggestions are filled in from your bills and spending', href: '#/budget' },
    { key: 'home', label: 'Check where home is', done: flag('setup_home_ok') || n('SELECT COUNT(*) n FROM home_bases') > 0, detail: 'Used to spot trips', href: '#/trips', confirm: 'Looks right' },
    { key: 'goal', label: 'Add a goal', done: n('SELECT COUNT(*) n FROM goals') > 0, detail: 'An emergency fund, a trip, a down payment', href: '#/goals', optional: true },
  ];
  res.json({ dismissed: flag('setup_dismissed'), steps });
});
router.post('/setup/:action', (req, res) => {
  const key = { dismiss: 'setup_dismissed', 'home-ok': 'setup_home_ok' }[req.params.action];
  if (!key) return res.status(404).json({ error_message: 'Unknown action.' });
  db.prepare("INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT (key) DO UPDATE SET value = '1'").run(key);
  res.json({ ok: true });
});

// Everything waiting for a decision, for the dashboard: unmatched transfers, payments with people to sort, trips to
// confirm and paychecks without a schedule. Only transactions in the review window count (reviewSince).
router.get('/todo', (_req, res) => {
  const r = reviewGroups();
  const people = db.prepare("SELECT COUNT(*) n FROM transactions WHERE cat_source = 'person' AND date >= ?").get(reviewSince()).n;
  const trips = db.prepare("SELECT COUNT(*) n FROM trips WHERE status = 'suggested'").get().n;
  const paychecks = paycheckCandidates().length;
  const n = (k, one, many) => (k === 1 ? one : many.replace('#', k));
  res.json([
    { key: 'transfers', count: r.in.length + r.out.length, label: n(r.in.length + r.out.length, '1 transfer needs a decision', '# transfers need a decision'), href: '#/transactions' },
    { key: 'people', count: people, label: n(people, '1 payment with a person to sort', '# payments with people to sort'), href: '#/transactions' },
    { key: 'trips', count: trips, label: n(trips, '1 trip to confirm', '# trips to confirm'), href: '#/trips' },
    { key: 'paychecks', count: paychecks, label: 'How often are you paid?', href: '#/bills' },
  ].filter((x) => x.count > 0));
});

// Accounts whose transaction history starts after `from`, so a period starting then is missing some of
// their activity. (Accounts with no transactions at all, like most retirement accounts, aren't listed.)
const gaps = (from) => db.prepare(`SELECT ${ACCT} account, MIN(t.date) first FROM transactions t
  JOIN accounts a ON a.id = t.account_id GROUP BY a.id HAVING first > ? ORDER BY first`).all(from);

// days=N for the last N days including today, month=YYYY-MM, or months=N for the last N finished months.
// view=accounts for the through-accounts graph.
router.get('/flow', (req, res) => {
  const m = /^\d{4}-\d{2}$/.test(req.query.month ?? '') ? req.query.month : null;
  const d = new Date();
  const day = (y, mo, dd = 1) => new Date(y, mo, dd).toLocaleDateString('en-CA');
  let from, to;
  if (m) { const [y, mo] = m.split('-').map(Number); from = day(y, mo - 1); to = day(y, mo); }
  else if (req.query.days) {
    const n = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    from = day(d.getFullYear(), d.getMonth(), d.getDate() - n + 1); to = day(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } else {
    const n = Math.min(12, Math.max(1, Number(req.query.months) || 3));
    from = day(d.getFullYear(), d.getMonth() - n); to = day(d.getFullYear(), d.getMonth());
  }
  const fn = req.query.view === 'accounts' ? accountFlow : flow;
  res.json({ ...fn(from, to), gaps: gaps(from) });
});

// Rename an income source everywhere (key = Plaid merchant or description). Empty label restores the default.
router.put('/income-names', (req, res) => {
  const key = String(req.body.key ?? ''), label = String(req.body.label ?? '').trim().slice(0, 60);
  if (!key) return res.status(400).json({ error_message: 'Missing source.' });
  if (label) db.prepare('INSERT INTO income_names (key, label) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET label = excluded.label').run(key, label);
  else db.prepare('DELETE FROM income_names WHERE key = ?').run(key);
  res.json({ ok: true });
});

router.post('/sync', async (_req, res) => res.json(await syncAll()));

router.get('/holdings', (_req, res) => res.json(db.prepare(`SELECT h.*, ${ACCT} AS account, a.subtype AS account_subtype,
  a.type AS account_type, i.institution FROM holdings h JOIN accounts a ON a.id = h.account_id
  LEFT JOIN items i ON i.id = a.item_id ORDER BY h.value DESC`).all().map((h) => ({ ...h, kind: holdingKind(h) }))));

router.get('/summary', (_req, res) => res.json(summary()));
router.get('/cashflow', (_req, res) => res.json(cashFlow()));
router.get('/categories', (_req, res) => res.json(topCategories()));

router.get('/allocation', (_req, res) => res.json(allocation()));
router.get('/upcoming', (_req, res) => res.json(upcoming()));

export default router;
