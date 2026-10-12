// The month spread (dashboard): one entry per day of a month with what was spent that day, and the bills and
// paydays that fell on it, already happened or still expected. Read-only; nothing here changes data.
import db from './db.js';
import { SPEND_SQL } from './categories.js';
import { bills, calendar, seriesKey } from './recurring.js';

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
