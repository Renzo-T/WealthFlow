// Contributions taken from your pay: money that goes from a paycheck straight into a 401(k), 403(b), HSA or similar,
// before the rest is deposited. It never appears in a bank account, so without this it would count as a market gain on
// Net worth and be missing from what you saved. Plaid Investments reports it in the account itself as type "cash",
// subtype "contribution" (negative = money in). Other cash coming in is left out on purpose: "deposit" is also used for
// realized gains and fund exchanges, and "transfer" moves money between your own accounts.
import db from './db.js';

// Plaid allows up to 24 months of investment activity; after the first download only the recent past is fetched again.
export const FIRST_MONTHS = 24, AGAIN_DAYS = 90;
const iso = (d) => d.toLocaleDateString('en-CA');
const daysBefore = (date, n) => { const d = new Date(`${date}T00:00`); d.setDate(d.getDate() - n); return iso(d); };
const monthsBefore = (date, n) => { const d = new Date(`${date}T00:00`); d.setMonth(d.getMonth() - n); return iso(d); };

// Where to start fetching for these accounts: everything Plaid has the first time, the last 90 days after that.
export function fetchStart(accountIds, today = iso(new Date())) {
  if (!accountIds.length) return null;
  const seen = db.prepare(`SELECT 1 FROM investment_transactions WHERE account_id IN (${accountIds.map(() => '?').join(',')}) LIMIT 1`).get(...accountIds);
  return seen ? daysBefore(today, AGAIN_DAYS) : monthsBefore(today, FIRST_MONTHS);
}

// Replace what's stored for these accounts from `start` on with Plaid's list (investment_transactions[] rows), so
// anything the provider corrected or removed in that window goes too.
export function saveInvestmentTransactions(accountIds, start, list) {
  const del = db.prepare('DELETE FROM investment_transactions WHERE account_id = ? AND date >= ?');
  const ins = db.prepare(`INSERT OR REPLACE INTO investment_transactions (id, account_id, date, type, subtype, amount, name, security_id, quantity, price, fees)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    for (const id of accountIds) del.run(id, start);
    for (const t of list) if (accountIds.includes(t.account_id))
      ins.run(t.investment_transaction_id, t.account_id, t.date, t.type ?? null, t.subtype ?? null, t.amount ?? 0, t.name ?? null,
        t.security_id ?? null, t.quantity ?? null, t.price ?? null, t.fees ?? null);
  })();
}

// Contributions from your pay between `after` (exclusive) and `through` (inclusive). One that matches money seen
// leaving a bank account (or arriving in the account's own transactions) within 5 days is a transfer you made, which
// the rest of the app already counts, so it's left out here. `networth` keeps only accounts counted in net worth.
export function payContributions(after, through, { networth = false } = {}) {
  return db.prepare(`SELECT it.id, it.account_id, COALESCE(a.nickname, a.name) account, it.date, -it.amount amount
    FROM investment_transactions it JOIN accounts a ON a.id = it.account_id ${networth ? 'AND a.in_networth = 1' : ''}
    WHERE it.type = 'cash' AND it.subtype = 'contribution' AND it.amount < 0 AND it.date > ? AND it.date <= ?
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.split_of IS NULL AND ABS(julianday(t.date) - julianday(it.date)) <= 5
        AND ((t.account_id = it.account_id AND ABS(t.amount - it.amount) < 0.01)
          OR (t.transfer_account = it.account_id AND ABS(t.amount + it.amount) < 0.01)))
    ORDER BY it.date, it.id`).all(after, through);
}

// The same over [from, to), the way the money flow charts count a period.
export const payContributionsIn = (from, to) => payContributions(daysBefore(from, 1), daysBefore(to, 1));

// The earliest day investment activity is known for, across accounts with any (null when there's none).
export const activitySince = () => db.prepare('SELECT MIN(date) d FROM investment_transactions').get().d;

// For the Investments page: this year and the last 12 months, per account, with each account's latest contribution.
export function contributionSummary(today = iso(new Date())) {
  const yearStart = `${today.slice(0, 4)}-01-01`, yearAgo = monthsBefore(today, 12);
  const list = payContributions(yearAgo, today);
  const accounts = new Map();
  for (const c of list) {
    const a = accounts.get(c.account_id) ?? { id: c.account_id, name: c.account, year: 0, last12: 0, count: 0, last: null };
    a.last12 += c.amount; a.count += 1; a.last = { date: c.date, amount: c.amount };
    if (c.date >= yearStart) a.year += c.amount;
    accounts.set(c.account_id, a);
  }
  const rows = [...accounts.values()].sort((a, b) => b.last12 - a.last12);
  return {
    since: activitySince(), yearStart,
    year: rows.reduce((s, a) => s + a.year, 0), last12: rows.reduce((s, a) => s + a.last12, 0), accounts: rows,
  };
}
