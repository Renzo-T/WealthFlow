import db from './db.js';
import { describe } from './describe.js';
import { groupOf } from './categories.js';

// Bills and recurring income. Four sources, one list:
//   detected  - repeating payments found in your transactions (Plaid's own detection often finds little)
//   plaid     - Plaid's recurring streams
//   card      - credit card statements from Plaid Liabilities: the real balance and due date
//   manual    - bills you added yourself
// Everything is described by a schedule rule (below), so any bill can be edited the same way. Your edits live
// in bill_settings, keyed by the bill's key, and always win over what was detected.

const DAY = 864e5;
const d2n = (d) => Date.parse(d + 'T00:00Z') / DAY;
const n2d = (n) => new Date(Math.round(n) * DAY).toISOString().slice(0, 10);
const addDays = (iso, n) => n2d(d2n(iso) + n);
const CADENCES = [ // [name, typical gap in days, allowed drift in days]
  ['WEEKLY', 7, 1], ['BIWEEKLY', 14, 3], ['SEMI_MONTHLY', 15.2, 3], ['MONTHLY', 30.4, 4],
  ['QUARTERLY', 91, 7], ['ANNUALLY', 365, 10],
];
const BILL_GROUPS = new Set(['Housing', 'Utilities', 'Insurance', 'Healthcare', 'Debt repayment', 'Transfer', 'Savings & investments']);
const BILL_SUBS = new Set(['Fitness', 'Phone & internet', 'Services', 'Education', 'Childcare']);
// Streaming and music subscriptions (filed under Entertainment) are bill-like too.
const SUBSCRIPTION = /^ENTERTAINMENT_(TV_AND_MOVIES|MUSIC_AND_AUDIO)$/;

function cadence(gaps) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const c = CADENCES.find(([, g, tol]) => Math.abs(median - g) <= tol * 1.5);
  if (!c) return null;
  const [name, g, tol] = c;
  return gaps.every((x) => Math.abs(x - g) <= tol + (name === 'MONTHLY' ? 1 : 0)) ? { name, gap: g } : null;
}

// ---- Business days: weekends and US bank (Federal Reserve) holidays. Payments due on one post the next or
// previous business day, which is why "the 29th" can land on the 31st.
const holidayCache = new Map();
function holidays(y) {
  if (holidayCache.has(y)) return holidayCache.get(y);
  const d = (m, day) => n2d(Date.UTC(y, m, day) / DAY);
  const nth = (m, wd, n) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return d(m, 1 + ((wd - first + 7) % 7) + 7 * (n - 1)); };
  const last = (m, wd) => { const end = new Date(Date.UTC(y, m + 1, 0)); return d(m, end.getUTCDate() - ((end.getUTCDay() - wd + 7) % 7)); };
  // Fixed-date holidays falling on a Sunday are observed Monday (the Fed doesn't shift Saturday ones).
  const fixed = [[0, 1], [5, 19], [6, 4], [10, 11], [11, 25]].map(([m, day]) => {
    const iso = d(m, day);
    return new Date(iso + 'T00:00Z').getUTCDay() === 0 ? n2d(d2n(iso) + 1) : iso;
  });
  const set = new Set([...fixed, nth(0, 1, 3), nth(1, 1, 3), last(4, 1), nth(8, 1, 1), nth(9, 1, 2), nth(10, 4, 4)]);
  holidayCache.set(y, set);
  return set;
}
const isBiz = (iso) => { const w = new Date(iso + 'T00:00Z').getUTCDay(); return w !== 0 && w !== 6 && !holidays(+iso.slice(0, 4)).has(iso); };
const roll = (iso, dir) => { if (!dir) return iso; let n = d2n(iso); while (!isBiz(n2d(n))) n += dir; return n2d(n); };
const monthLen = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const ym = (iso) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1, d: +iso.slice(8, 10) });
const at = (y, m, day) => n2d(Date.UTC(y, m, day) / DAY); // month may overflow; Date.UTC normalises it
const bizDays = (y, m) => { const out = []; for (let i = 1; i <= monthLen(y, m); i++) { const s = at(y, m, i); if (isBiz(s)) out.push(s); } return out; };
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const rollText = (r) => (r.roll > 0 ? ', or the next business day' : r.roll < 0 ? ', or the business day before' : '');

// ---- Schedule rules. Monthly kinds place a date in a given month; the others step from an anchor date.
//   dom      { n: day of month, roll }          the 29th (or the next business day)
//   eom      { n: days before month end, roll } 3 days before the end of the month
//   bday     { n }                              the 1st business day of the month
//   lastbday { n }                              the last business day of the month
//   weeks    { n, anchor }                      every 2 weeks
//   months   { n, day, roll, anchor }           every 3 months / once a year
//   due      { n }                              n days before a card's statement due date (cards only)
const MONTHLY = {
  dom: (r, y, m) => roll(at(y, m, Math.min(r.n, monthLen(ym(at(y, m, 1)).y, ym(at(y, m, 1)).m))), r.roll),
  eom: (r, y, m) => { const p = ym(at(y, m, 1)); return roll(at(p.y, p.m, monthLen(p.y, p.m) - r.n), r.roll); },
  bday: (r, y, m) => { const p = ym(at(y, m, 1)); return bizDays(p.y, p.m)[r.n - 1]; },
  lastbday: (r, y, m) => { const p = ym(at(y, m, 1)); return bizDays(p.y, p.m).at(-r.n); },
};

export function ruleText(r) {
  switch (r?.kind) {
    case 'dom': return `the ${ord(r.n)} of each month${rollText(r)}`;
    case 'eom': return (r.n ? `${r.n} day${r.n > 1 ? 's' : ''} before the end of each month` : 'the last day of each month') + rollText(r);
    case 'bday': return `the ${ord(r.n)} business day of each month`;
    case 'lastbday': return r.n === 1 ? 'the last business day of each month' : `the ${ord(r.n)}-to-last business day of each month`;
    case 'semi': return `the ${ord(r.n)} and the last day of each month${rollText(r)}`;
    case 'weeks': return r.n === 1 ? 'every week' : `every ${r.n} weeks`;
    case 'months': return r.n === 12 ? 'once a year' : r.n === 3 ? 'every 3 months' : `every ${r.n} months`;
    case 'due': return r.n ? `${r.n} day${r.n > 1 ? 's' : ''} before the card's due date` : "on the card's due date";
    default: return '';
  }
}
export const frequencyOf = (r) => ({ semi: 'Twice a month', weeks: r?.n === 1 ? 'Weekly' : `Every ${r?.n} weeks`, months: r?.n === 12 ? 'Yearly' : r?.n === 3 ? 'Quarterly' : `Every ${r?.n} months` }[r?.kind] ?? 'Monthly');

// First date on or after `from` that the rule produces. `due` needs the card's due date in ctx.
export function nextFromRule(r, from, ctx = {}) {
  if (MONTHLY[r.kind]) {
    const { y, m } = ym(from);
    for (let i = 0; i < 14; i++) { const d = MONTHLY[r.kind](r, y, m + i); if (d && d >= from) return d; }
    return null;
  }
  if (r.kind === 'semi') {
    const { y, m } = ym(from);
    for (let i = 0; i < 14; i++) {
      const p = ym(at(y, m + i, 1)), len = monthLen(p.y, p.m);
      const days = [roll(at(p.y, p.m, Math.min(r.n, len)), r.roll ?? 0), roll(at(p.y, p.m, len), r.roll ?? 0)].sort();
      const d = days.find((x) => x >= from);
      if (d) return d;
    }
    return null;
  }
  if (r.kind === 'weeks') {
    const step = 7 * r.n, k = Math.max(0, Math.ceil((d2n(from) - d2n(r.anchor)) / step));
    return addDays(r.anchor, k * step);
  }
  if (r.kind === 'months') {
    const a = ym(r.anchor);
    for (let k = 0; k < 60; k++) {
      const p = ym(at(a.y, a.m + k * r.n, 1));
      const d = roll(at(p.y, p.m, Math.min(r.day, monthLen(p.y, p.m))), r.roll ?? 0);
      if (d >= from) return d;
    }
    return null;
  }
  if (r.kind === 'due' && ctx.due) {
    let due = ctx.due;
    for (let i = 0; i < 3; i++) { // if this cycle's payment date has passed, use the next cycle (same day next month)
      const pay = addDays(due, -r.n);
      if (pay >= from) return pay;
      const p = ym(due); due = at(p.y, p.m + 1, Math.min(p.d, monthLen(ym(at(p.y, p.m + 1, 1)).y, ym(at(p.y, p.m + 1, 1)).m)));
    }
  }
  return null;
}

function monthlyRule(dates) {
  const ps = dates.map(ym);
  // Candidates come from the observed days themselves (and a day or two before, for bills moved forward off a
  // weekend). Listed simplest first, so on a tie "the 16th" beats "14 days before month end".
  const byKind = { dom: [], eom: [], bday: [], lastbday: [] };
  ps.forEach((p, i) => {
    const len = monthLen(p.y, p.m), biz = bizDays(p.y, p.m), iso = dates[i];
    for (const d of [p.d, p.d - 1, p.d - 2]) if (d >= 1) for (const rl of [0, 1, -1]) byKind.dom.push({ kind: 'dom', n: d, roll: rl });
    for (const rl of [0, 1, -1]) byKind.eom.push({ kind: 'eom', n: len - p.d, roll: rl });
    if (biz.includes(iso)) { byKind.bday.push({ kind: 'bday', n: biz.indexOf(iso) + 1 }); byKind.lastbday.push({ kind: 'lastbday', n: biz.length - biz.indexOf(iso) }); }
  });
  let best = null;
  for (const c of [...byKind.dom, ...byKind.eom, ...byKind.bday, ...byKind.lastbday]) {
    const err = ps.reduce((s, p, i) => s + Math.abs(d2n(MONTHLY[c.kind](c, p.y, p.m)) - d2n(dates[i])), 0);
    if (!best || err < best.err) best = { ...c, err };
  }
  const { err, ...rule } = best;
  return rule;
}

function ruleFor(c, dates) {
  const last = dates.at(-1), p = ym(last);
  if (c.name === 'MONTHLY') return monthlyRule(dates);
  if (c.name === 'WEEKLY') return { kind: 'weeks', n: 1, anchor: last };
  if (c.name === 'BIWEEKLY' || c.name === 'SEMI_MONTHLY') return { kind: 'weeks', n: 2, anchor: last };
  return { kind: 'months', n: c.name === 'QUARTERLY' ? 3 : 12, day: p.d, roll: 1, anchor: last };
}

// The bill series a transaction belongs to: a payment to one of your accounts (card autopay, savings
// contribution) is keyed by that account; anything else by payee and direction. Used by detection and to mark
// recurring rows in the transactions list, so the two always agree.
export function seriesKey(t) {
  const toAccount = t.pair_account || t.transfer_account;
  if (toAccount && t.amount > 0) return `to:${toAccount}`;
  const payee = t.merchant || describe(t.name).replace(/[#\d]+/g, '').replace(/\s+/g, ' ').trim();
  return `${payee.toLowerCase()}|${t.amount > 0 ? 'out' : 'in'}`;
}

// ---- Detection from transactions. A series is the same payee (or, for a transfer, the same destination
// account: a card autopay) repeating on a steady schedule. Needs 3 occurrences, or 2 for bill-like categories.
function detect(today) {
  const rows = db.prepare(`SELECT t.date, t.amount, t.name, t.merchant, t.category, t.grp, t.account_id, t.pfc_detailed,
      COALESCE(a.nickname, a.name) account, p.account_id pair_account, t.transfer_account,
      COALESCE(da.nickname, da.name) dest_name, da.type dest_type, da.subtype dest_subtype
    FROM transactions t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN transactions p ON p.id = t.transfer_pair
    LEFT JOIN accounts da ON da.id = COALESCE(p.account_id, t.transfer_account)
    WHERE t.split_of IS NULL AND t.date >= date(?, '-400 days') AND COALESCE(t.category, '') != 'Sweep'
      AND NOT (t.transfer_pair IS NOT NULL AND t.amount < 0)`).all(today);

  const series = new Map();
  for (const t of rows) {
    const toAccount = t.pair_account || t.transfer_account;
    let key, name;
    if (toAccount && t.amount > 0) { // card autopay, or a regular contribution to savings/investments
      const saving = t.dest_type === 'investment' || ['savings', 'money market', 'cd', 'hsa'].includes(t.dest_subtype);
      if (t.dest_type !== 'credit' && !saving) continue; // moving money between everyday accounts isn't a bill
      key = seriesKey(t);
      name = t.dest_type === 'credit' ? `${t.dest_name} payment` : `Transfer to ${t.dest_name}`;
    } else {
      if (t.grp === 'Transfer') continue; // other transfers aren't bills
      if (t.category === 'Cash back' || (t.amount < 0 && t.grp !== 'Income')) continue; // rewards, refunds: follow your spending
      key = seriesKey(t);
      name = t.merchant || describe(t.name).replace(/[#\d]+/g, '').replace(/\s+/g, ' ').trim();
    }
    if (!series.has(key)) series.set(key, { key, name, txns: [] });
    series.get(key).txns.push(t);
  }

  const out = [];
  for (const s of series.values()) {
    // One charge per day (a split charge on the same day counts once). Pending charges count too: they're
    // the most recent occurrence.
    let byDate = [];
    for (const t of s.txns.sort((a, b) => a.date.localeCompare(b.date))) {
      const prev = byDate.at(-1);
      if (prev && prev.date === t.date) prev.amount += t.amount; else byDate.push({ ...t });
    }
    // A subscription mixed with one-off orders from the same shop (Chewy autoship plus an extra order): when one
    // amount is at least half the charges, the series is just those, and an extra one within 3 days is dropped.
    const cents = (t) => Math.round(Math.abs(t.amount) * 100);
    const counts = byDate.reduce((m, t) => m.set(cents(t), (m.get(cents(t)) ?? 0) + 1), new Map());
    const [modal, modalN] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (counts.size > 1 && modalN >= 3 && modalN >= byDate.length / 2) {
      byDate = byDate.filter((t) => cents(t) === modal)
        .filter((t, i, a) => i === 0 || d2n(t.date) - d2n(a[i - 1].date) > 3);
    }
    const last = byDate.at(-1);
    const billy = BILL_GROUPS.has(last.grp) || BILL_SUBS.has(last.category) || SUBSCRIPTION.test(last.pfc_detailed ?? '') || s.key.startsWith('to:');
    const min = billy ? 2 : 3;
    if (byDate.length < min) continue;
    const gaps = byDate.slice(1).map((t, i) => d2n(t.date) - d2n(byDate[i].date));
    // Judge the most recent steady run, so a bill that recently moved to autopay (irregular before) still counts.
    let c = null, run = 0;
    for (let k = Math.min(gaps.length, 6); k >= min - 1 && !c; k--) { c = cadence(gaps.slice(-k)); run = k + 1; }
    if (!c || (run === 2 && c.name !== 'MONTHLY')) continue; // two points only prove a monthly bill
    const amts = byDate.slice(-6).map((t) => Math.abs(t.amount));
    const median = [...amts].sort((a, b) => a - b)[Math.floor(amts.length / 2)];
    out.push({
      key: s.key, name: s.name, direction: last.amount > 0 ? 'out' : 'in', source: 'detected',
      rule: ruleFor(c, byDate.slice(-run).map((t) => t.date)), gap: c.gap, last_date: last.date,
      last_amount: amts.at(-1), avg_amount: median, // median: one unusually big charge doesn't skew the estimate
      recent: byDate.slice(-6).map((t) => ({ date: t.date, amount: Math.abs(t.amount) })).reverse(),
      variable: Math.max(...amts) / Math.min(...amts) > 1.15, account: last.account, category: last.category,
      card_account: s.key.startsWith('to:') && last.dest_type === 'credit' ? s.key.slice(3) : null,
    });
  }
  return out;
}

// ---- Everything, with your settings applied.
export function bills(today = new Date().toLocaleDateString('en-CA')) {
  const settings = Object.fromEntries(db.prepare(`SELECT s.*, COALESCE(a.nickname, a.name) account_name FROM bill_settings s
    LEFT JOIN accounts a ON a.id = s.account_id`).all()
    .map((s) => [s.key, { ...s, rule: s.rule ? JSON.parse(s.rule) : null }]));
  const list = new Map();

  for (const b of detect(today)) list.set(b.key, b);

  // Plaid's streams, unless detection already has the same payee.
  const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const names = new Set([...list.values()].map((b) => norm(b.name)));
  for (const r of db.prepare(`SELECT r.*, COALESCE(a.nickname, a.name) account FROM recurring r
      LEFT JOIN accounts a ON a.id = r.account_id`).all()) {
    if (names.has(norm(r.name))) continue;
    const p = ym(r.next_date);
    const rule = r.frequency === 'WEEKLY' ? { kind: 'weeks', n: 1, anchor: r.next_date }
      : r.frequency === 'BIWEEKLY' || r.frequency === 'SEMI_MONTHLY' ? { kind: 'weeks', n: 2, anchor: r.next_date }
        : r.frequency === 'ANNUALLY' ? { kind: 'months', n: 12, day: p.d, anchor: r.next_date }
          : { kind: 'dom', n: p.d, roll: 0 };
    list.set(`plaid:${r.id}`, { key: `plaid:${r.id}`, name: describe(r.name), direction: r.direction, source: 'plaid', rule,
      plaid_next: r.next_date, last_amount: r.amount, avg_amount: r.amount, variable: false, account: r.account, category: r.category });
  }

  // Card statements: the real balance and due date. They take over the matching autopay series.
  for (const c of db.prepare(`SELECT s.*, COALESCE(a.nickname, a.name) card, a.balance current FROM card_statements s
      JOIN accounts a ON a.id = s.account_id`).all()) {
    const key = `to:${c.account_id}`, det = list.get(key);
    // Paid: a payment covering the statement since it was issued, or (banks that leave the date out) a $0
    // minimum with a payment covering it. A $0 statement has nothing to pay either.
    const covers = (c.last_payment_amount ?? 0) >= (c.last_statement_balance ?? 0) - 0.01;
    const paid = !(c.last_statement_balance > 0) || (covers && (c.last_statement_date
      ? c.last_payment_date >= c.last_statement_date : c.minimum_payment === 0));
    list.set(key, { key, name: `${c.card} payment`, direction: 'out', source: 'card', rule: { kind: 'due', n: 0 },
      due: c.next_due_date, statement: c.last_statement_balance, minimum: c.minimum_payment, current: c.current, paid,
      last_amount: det?.last_amount ?? c.last_payment_amount, avg_amount: det?.avg_amount ?? c.last_payment_amount,
      variable: true, account: det?.account ?? null, category: 'Transfer', card_account: c.account_id, recent: det?.recent ?? null });
  }

  for (const s of Object.values(settings).filter((s) => s.manual)) {
    list.set(s.key, { key: s.key, name: s.name, direction: s.direction ?? 'out', source: 'manual', rule: s.rule,
      last_amount: s.amount, avg_amount: s.amount, variable: false, account: s.account_name, category: s.category });
  }

  const out = [];
  for (const b of list.values()) {
    const set = settings[b.key];
    const rule = set?.rule ?? b.rule;
    const name = set?.name || b.name;
    // Next date: from your rule if you set one; Plaid's own prediction for its streams; otherwise the day
    // after the last payment. A detected bill more than a few days overdue has probably ended.
    let next;
    if (set?.rule || b.source === 'manual') next = nextFromRule(rule, b.last_date ? [addDays(b.last_date, 1), addDays(today, -3)].sort().at(-1) : today, b);
    else if (b.source === 'plaid') next = b.plaid_next;
    else if (b.source === 'card') next = nextFromRule(rule, b.paid ? addDays(b.due, 1) : addDays(today, -3), b);
    else next = nextFromRule(rule, addDays(b.last_date, 1), b);
    let ended = false;
    if (next && next < today) {
      const late = d2n(today) - d2n(next);
      if (b.source === 'detected' && !set?.rule && late > Math.max(4, (b.gap ?? 30) * 0.15)) ended = true;
      else next = today; // a few days late: due now
    }
    // Amount: what you chose, else the statement for cards, else the last amount (fixed) or recent average.
    const mode = set?.amount_mode ?? (b.source === 'card' ? (b.paid ? 'current' : 'statement') : b.variable ? 'average' : 'last');
    const amount = { fixed: set?.amount, last: b.last_amount, average: b.avg_amount, statement: b.statement,
      minimum: b.minimum, current: b.current }[mode] ?? b.avg_amount ?? 0;
    out.push({
      key: b.key, name, direction: b.direction, source: b.source, rule, schedule: ruleText(rule), frequency: frequencyOf(rule),
      next_date: next, ended, amount: Math.abs(amount ?? 0), amount_mode: mode, estimate: !['fixed', 'statement', 'minimum', 'last'].includes(mode) || (mode === 'last' && b.variable),
      account: b.account, category: b.category, grp: b.category ? groupOf(b.category) : null, last_date: b.last_date ?? null, hidden: !!set?.hidden, edited: !!set && !set.manual,
      card: b.source === 'card' ? { due: b.due, statement: b.statement, minimum: b.minimum, current: b.current, paid: b.paid } : null,
      // A paid card has no bill until the next statement is issued, unless you chose to pay from the running
      // balance (amount "current"), in which case that's a real, scheduled payment.
      unscheduled: b.source === 'card' && b.paid && set?.amount_mode !== 'current',
      can_card: !!b.card_account,
      recent: b.recent ?? null,
    });
  }
  return out.sort((a, b) => (a.next_date ?? '9').localeCompare(b.next_date ?? '9'));
}

// Every bill date in a month (YYYY-MM), repeats included, from each bill's next date onward. Past days only
// show what's still expected; what already happened is in your transactions.
// Every expected bill and income date from `start` to `end` (inclusive), repeats included, from each bill's next
// date onward. Shared by the calendar and Safe to spend.
export function occurrences(start, end, today = new Date().toLocaleDateString('en-CA'), list = bills(today)) {
  const out = [];
  for (const b of list) {
    if (b.hidden || b.ended || b.unscheduled || !b.next_date || !b.rule || b.amount < 0.5) continue;
    const ctx = b.card ? { due: b.card.due } : {};
    let d = b.next_date;
    for (let i = 0; d && d <= end && i < 40; i++) {
      if (d >= start) out.push({ date: d, key: b.key, name: b.name, amount: b.amount, estimate: b.estimate, direction: b.direction,
        grp: b.grp, category: b.category, card: b.can_card, frequency: b.frequency });
      d = nextFromRule(b.rule, addDays(d, 1), ctx);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Every bill date in a month (YYYY-MM). Past days only show what's still expected; what already happened is in
// your transactions.
export const calendar = (month, today = new Date().toLocaleDateString('en-CA')) =>
  occurrences(`${month}-01`, n2d(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0) / DAY), today);

// ---- Paychecks not on a schedule yet. Detection needs a pay pattern, so with only one paycheck so far (history
// that starts recently) nothing shows in Upcoming or Safe to spend. A recent Salary deposit that isn't part of a
// bill is offered instead: "How often are you paid?" You answer once (paycheck_handled remembers it).
const handled = () => { try { return new Set(JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'paycheck_handled'").get()?.value ?? '[]')); } catch { return new Set(); } };
export function markPaycheckHandled(key) {
  const s = handled(); s.add(key);
  db.prepare("INSERT INTO meta (key, value) VALUES ('paycheck_handled', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify([...s]));
}
export function paycheckCandidates(today = new Date().toLocaleDateString('en-CA')) {
  const scheduled = new Set(bills(today).filter((b) => !b.hidden && !b.ended).map((b) => b.key));
  const done = handled(), seen = new Set(), out = [];
  for (const t of db.prepare(`SELECT t.*, COALESCE(a.nickname, a.name) account FROM transactions t JOIN accounts a ON a.id = t.account_id
      WHERE t.category = 'Salary' AND t.amount <= -100 AND t.date >= date(?, '-45 days') ORDER BY t.date DESC`).all(today)) {
    const key = seriesKey(t);
    if (seen.has(key) || scheduled.has(key) || done.has(key)) continue;
    seen.add(key);
    const payer = (t.merchant || describe(t.name)).replace(/\b(direct deposit|dir dep|payroll|inc|llc|ach)\b\.?,?/gi, '').replace(/\s+/g, ' ').trim().split(',')[0].trim(); // "Acme Corp, Incdir Dep" -> "Acme Corp"
    out.push({ key, name: `${payer || 'Paycheck'}`.replace(/,$/, ''), amount: -t.amount, date: t.date, account: t.account, account_id: t.account_id });
  }
  return out;
}
// The schedule for an answer, from the last paycheck's date.
export function paycheckRule(cadence, last) {
  const day = +last.slice(8);
  return { weekly: { kind: 'weeks', n: 1, anchor: last }, biweekly: { kind: 'weeks', n: 2, anchor: last },
    semimonthly: { kind: 'semi', n: day <= 20 ? day : 15, roll: -1 }, monthly: { kind: 'dom', n: day, roll: -1 } }[cadence] ?? null;
}

// Safe to spend: cash in checking-type accounts minus the bills due before your next paycheck. Payday comes from a
// detected salary (or other regular income) schedule; without one, the next 30 days are used, and the result says so.
const SPENDABLE = new Set(['checking', 'cash management', 'prepaid', 'paypal']);
// Free to spend this month: what you could spend between now and the end of the month without coming up short.
// Cash in everyday accounts, plus income still expected this month, minus bills still due this month, minus what you
// owe on cards (already spent; card-payment bills aren't counted again), minus a cushion you choose.
export const cushion = () => Number(db.prepare("SELECT value FROM meta WHERE key = 'safe_cushion'").get()?.value) || 0;
export function freeToSpend(today = new Date().toLocaleDateString('en-CA')) {
  const accounts = db.prepare(`SELECT COALESCE(nickname, name) name, subtype, balance FROM accounts WHERE type = 'depository' AND in_networth = 1`).all()
    .filter((a) => SPENDABLE.has(a.subtype ?? 'checking'));
  const cards = db.prepare(`SELECT COALESCE(nickname, name) name, balance FROM accounts WHERE type = 'credit' AND in_networth = 1 AND balance > 0.005`).all();
  const end = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(0, 10);
  const occ = occurrences(today, end, today, bills(today));
  // Income from tomorrow on: a deposit due today may already be in the balance (better to undercount than double).
  const income = occ.filter((o) => o.direction === 'in' && o.date > today);
  const due = occ.filter((o) => o.direction === 'out' && !o.card);
  const sum = (l, k = 'amount') => l.reduce((s, x) => s + x[k], 0);
  const cash = sum(accounts, 'balance'), owed = sum(cards, 'balance'), c = cushion();
  return { until: end, cash, accounts, income, incomeTotal: sum(income), due, dueTotal: sum(due), cards, owed, cushion: c,
    free: cash + sum(income) - sum(due) - owed - c };
}

// For tests only.
export const _test = { holidays, isBiz, monthlyRule, cadence, detect };
