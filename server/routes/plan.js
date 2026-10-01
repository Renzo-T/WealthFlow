import { Router } from 'express';
import db from '../db.js';
import { iso, accountHistory } from '../summary.js';
import { CATEGORIES, GROUPS, groupOf } from '../categories.js';
import { budgetMonth, budgetGroups } from '../budget.js';
import { ACCT, cashFlow } from '../insights.js';

const router = Router();
const num = (v) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= 0 ? n : null; };
const bad = (res, msg) => res.status(400).json({ error_message: msg });

// Dashboard panel: budgeted groups with this month's spending.
router.get('/budgets', (_req, res) => {
  const b = budgetMonth(iso(new Date()).slice(0, 7));
  const todo = b.expenses.flatMap((g) => (g.whole ? (g.groupBudget == null && g.groupSuggested ? [{ suggested: g.groupSuggested }] : [])
    : g.categories.filter((c) => c.budget == null && c.suggested)));
  res.json({ items: budgetGroups(), suggestions: { count: todo.length, total: todo.reduce((s, c) => s + c.suggested, 0) } });
});

// The budget page for one month (YYYY-MM): budget, actual and remaining per category, grouped.
router.get('/budget', (req, res) => {
  const m = /^\d{4}-\d{2}$/.test(req.query.month ?? '') ? req.query.month : iso(new Date()).slice(0, 7);
  res.json(budgetMonth(m));
});

const MONTH = /^\d{4}-\d{2}$/;
const setOverride = (month, item, value) => {
  const amount = value === '' || value == null ? null : num(value);
  if (amount == null) db.prepare('DELETE FROM budget_overrides WHERE month = ? AND item = ?').run(month, item);
  else db.prepare('INSERT INTO budget_overrides (month, item, amount) VALUES (?, ?, ?) ON CONFLICT(month, item) DO UPDATE SET amount = excluded.amount').run(month, item, amount);
  return { ok: true, month, amount };
};

// Count money spent on confirmed trips in budget categories (on: true, the default), or leave it out.
router.put('/settings/budget-trips', (req, res) => {
  db.prepare("INSERT INTO meta (key, value) VALUES ('budget_trips', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(req.body.on ? '1' : '0');
  res.json({ ok: true });
});

// Roll over a category's unspent money into the next month (on: true), starting this month; or stop.
router.put('/budget-rollover/:category', (req, res) => {
  if (!CATEGORIES.includes(req.params.category)) return bad(res, 'Unknown category.');
  if (req.body.on) db.prepare('INSERT OR IGNORE INTO budget_rollover (category, since) VALUES (?, ?)').run(req.params.category, MONTH.test(req.body.since ?? '') ? req.body.since : iso(new Date()).slice(0, 7));
  else db.prepare('DELETE FROM budget_rollover WHERE category = ?').run(req.params.category);
  res.json({ ok: true });
});

// Set a category's monthly budget (applies to every month). 0 or empty removes it.
router.put('/budgets/:category', (req, res) => {
  if (!CATEGORIES.includes(req.params.category)) return bad(res, 'Unknown category.');
  if (db.prepare('SELECT 1 FROM budget_groups WHERE grp = ?').get(groupOf(req.params.category)))
    return bad(res, `${groupOf(req.params.category)} is budgeted as one amount.`);
  // month=YYYY-MM: only that month (0 means nothing budgeted that month; empty goes back to the usual amount).
  if (MONTH.test(req.body.month ?? '')) return res.json(setOverride(req.body.month, req.params.category, req.body.amount));
  const amount = num(req.body.amount);
  if (!amount) { db.prepare('DELETE FROM budgets WHERE category = ?').run(req.params.category); return res.json({ ok: true, removed: true }); }
  db.prepare('INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET amount = excluded.amount')
    .run(req.params.category, amount);
  res.json({ ok: true });
});

// Clear budgets: the listed categories and groups (a card's), or everything when neither is listed. Budgets apply
// to every month, so this clears them everywhere; groups stay budgeted as one amount, just empty; suggestions remain.
router.post('/budgets/clear', (req, res) => {
  const cats = Array.isArray(req.body.categories) ? req.body.categories.filter((c) => CATEGORIES.includes(c)) : null;
  const groups = Array.isArray(req.body.groups) ? req.body.groups.filter((g) => GROUPS[g]) : null;
  const ph = (l) => l.map(() => '?').join(',') || "''";
  let removed = 0;
  db.transaction(() => {
    if (!cats && !groups) {
      removed = db.prepare('DELETE FROM budgets').run().changes + db.prepare('UPDATE budget_groups SET amount = NULL WHERE amount IS NOT NULL').run().changes;
      db.prepare('DELETE FROM budget_overrides').run();
      return;
    }
    if (cats) {
      removed += db.prepare(`DELETE FROM budgets WHERE category IN (${ph(cats)})`).run(...cats).changes;
      db.prepare(`DELETE FROM budget_overrides WHERE item IN (${ph(cats)})`).run(...cats);
    }
    if (groups) {
      removed += db.prepare(`UPDATE budget_groups SET amount = NULL WHERE amount IS NOT NULL AND grp IN (${ph(groups)})`).run(...groups).changes;
      db.prepare(`DELETE FROM budget_overrides WHERE item IN (${ph(groups.map((g) => `group:${g}`))})`).run(...groups.map((g) => `group:${g}`));
    }
  })();
  res.json({ ok: true, removed });
});

// Budget a group as one amount (whole: true), or per category again (whole: false); or set its amount.
// Switching on adds up the categories' budgets (or their suggestions); switching off splits the amount back by
// each category's recent spending or bills, in $5 steps.
router.put('/budget-groups/:group', (req, res) => {
  const g = req.params.group;
  if (!GROUPS[g] || g === 'Transfer') return bad(res, 'Unknown group.');
  const cats = GROUPS[g];
  const ph = cats.map(() => '?').join(',');
  const row = db.prepare('SELECT amount FROM budget_groups WHERE grp = ?').get(g);
  const month = budgetMonth(iso(new Date()).slice(0, 7)).expenses.concat(budgetMonth(iso(new Date()).slice(0, 7)).income).find((x) => x.group === g);
  if (req.body.whole === false) {
    db.transaction(() => {
      db.prepare('DELETE FROM budget_groups WHERE grp = ?').run(g);
      const weights = month.categories.map((c) => ({ c: c.category, w: Math.max(0, c.suggested ?? 0) })).filter((x) => x.w > 0);
      const total = weights.reduce((s, x) => s + x.w, 0);
      if (row?.amount && total) {
        let left = row.amount;
        const parts = weights.map((x) => ({ ...x, a: Math.round((row.amount * x.w) / total / 5) * 5 }));
        for (const p of parts) left -= p.a;
        parts.sort((a, b) => b.w - a.w)[0].a += left; // rounding remainder to the biggest
        for (const p of parts.filter((p) => p.a > 0)) db.prepare('INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET amount = excluded.amount').run(p.c, p.a);
      }
    })();
    return res.json({ ok: true });
  }
  if (MONTH.test(req.body.month ?? '') && row) return res.json(setOverride(req.body.month, `group:${g}`, req.body.amount));
  const own = db.prepare(`SELECT SUM(amount) s FROM budgets WHERE category IN (${ph})`).get(...cats).s;
  const amount = 'amount' in req.body ? num(req.body.amount) || null : row ? row.amount : own || null;
  db.transaction(() => {
    db.prepare('INSERT INTO budget_groups (grp, amount) VALUES (?, ?) ON CONFLICT(grp) DO UPDATE SET amount = excluded.amount').run(g, amount);
    db.prepare(`DELETE FROM budgets WHERE category IN (${ph})`).run(...cats);
  })();
  res.json({ ok: true, amount });
});

router.delete('/budgets/:category', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE category = ?').run(req.params.category);
  res.json({ ok: true });
});

// A goal linked to an account tracks that account's balance; otherwise it uses the saved amount you enter.
// Goals with progress. A goal linked to an account follows its balance, and also gets that account's recent
// pace (average change per month over the last 90 days) and a small history for a sparkline.
router.get('/goals', (_req, res) => {
  const goals = db.prepare(`SELECT g.id, g.name, g.target, g.target_date, g.account_id, ${ACCT} AS account, a.balance,
    COALESCE(a.balance, g.saved) AS saved FROM goals g LEFT JOIN accounts a ON a.id = g.account_id ORDER BY g.id`).all();
  const ids = goals.filter((g) => g.account_id && g.balance != null).map((g) => g.account_id);
  const hist = ids.length ? accountHistory(db.prepare(`SELECT * FROM accounts WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids), 180) : {};
  res.json(goals.map(({ balance, ...g }) => {
    const h = hist[g.account_id] ?? [];
    if (h.length < 31) return { ...g, pace: null, spark: [] };
    const from = h[Math.max(0, h.length - 91)], days = h.length - 1 - h.indexOf(from);
    return { ...g, pace: ((h.at(-1).balance - from.balance) / days) * 30.44, estimated: h.some((x) => x.est),
      spark: h.filter((_, i) => (h.length - 1 - i) % 7 === 0).map((x) => x.balance) };
  }));
});

// Starting points for new goals, from your own numbers: an emergency fund of 3 or 6 months of everyday spending,
// and a travel fund from what your trips cost over the last year.
router.get('/goals/ideas', (_req, res) => {
  const months = cashFlow(7).slice(0, -1).filter((m) => !m.partial && m.spending > 0);
  const use = months.length ? months : cashFlow(4).slice(0, -1).filter((m) => m.spending > 0);
  const spend = use.length ? use.reduce((s, m) => s + m.spending, 0) / use.length : null;
  const round = (v) => Math.round(v / 500) * 500;
  const trips = db.prepare(`SELECT COUNT(DISTINCT tr.id) n, COALESCE(SUM(t.amount), 0) total FROM trips tr JOIN transactions t ON t.trip_id = tr.id
    WHERE tr.status = 'confirmed' AND tr.start >= date('now', '-365 days')`).get();
  res.json({ monthlySpend: spend, months: use.length, emergency3: spend ? round(spend * 3) : null, emergency6: spend ? round(spend * 6) : null,
    trips: trips.n, travelYear: trips.total > 0 ? round(trips.total) || 500 : null });
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
router.post('/goals', (req, res) => {
  const name = String(req.body.name ?? '').trim(), target = num(req.body.target), saved = num(req.body.saved) ?? 0;
  if (!name || !target) return bad(res, 'Give the goal a name and a target above zero.');
  const date = DATE.test(req.body.target_date ?? '') ? req.body.target_date : null;
  const r = db.prepare('INSERT INTO goals (name, target, saved, account_id, target_date) VALUES (?,?,?,?,?)')
    .run(name.slice(0, 60), target, saved, req.body.account_id || null, date);
  res.json({ id: Number(r.lastInsertRowid) });
});

// Change any of: name, target, saved (goals not linked to an account), target_date ('' clears), account_id ('' unlinks).
router.patch('/goals/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error_message: 'Unknown goal.' });
  const b = req.body, next = { ...g };
  if ('name' in b) { next.name = String(b.name ?? '').trim().slice(0, 60); if (!next.name) return bad(res, 'Give the goal a name.'); }
  if ('target' in b) { next.target = num(b.target); if (!next.target) return bad(res, 'The target needs to be above zero.'); }
  // An empty amount (the field is hidden for a goal that follows an account) leaves it as it was.
  if ('saved' in b && b.saved !== '' && b.saved != null) { next.saved = num(b.saved); if (next.saved == null) return bad(res, 'Enter an amount of zero or more.'); }
  if ('target_date' in b) { next.target_date = b.target_date || null; if (next.target_date && !DATE.test(next.target_date)) return bad(res, 'Pick a date.'); }
  if ('account_id' in b) next.account_id = b.account_id || null;
  db.prepare('UPDATE goals SET name = ?, target = ?, saved = ?, target_date = ?, account_id = ? WHERE id = ?')
    .run(next.name, next.target, next.saved, next.target_date, next.account_id, g.id);
  res.json({ ok: true });
});

router.delete('/goals/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Things Plaid can't see: a house, a car, or a loan. Liabilities are subtracted from net worth.
const KINDS = ['real_estate', 'vehicle', 'other', 'liability'];
router.get('/assets', (_req, res) => res.json(db.prepare('SELECT * FROM manual_assets ORDER BY id').all()));
router.post('/assets', (req, res) => {
  const name = String(req.body.name ?? '').trim(), value = num(req.body.value);
  if (!name || !value) return bad(res, 'Give it a name and a value above zero.');
  db.prepare('INSERT INTO manual_assets (name, value, kind) VALUES (?,?,?)')
    .run(name, value, KINDS.includes(req.body.kind) ? req.body.kind : 'other');
  res.json({ ok: true });
});
router.delete('/assets/:id', (req, res) => {
  db.prepare('DELETE FROM manual_assets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
