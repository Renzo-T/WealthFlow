import db from './db.js';
import { NOT_SPENDING, SPEND_SQL, historyStart } from './categories.js';

export const iso = (d) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const liability = (a) => a.type === 'credit' || a.type === 'loan';
const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

// Daily balance per account, oldest first: { [accountId]: [{ date, balance, est }] }. Real snapshots where
// they exist; earlier days for bank and card accounts are estimated by rewinding transactions from the nearest later
// real value; other account types are held at that value (Plaid has no history for them).
export function accountHistory(accounts = db.prepare('SELECT * FROM accounts').all(), maxDays = 365) {
  const snaps = new Map(db.prepare('SELECT * FROM balance_snapshots').all().map((s) => [s.date + s.account_id, s.balance]));
  const byAcct = {};
  for (const t of db.prepare('SELECT account_id, date, SUM(amount) s FROM transactions WHERE split_of IS NULL GROUP BY account_id, date').all())
    (byAcct[t.account_id] ??= {})[t.date] = t.s;
  const first = db.prepare('SELECT MIN(date) d FROM transactions').get().d;
  const days = first ? Math.min(maxDays, Math.round((Date.now() - new Date(first + 'T00:00')) / 864e5)) : 0;
  // Walking back from today, estimates start from the nearest later real value (a daily snapshot, or today's balance),
  // so they join up with real history instead of jumping back to today's level.
  const anchor = Object.fromEntries(accounts.map((a) => [a.id, a.balance]));
  const after = Object.fromEntries(accounts.map((a) => [a.id, 0])); // sum of amounts dated after `date`, up to the anchor
  const out = Object.fromEntries(accounts.map((a) => [a.id, []]));
  for (let i = 0; i <= days; i++) {
    const date = iso(shift(-i));
    for (const a of accounts) {
      let bal = anchor[a.id], est = true;
      const snap = snaps.get(date + a.id);
      if (snap !== undefined) { bal = snap; est = false; anchor[a.id] = snap; after[a.id] = 0; }
      else if (a.type === 'depository') bal = anchor[a.id] + after[a.id];
      else if (a.type === 'credit') bal = anchor[a.id] - after[a.id];
      out[a.id].push({ date, balance: Math.round(bal * 100) / 100, est });
      after[a.id] += byAcct[a.id]?.[date] ?? 0;
    }
  }
  for (const id in out) out[id].reverse();
  return out;
}

export function netWorthHistory() {
  const accounts = db.prepare('SELECT * FROM accounts WHERE in_networth = 1').all();
  if (!accounts.length) return [];
  const hist = accountHistory(accounts);
  const manual = db.prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'liability' THEN -value ELSE value END), 0) v FROM manual_assets").get().v;
  return hist[accounts[0].id].map((d, i) => {
    let value = manual, real = false;
    for (const a of accounts) { const p = hist[a.id][i]; value += liability(a) ? -p.balance : p.balance; if (!p.est) real = true; }
    return { date: d.date, value: Math.round(value * 100) / 100, est: !real };
  });
}

// What moved your net worth over a period: what you saved (income − spending from transactions) and everything else,
// mostly investments' market moves (also interest, fees outside transactions, corrections). Only on dates where every
// account has a real daily value: before WealthFlow's first snapshots, investment values aren't known.
export function netWorthBreakdown(period = 'month', today = iso(new Date())) {
  const accounts = db.prepare('SELECT * FROM accounts WHERE in_networth = 1').all();
  if (!accounts.length) return { available: false };
  const hist = accountHistory(accounts, 400);
  const dates = hist[accounts[0].id].map((d) => d.date);
  const realOn = (i) => accounts.every((a) => !hist[a.id][i]?.est);
  const firstReal = dates.findIndex((_, i) => realOn(i));
  if (firstReal < 0 || firstReal === dates.length - 1) return { available: false, since: firstReal < 0 ? null : dates[firstReal] };
  const end = dates.length - 1;
  const monthStart = dates.findIndex((d) => d >= `${today.slice(0, 7)}-01`) - 1; // the day before the month began
  const want = { month: monthStart, '30d': end - 30, all: firstReal }[period] ?? monthStart;
  const start = Math.max(want, firstReal);
  const nw = (i) => accounts.reduce((s, a) => s + (liability(a) ? -1 : 1) * hist[a.id][i].balance, 0);
  const from = dates[start], to = dates[end];
  const flows = db.prepare(`SELECT COALESCE(SUM(CASE WHEN grp = 'Income' THEN -amount END), 0) income,
    COALESCE(SUM(CASE WHEN ${SPEND_SQL} THEN amount END), 0) spending FROM transactions WHERE date > ? AND date <= ?`).get(from, to);
  const change = nw(end) - nw(start), saved = flows.income - flows.spending;
  const investments = accounts.filter((a) => a.type === 'investment').map((a) => ({ name: a.nickname ?? a.name, change: hist[a.id][end].balance - hist[a.id][start].balance }))
    .filter((a) => Math.abs(a.change) >= 0.5).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return { available: true, period, from, to, since: dates[firstReal], clipped: start > want, change, income: flows.income, spending: flows.spending,
    saved, market: change - saved, investments };
}

export function summary() {
  const history = netWorthHistory();
  const now = history.at(-1)?.value ?? 0;
  const ago = history.length > 30 ? history.at(-31).value : history.length > 1 ? history[0].value : null;

  const today = new Date();
  const thisM = iso(today).slice(0, 7);
  const prevM = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  // Plaid: positive = out, negative = in. Income is the Income group; spending is every spending group,
  // with refunds (negative) reducing it. Transfers, savings and debt repayment are neither.
  const txns = db.prepare('SELECT date, amount, grp FROM transactions WHERE date >= ?').all(iso(shift(-70)))
    .filter((t) => t.grp === 'Income' || !NOT_SPENDING.includes(t.grp));
  const isIncome = (t) => t.grp === 'Income';
  const total = (month, maxDay) => {
    let income = 0, spending = 0;
    for (const t of txns) {
      if (!t.date.startsWith(month) || +t.date.slice(8) > maxDay) continue;
      isIncome(t) ? (income -= t.amount) : (spending += t.amount);
    }
    return { income, spending: Math.max(0, spending) };
  };
  const cur = total(thisM, 31), prev = total(prevM, today.getDate()); // same days elapsed last month
  const lastFull = total(prevM, 31);
  const weekly = (inflow) => {
    const b = Array(8).fill(0);
    for (const t of txns) {
      const w = Math.floor((Date.now() - new Date(t.date + 'T00:00')) / 864e5 / 7);
      if (w < 8 && isIncome(t) === inflow) b[7 - w] += inflow ? -t.amount : t.amount;
    }
    return b.map((v) => Math.max(0, v));
  };
  const rate = (x) => (x.income > 0 ? ((x.income - x.spending) / x.income) * 100 : null);
  const r = rate(cur), pr = rate(prev);
  const start = historyStart();
  return {
    history: start ? history.filter((d) => d.date >= start) : history, // charts start where history is comparable
    netWorth: { value: now, ago, change: ago == null ? null : pct(now, ago), spark: history.slice(-90).map((h) => h.value) },
    // For the hover on each card: the same days of last month, and all of last month.
    day: today.getDate(), prevMonth: prevM,
    // In the first few days of a month there's too little to compare; a "−100%" on the 1st means nothing.
    early: today.getDate() < 5,
    income: { value: cur.income, prev: prev.income, lastMonth: lastFull.income, change: today.getDate() < 5 ? null : pct(cur.income, prev.income), bars: weekly(true) },
    spending: { value: cur.spending, prev: prev.spending, lastMonth: lastFull.spending, change: today.getDate() < 5 ? null : pct(cur.spending, prev.spending), bars: weekly(false) },
    savings: { rate: today.getDate() < 5 ? null : r, change: today.getDate() < 5 || r == null || pr == null ? null : r - pr },
  };
}
