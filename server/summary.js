import db from './db.js';
import { NOT_SPENDING, SPEND_SQL, historyStart, spendingBetween } from './categories.js';
import { manualAssets, manualOn, valueOn, UNTRACKED_SQL } from './assets.js';

export const iso = (d) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const liability = (a) => a.type === 'credit' || a.type === 'loan';
const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

// Daily balance per account, oldest first: { [accountId]: [{ date, balance, est }] }. Real snapshots where
// they exist; earlier days for bank and card accounts are estimated by rewinding transactions from the nearest later
// real value; other account types are held at that value (Plaid has no history for them), less money that moved
// into them from your other accounts after that day.
export function accountHistory(accounts = db.prepare('SELECT * FROM accounts').all(), maxDays = 365) {
  const snaps = new Map(db.prepare('SELECT * FROM balance_snapshots').all().map((s) => [s.date + s.account_id, s.balance]));
  const byAcct = {};
  for (const t of db.prepare('SELECT account_id, date, SUM(amount) s FROM transactions WHERE split_of IS NULL GROUP BY account_id, date').all())
    (byAcct[t.account_id] ??= {})[t.date] = t.s;
  // Money moved into an account from another of yours, seen from the other side (a paired transfer, or one naming
  // the account by number). Accounts without their own history (investments, loans) rewind these, so money that
  // arrived later isn't also counted there before it left the account it came from (Plaid: positive = out of the
  // other account = into this one).
  const movedIn = {};
  for (const t of db.prepare(`SELECT r.date, COALESCE(p.account_id, r.transfer_account) target, SUM(r.amount) s FROM transactions r
    LEFT JOIN transactions p ON p.id = r.transfer_pair WHERE r.split_of IS NULL AND COALESCE(p.account_id, r.transfer_account) IS NOT NULL
      AND COALESCE(p.account_id, r.transfer_account) <> r.account_id GROUP BY r.date, target`).all())
    (movedIn[t.target] ??= {})[t.date] = t.s;
  // From the day before the first transaction (the balance before it) or the first snapshot, whichever is earlier.
  // Counted in calendar days: from the current time, the count came out a day short in the mornings.
  const first = db.prepare(`SELECT MIN(d) d FROM (SELECT date(MIN(date), '-1 day') d FROM transactions WHERE split_of IS NULL
    UNION ALL SELECT MIN(date) FROM balance_snapshots)`).get().d;
  const days = first ? Math.max(0, Math.min(maxDays, Math.round((new Date(`${iso(new Date())}T00:00`) - new Date(`${first}T00:00`)) / 864e5))) : 0;
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
      // A loan was higher before a payment into it; other accounts held less before money arrived (never below 0).
      else bal = liability(a) ? anchor[a.id] + after[a.id] : Math.max(0, anchor[a.id] - after[a.id]);
      out[a.id].push({ date, balance: Math.round(bal * 100) / 100, est });
      after[a.id] += (a.type === 'depository' || a.type === 'credit' ? byAcct : movedIn)[a.id]?.[date] ?? 0;
    }
  }
  for (const id in out) out[id].reverse();
  return out;
}

export function netWorthHistory() {
  const accounts = db.prepare('SELECT * FROM accounts WHERE in_networth = 1').all();
  if (!accounts.length) return [];
  const hist = accountHistory(accounts);
  // Assets and debts you added count at the value each day had (a new value counts from the day it changed).
  const assets = manualAssets();
  return hist[accounts[0].id].map((d, i) => {
    let value = manualOn(d.date, assets), real = false;
    for (const a of accounts) { const p = hist[a.id][i]; value += liability(a) ? -p.balance : p.balance; if (!p.est) real = true; }
    return { date: d.date, value: Math.round(value * 100) / 100, est: !real };
  });
}

// What moved your net worth over a period: what you saved (income − spending from transactions), money moved to
// accounts Mizo Money doesn't track (unpaired transfers, savings and debt payments out of a net-worth account that don't
// name another net-worth account, unless you counted them toward an asset you added), new values you gave assets you
// added, and everything else, mostly investments' market moves (also interest, fees outside
// transactions, corrections). Only on dates where every
// account has a real daily value: before Mizo Money's first snapshots, investment values aren't known.
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
  const assets = manualAssets();
  const nw = (i) => accounts.reduce((s, a) => s + (liability(a) ? -1 : 1) * hist[a.id][i].balance, 0) + manualOn(dates[i], assets);
  const from = dates[start], to = dates[end];
  const flows = db.prepare(`SELECT COALESCE(SUM(CASE WHEN grp = 'Income' THEN -amount END), 0) income,
    COALESCE(SUM(CASE WHEN ${SPEND_SQL} THEN amount END), 0) spending FROM transactions WHERE date > ? AND date <= ? AND COALESCE(pending, 0) = 0`).get(from, to);
  // Pending transactions wait until they post: balances don't include them yet, so counting them would leave the
  // difference in "market and other". Plaid: positive = out, so money leaving is −amount. Split originals and sweeps (inside one account) don't count.
  // A transfer you counted toward an asset you added moved between your own things: it's in neither row.
  const movedTx = db.prepare(`SELECT t.id, t.date, COALESCE(t.merchant, t.name) name, -t.amount amount,
      (SELECT asset_id FROM manual_asset_values v WHERE v.tx_id = t.id) asset FROM transactions t
    JOIN accounts a ON a.id = t.account_id AND a.in_networth = 1
    WHERE t.date > ? AND t.date <= ? AND COALESCE(t.pending, 0) = 0 AND ${UNTRACKED_SQL}
    ORDER BY ABS(t.amount) DESC, t.date DESC`).all(from, to);
  const linked = movedTx.filter((t) => t.asset != null), untracked = movedTx.filter((t) => t.asset == null);
  const moved = untracked.reduce((s, t) => s + t.amount, 0);
  // Assets you added: their change over the period, less the transfers counted toward them (those only moved money).
  const valued = assets.map((a) => {
    const sign = a.kind === 'liability' ? -1 : 1;
    const transfers = linked.filter((t) => t.asset === a.id).reduce((s, t) => s - t.amount, 0); // money that went into it
    return { name: a.name, change: sign * (valueOn(a.entries, to) - valueOn(a.entries, from)) - transfers };
  }).filter((a) => Math.abs(a.change) >= 0.5);
  const revalued = valued.reduce((s, a) => s + a.change, 0);
  const change = nw(end) - nw(start), saved = flows.income - flows.spending;
  // Each investment account's market move: its change less money you put in or took out (its own transactions, and
  // transfers seen only from the other side, naming it by number). That money left or reached another row's account,
  // so taking it out here leaves the total alone; it only stops a contribution looking like a gain.
  const own = new Map(db.prepare(`SELECT account_id id, -SUM(amount) s FROM transactions WHERE date > ? AND date <= ? AND split_of IS NULL
    AND COALESCE(pending, 0) = 0 AND COALESCE(category, '') <> 'Sweep' GROUP BY account_id`).all(from, to).map((r) => [r.id, r.s]));
  const named = new Map(db.prepare(`SELECT transfer_account id, SUM(amount) s FROM transactions WHERE date > ? AND date <= ? AND split_of IS NULL AND COALESCE(pending, 0) = 0
    AND transfer_pair IS NULL AND transfer_account IS NOT NULL AND transfer_account <> account_id GROUP BY transfer_account`).all(from, to).map((r) => [r.id, r.s]));
  const investments = accounts.filter((a) => a.type === 'investment').map((a) => {
    const added = (own.get(a.id) ?? 0) + (named.get(a.id) ?? 0);
    return { name: a.nickname ?? a.name, change: hist[a.id][end].balance - hist[a.id][start].balance - added, added };
  }).filter((a) => Math.abs(a.change) >= 0.5 || Math.abs(a.added) >= 0.5).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return { available: true, period, from, to, since: dates[firstReal], clipped: start > want, change, income: flows.income, spending: flows.spending,
    saved, moved, revalued, valued, market: change - saved - moved - revalued, investments,
    movedItems: untracked.slice(0, 5).map(({ asset, ...t }) => t),
    movedMore: { count: Math.max(0, untracked.length - 5), amount: untracked.slice(5).reduce((s, t) => s + t.amount, 0) } };
}

export function summary() {
  const history = netWorthHistory();
  const now = history.at(-1)?.value ?? 0;
  const ago = history.length > 30 ? history.at(-31).value : history.length > 1 ? history[0].value : null;

  const today = new Date();
  const thisM = iso(today).slice(0, 7);
  const prevM = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7);
  // Plaid: positive = out, negative = in. Income is the Income group; spending is every spending group, with refunds
  // reducing their own group's spending (spendingBetween). Transfers, savings and debt repayment are neither.
  const txns = db.prepare('SELECT date, amount, grp FROM transactions WHERE date >= ?').all(iso(shift(-70)))
    .filter((t) => t.grp === 'Income' || !NOT_SPENDING.includes(t.grp));
  const isIncome = (t) => t.grp === 'Income';
  const total = (month, maxDay) => {
    let income = 0;
    for (const t of txns) if (isIncome(t) && t.date.startsWith(month) && +t.date.slice(8) <= maxDay) income -= t.amount;
    const { spent, refunds } = spendingBetween(`${month}-01`, `${month}-${String(Math.min(maxDay, 31)).padStart(2, '0')}`);
    return { income, spending: spent, refunds };
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
    spending: { value: cur.spending, refunds: cur.refunds, prev: prev.spending, lastMonth: lastFull.spending, change: today.getDate() < 5 ? null : pct(cur.spending, prev.spending), bars: weekly(false) },
    savings: { rate: today.getDate() < 5 ? null : r, change: today.getDate() < 5 || r == null || pr == null ? null : r - pr },
  };
}
