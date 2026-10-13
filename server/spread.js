// The month spread (dashboard): one entry per day of a month with what was spent that day, and the bills and
// paydays that fell on it, already happened or still expected. Read-only; nothing here changes data.
import db from './db.js';
import { SPEND_SQL } from './categories.js';
import { bills, calendar, seriesKey, SPENDABLE, occurrences } from './recurring.js';
import { accountHistory } from './summary.js';

// Dot size for a day's spending, on one fixed ramp for every month (so a $200 day looks the same in any month):
// the index of the first step the amount is under. 0 = nothing spent.
export const RAMP = [0.5, 10, 30, 75, 150, 300, 600];
export const step = (spent) => (spent < RAMP[0] ? 0 : RAMP.findIndex((x) => spent < x) === -1 ? RAMP.length : RAMP.findIndex((x) => spent < x));

export function monthSpread(month, today = new Date().toLocaleDateString('en-CA')) {
  const [y, m] = month.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const spent = Object.fromEntries(db.prepare(`SELECT date, SUM(amount) s FROM transactions
    WHERE substr(date, 1, 7) = ? AND split_of IS NULL AND COALESCE(is_split, 0) = 0 AND ${SPEND_SQL} GROUP BY date`).all(month).map((r) => [r.date, r.s]));
  // Split originals aren't spending themselves; their parts are, under their own categories.
  for (const r of db.prepare(`SELECT date, SUM(amount) s FROM transactions WHERE substr(date, 1, 7) = ? AND split_of IS NOT NULL AND ${SPEND_SQL} GROUP BY date`).all(month))
    spent[r.date] = (spent[r.date] ?? 0) + r.s;

  // What already happened: transactions belonging to a known bill or income series.
  const known = new Map(bills(today).filter((b) => !b.hidden).map((b) => [b.key, b]));
  const marks = {};
  const add = (date, mark) => (marks[date] ??= []).push(mark);
  for (const t of db.prepare(`SELECT t.date, t.amount, t.name, t.merchant, p.account_id pair_account, t.transfer_account
      FROM transactions t LEFT JOIN transactions p ON p.id = t.transfer_pair
      WHERE substr(t.date, 1, 7) = ? AND t.split_of IS NULL AND t.date <= ? AND t.pending = 0`).all(month, today)) {
    const b = known.get(seriesKey(t));
    if (b) add(t.date, { name: b.name, amount: Math.abs(t.amount), direction: b.direction, done: true });
  }
  // What's still expected (from tomorrow; today's expected items too, unless they already posted).
  for (const o of calendar(month, today)) {
    if (o.date < today) continue;
    if (o.date === today && marks[today]?.some((x) => x.name === o.name)) continue;
    add(o.date, { name: o.name, amount: o.amount, direction: o.direction, done: false, estimate: o.estimate });
  }

  const days = [];
  for (let d = 1; d <= daysIn; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const s = Math.max(0, Math.round((spent[date] ?? 0) * 100) / 100);
    days.push({ date, spent: date <= today ? s : null, step: date <= today ? step(s) : null, marks: marks[date] ?? [],
      future: date > today, today: date === today, weekend: [0, 6].includes(new Date(`${date}T00:00`).getDay()) });
  }
  return { month, ramp: RAMP, days, total: days.reduce((t, x) => t + (x.spent ?? 0), 0) };
}

// The month replayed (Money flow): the cash in your everyday accounts (the ones Free to spend counts) at the end of each
// day, with the paydays and bills that moved it. Days so far come from balance history (rewound from transactions where
// there's no daily snapshot); days ahead are projected from scheduled paydays and bills only (day-to-day spending isn't
// guessed), so they're marked as estimates. Read-only.
export function monthReplay(month, today = new Date().toLocaleDateString('en-CA')) {
  const accounts = db.prepare("SELECT * FROM accounts WHERE type = 'depository' AND in_networth = 1").all()
    .filter((a) => SPENDABLE.has(a.subtype ?? 'checking'));
  const spread = monthSpread(month, today);
  const first = spread.days[0].date, last = spread.days.at(-1).date;
  const prev = new Date(`${first}T00:00`); prev.setDate(prev.getDate() - 1);
  const before = prev.toLocaleDateString('en-CA');
  if (!accounts.length || first > today) return { month, accounts: [], start: null, days: [], low: null };

  // End-of-day cash across the accounts, from each account's daily history.
  const hist = accountHistory(accounts, 400);
  const cash = {};
  for (const a of accounts) for (const p of hist[a.id] ?? []) cash[p.date] = (cash[p.date] ?? 0) + p.balance;
  const dated = Object.keys(cash).sort();
  const at = (date) => (cash[date] ?? (dated.length && date < dated[0] ? null : cash[dated.at(-1)]));

  // Money in and out of those accounts each day (transfers included: moving money to savings lowers your cash).
  const ids = accounts.map((a) => a.id);
  const moves = Object.fromEntries(db.prepare(`SELECT date, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) i, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) o
    FROM transactions WHERE split_of IS NULL AND substr(date, 1, 7) = ? AND account_id IN (${ids.map(() => '?').join(',')}) GROUP BY date`)
    .all(month, ...ids).map((r) => [r.date, { in: r.i, out: r.o }]));

  // Paydays and bills that moved this cash: so far, the ones paid into or out of these accounts (a bill charged to a
  // card doesn't touch it until the card is paid); ahead, the scheduled ones not charged to a card.
  const known = new Map(bills(today).filter((b) => !b.hidden).map((b) => [b.key, b]));
  const marks = {};
  const add = (date, mark) => (marks[date] ??= []).push(mark);
  for (const t of db.prepare(`SELECT t.date, t.amount, t.name, t.merchant, p.account_id pair_account, t.transfer_account
      FROM transactions t LEFT JOIN transactions p ON p.id = t.transfer_pair
      WHERE substr(t.date, 1, 7) = ? AND t.split_of IS NULL AND t.date <= ? AND t.pending = 0 AND t.account_id IN (${ids.map(() => '?').join(',')})`)
    .all(month, today, ...ids)) {
    const b = known.get(seriesKey(t));
    if (b) add(t.date, { name: b.name, amount: Math.abs(t.amount), direction: b.direction, done: true });
  }
  // Ahead: today's cash, plus scheduled paydays, minus scheduled bills paid from these accounts.
  const ahead = {};
  for (const o of occurrences(today > first ? today : first, last, today)) {
    if (o.date <= today || o.card) continue;
    ahead[o.date] = (ahead[o.date] ?? 0) + (o.direction === 'in' ? o.amount : -o.amount);
    add(o.date, { name: o.name, amount: o.amount, direction: o.direction, done: false, estimate: o.estimate });
  }
  const round = (n) => (n == null ? null : Math.round(n * 100) / 100);
  let run = at(today);
  const days = spread.days.map((d) => {
    const future = d.date > today;
    if (future) run += ahead[d.date] ?? 0;
    const m = moves[d.date];
    return { date: d.date, cash: round(future ? run : at(d.date)), future, today: d.today, weekend: d.weekend, spent: d.spent,
      in: round(m?.in ?? 0), out: round(m?.out ?? 0), marks: marks[d.date] ?? [] };
  });
  const start = round(at(before));
  const shown = days.filter((d) => d.cash != null);
  const low = shown.length ? shown.reduce((m, d) => (d.cash < m.cash ? d : m)) : null;
  return { month, accounts: accounts.map((a) => a.nickname || a.name), start, days,
    low: low && { date: low.date, cash: low.cash, future: low.future }, cushion: Number(db.prepare("SELECT value FROM meta WHERE key = 'safe_cushion'").get()?.value) || 0 };
}
