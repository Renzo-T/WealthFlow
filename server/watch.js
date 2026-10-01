import db from './db.js';
import { SPEND_SQL, CATEGORIES, NOT_SPENDING } from './categories.js';
import { bills, seriesKey } from './recurring.js';

// Insights that compare this month with last month, and the spending watchlist.
//
// Fair comparisons: "this month so far" is compared with the same days of last month, and only across accounts
// whose history covers both periods (a bank connected last week would otherwise look like brand-new spending).
// Nothing is compared before the 5th, and small bases never produce a percentage.

export const MIN_DAY = 5;
const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (s) => new Date(`${s}T00:00Z`);

export function periods(today) {
  const t = utc(today), y = t.getUTCFullYear(), m = t.getUTCMonth(), day = t.getUTCDate();
  const prevLen = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    day, early: day < MIN_DAY,
    cur: { from: iso(new Date(Date.UTC(y, m, 1))), to: today },
    prev: { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m - 1, Math.min(day, prevLen)))) },
    monthLen: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
  };
}

// Accounts whose bank's history reaches back to `date` (the last compared day of last month). Judged per bank,
// not per account: a quiet card with no purchases early in the month still has its bank's history.
const covered = (date) => db.prepare(`SELECT a.id FROM accounts a WHERE a.item_id IN (
    SELECT a2.item_id FROM transactions t JOIN accounts a2 ON a2.id = t.account_id GROUP BY a2.item_id HAVING MIN(t.date) <= ?)`)
  .all(date).map((r) => r.id);
const inList = (ids) => (ids.length ? `account_id IN (${ids.map(() => '?').join(',')})` : '0');

// Spending rows in a period, optionally without recurring bills: bills land on slightly different days each
// month, so in a same-days comparison they'd show up as sudden "new" spending (rent paid on the 31st last month).
function spendRows(range, ids, { noBills = false, today } = {}) {
  const rows = db.prepare(`SELECT t.*, p.account_id pair_account FROM transactions t LEFT JOIN transactions p ON p.id = t.transfer_pair
    WHERE t.date >= ? AND t.date <= ? AND COALESCE(t.grp, 'Misc') NOT IN (${NOT_SPENDING.map((g) => `'${g}'`).join(',')})
      AND ${ids.length ? `t.account_id IN (${ids.map(() => '?').join(',')})` : '0'}
      AND (t.trip_id IS NULL OR t.trip_id NOT IN (SELECT id FROM trips WHERE status = 'confirmed'))`).all(range.from, range.to, ...ids); // trips aren't everyday spending
  if (!noBills) return rows;
  const keys = new Set(bills(today).filter((b) => !b.hidden && !b.ended && b.source !== 'manual').map((b) => b.key));
  return rows.filter((t) => !keys.has(seriesKey(t)));
}
const sumBy = (rows, field) => rows.reduce((m, t) => ({ ...m, [t[field]]: (m[t[field]] ?? 0) + t.amount }), {});
function spendBy(field, range, ids, opts) { return sumBy(spendRows(range, ids, opts), field); }

// "You spent $697 more this month, mostly Shopping (+$293) and Groceries (+$148)."
export function whatChanged(today = new Date().toLocaleDateString('en-CA')) {
  const p = periods(today);
  if (p.early) {
    // No comparison yet; summarise last month's everyday spending instead.
    const lastFull = { from: p.prev.from, to: iso(new Date(Date.UTC(+p.prev.from.slice(0, 4), +p.prev.from.slice(5, 7), 0))) };
    const by = spendBy('category', lastFull, covered(lastFull.to), { noBills: true, today });
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, total]) => ({ category, total }));
    return { ready: false, reason: 'early', day: p.day, last: { month: p.prev.from.slice(0, 7), total: Object.values(by).reduce((s, v) => s + v, 0), top } };
  }
  const ids = covered(p.prev.to);
  const opts = { noBills: true, today };
  const cur = spendBy('category', p.cur, ids, opts), prev = spendBy('category', p.prev, ids, opts);
  const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
  const curT = sum(cur), prevT = sum(prev), diff = curT - prevT;
  if (prevT < 100 || Math.abs(diff) < 50) return { ready: true, flat: true, cur: curT, prev: prevT, diff };
  const changes = [...new Set([...Object.keys(cur), ...Object.keys(prev)])]
    .map((c) => ({ category: c, diff: (cur[c] ?? 0) - (prev[c] ?? 0), cur: cur[c] ?? 0, prev: prev[c] ?? 0 }))
    .filter((c) => Math.sign(c.diff) === Math.sign(diff) && Math.abs(c.diff) >= 20)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
  return { ready: true, cur: curT, prev: prevT, diff, pct: (diff / prevT) * 100, drivers: changes, days: p.day, accounts: ids.length };
}

// Change per budget group for the Top spending panel (same days, covered accounts, ≥ $25 base for a %).
export function groupChanges(today = new Date().toLocaleDateString('en-CA')) {
  const p = periods(today);
  if (p.early) return {};
  const ids = covered(p.prev.to);
  const cur = spendBy('grp', p.cur, ids), prev = spendBy('grp', p.prev, ids);
  return Object.fromEntries(Object.keys({ ...cur, ...prev }).map((g) => [g,
    (prev[g] ?? 0) >= 25 ? (((cur[g] ?? 0) - prev[g]) / prev[g]) * 100 : null]));
}

// "You've shopped at H-E-B 5 times this month vs 1 last month, $35.92 on average."
export function frequentSpend(today = new Date().toLocaleDateString('en-CA'), limit = 3) {
  const p = periods(today);
  if (p.early) return lastMonthRegulars(p, today, limit);
  const ids = covered(p.prev.to);
  // Visits = distinct days with a purchase there (a split charge isn't two visits). Bills (autoships) excluded.
  const visits = (range) => {
    const by = {};
    for (const t of spendRows(range, ids, { noBills: true, today })) {
      if (!t.merchant || t.amount <= 0) continue;
      const v = (by[t.merchant] ??= { k: t.merchant, days: new Set(), total: 0 });
      v.days.add(t.date); v.total += t.amount;
    }
    return Object.values(by).map((v) => ({ k: v.k, n: v.days.size, total: v.total }));
  };
  const prev = Object.fromEntries(visits(p.prev).map((r) => [r.k, r.n]));
  return visits(p.cur).filter((r) => r.n >= 3 && r.n > (prev[r.k] ?? 0))
    .map((r) => ({ merchant: r.k, count: r.n, prevCount: prev[r.k] ?? 0, total: r.total, avg: r.total / r.n }))
    .sort((a, b) => (b.count - b.prevCount) - (a.count - a.prevCount) || b.total - a.total).slice(0, limit);
}

// Before the 5th: where you went most often last month (3+ visits), no comparison. Marked `lastMonth`.
function lastMonthRegulars(p, today, limit) {
  const to = iso(new Date(Date.UTC(+p.prev.from.slice(0, 4), +p.prev.from.slice(5, 7), 0)));
  const by = {};
  for (const t of spendRows({ from: p.prev.from, to }, covered(to), { noBills: true, today })) {
    if (!t.merchant || t.amount <= 0) continue;
    const v = (by[t.merchant] ??= { merchant: t.merchant, days: new Set(), total: 0 });
    v.days.add(t.date); v.total += t.amount;
  }
  return Object.values(by).filter((v) => v.days.size >= 3)
    .map((v) => ({ merchant: v.merchant, count: v.days.size, prevCount: null, total: v.total, avg: v.total / v.days.size, lastMonth: true }))
    .sort((a, b) => b.count - a.count || b.total - a.total).slice(0, limit);
}

// ---------- Watchlist: categories or merchants you want to keep an eye on ----------
db.exec(`CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, value TEXT NOT NULL,
  target REAL, UNIQUE (kind, value))`);

const match = (w) => (w.kind === 'category' ? ['category = ?', [w.value]] : ['(merchant = ? COLLATE NOCASE)', [w.value]]);

export function watchStats(w, today = new Date().toLocaleDateString('en-CA')) {
  const p = periods(today);
  const [where, args] = match(w);
  const spent = (from, to) => db.prepare(`SELECT COALESCE(SUM(amount), 0) v FROM transactions
    WHERE date >= ? AND date <= ? AND ${SPEND_SQL} AND ${where}`).get(from, to, ...args).v;
  // Monthly average over up to 6 finished months, counting from the month this item first appears.
  const first = db.prepare(`SELECT MIN(date) d FROM transactions WHERE ${SPEND_SQL} AND ${where}`).get(...args).d;
  const months = [], history = [];
  for (let k = 1; k <= 6; k++) {
    const s = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - k, 1));
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
    if (!first || iso(e) < first) break;
    months.push(spent(iso(s), iso(e)));
    history.push({ month: iso(s).slice(0, 7), total: months.at(-1) });
  }
  const soFar = spent(p.cur.from, today);
  const progress = p.day / p.monthLen;
  return {
    ...w, soFar,
    avg: months.length ? months.reduce((a, b) => a + b, 0) / months.length : null, avgMonths: months.length, history,
    ytd: spent(`${today.slice(0, 4)}-01-01`, today),
    // A straight-line projection is meaningless in the first days of a month.
    projected: p.early ? null : soFar / progress,
  };
}

export const watchlist = (today) => db.prepare('SELECT * FROM watchlist ORDER BY id').all().map((w) => watchStats(w, today));

export function addWatch({ kind, value, target }) {
  if (!['category', 'merchant'].includes(kind) || !value) throw new Error('Pick a category or a merchant.');
  if (kind === 'category' && !CATEGORIES.includes(value)) throw new Error('Unknown category.');
  const t = Number(target) > 0 ? Number(target) : null;
  db.prepare('INSERT INTO watchlist (kind, value, target) VALUES (?, ?, ?) ON CONFLICT (kind, value) DO UPDATE SET target = excluded.target').run(kind, String(value).slice(0, 80), t);
}

// Merchants worth offering in the picker: the shops you visit most (distinct days, last 90 days). Bill payees like
// your landlord or utility are left out: they're on the Bills page, not something to "keep an eye on".
export function topMerchants(today = new Date().toLocaleDateString('en-CA')) {
  const billKeys = new Set(bills(today).filter((b) => !b.hidden && !b.ended).map((b) => b.key));
  return db.prepare(`SELECT merchant, SUM(amount) total, COUNT(DISTINCT date) n FROM transactions
    WHERE merchant IS NOT NULL AND amount > 0 AND date >= date(?, '-90 days') AND ${SPEND_SQL} AND grp NOT IN ('Housing', 'Utilities', 'Insurance')
    GROUP BY merchant ORDER BY n DESC, total DESC LIMIT 40`).all(today)
    .filter((m) => !billKeys.has(`${m.merchant.toLowerCase()}|out`)).slice(0, 25);
}

export const _test = { covered, DAY };
