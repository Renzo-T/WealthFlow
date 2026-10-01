import db from './db.js';
import { GROUPS, NOT_SPENDING, SPEND_SQL, historyStart } from './categories.js';
import { bills } from './recurring.js';
import { coverageStart } from './insights.js';

// ---------- Reports: month by month, subscriptions, and the year in review ----------
const iso = (d) => d.toISOString().slice(0, 10);
const monthsBack = (n, today) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (n - 1 - i), 1));
  return iso(d).slice(0, 7);
});
// A month is complete only if every bank's history covers all of it (like the rest of the app): earlier months are
// marked, and left out of averages.
const isPartial = (m) => { const c = coverageStart(); return !c || `${m}-01` < c; };

// Spending (and income) by group and category for the last `n` months, with each row's average over complete months.
export function monthByMonth(n = 12, today = new Date().toLocaleDateString('en-CA')) {
  const start = historyStart()?.slice(0, 7);
  const months = monthsBack(n, today).filter((m, i, all) => !start || m >= start || i === all.length - 1);

  const rows = db.prepare(`SELECT substr(date, 1, 7) m, grp, category, SUM(amount) v FROM transactions
    WHERE date >= ? AND COALESCE(grp, 'Misc') NOT IN ('Transfer', 'Split') GROUP BY m, grp, category`).all(`${months[0]}-01`);
  const cell = {};
  for (const r of rows) {
    const sign = r.grp === 'Income' ? -1 : 1;
    ((cell[r.grp ?? 'Misc'] ??= {})[r.category ?? 'Other'] ??= {})[r.m] = sign * r.v;
  }
  // The largest transactions behind each cell (category and group), for the hover: [{date, name, amount}], plus counts.
  const top = {}, count = {};
  for (const t of db.prepare(`SELECT substr(date, 1, 7) m, date, COALESCE(merchant, name) name, amount, grp, category FROM transactions
    WHERE date >= ? AND COALESCE(grp, 'Misc') NOT IN ('Transfer', 'Split') ORDER BY ABS(amount) DESC`).all(`${months[0]}-01`)) {
    for (const k of [`${t.grp}|${t.category}|${t.m}`, `${t.grp}||${t.m}`]) {
      count[k] = (count[k] ?? 0) + 1;
      if ((top[k] ??= []).length < 5) top[k].push({ date: t.date, name: t.name, amount: t.grp === 'Income' ? -t.amount : t.amount });
    }
  }
  const behind = (g, c) => months.map((m) => ({ top: top[`${g}|${c ?? ''}|${m}`] ?? [], count: count[`${g}|${c ?? ''}|${m}`] ?? 0 }));
  // For a partial month: the banks whose history starts after the month began.
  const banks = db.prepare(`SELECT i.institution, MIN(t.date) first FROM transactions t JOIN accounts a ON a.id = t.account_id
    JOIN items i ON i.id = a.item_id WHERE a.type IN ('depository', 'credit') GROUP BY i.id`).all(); // everyday accounts only
  const missing = months.map((m) => banks.filter((b) => b.first > `${m}-01`).map((b) => ({ bank: b.institution, from: b.first })));
  const full = months.filter((m) => !isPartial(m) && m < today.slice(0, 7)); // finished and complete
  const avg = (vals) => (full.length ? full.reduce((s, m) => s + (vals[m] ?? 0), 0) / full.length : null);
  const line = (name, vals) => ({ name, values: months.map((m) => vals[m] ?? 0), avg: avg(vals) });
  const sumVals = (list) => list.reduce((acc, v) => { for (const m of months) acc[m] = (acc[m] ?? 0) + (v[m] ?? 0); return acc; }, {});
  const groups = Object.keys(GROUPS).filter((g) => g !== 'Transfer' && cell[g]).map((g) => {
    const cats = Object.entries(cell[g]).map(([c, vals]) => ({ ...line(c, vals), behind: behind(g, c) })).filter((c) => c.values.some((v) => Math.abs(v) >= 0.5))
      .sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0));
    return { ...line(g, sumVals(Object.values(cell[g]))), behind: behind(g), group: g, income: g === 'Income', spending: !NOT_SPENDING.includes(g), categories: cats };
  }).filter((g) => g.categories.length);
  const spend = sumVals(groups.filter((g) => g.spending).map((g) => Object.fromEntries(months.map((m, i) => [m, g.values[i]]))));
  const income = groups.find((g) => g.income);
  return { months, partial: months.map(isPartial), missing, averaged: full, current: today.slice(0, 7), groups,
    totals: { spending: line('Spending', spend), income: income ? { ...income, categories: undefined } : line('Income', {}) } };
}

// A bill's cost per month and per year, whatever its schedule.
const perMonth = (b) => (b.rule?.kind === 'semi' ? b.amount * 2 : b.rule?.kind === 'weeks' ? (b.amount * 52) / 12 / b.rule.n
  : b.rule?.kind === 'months' ? b.amount / b.rule.n : b.amount);
// Essentials and money movements aren't subscriptions; everything else that recurs (streaming, apps, memberships,
// deliveries) is. Hide one on the Bills page ("Not a bill") if it isn't.
const NOT_SUBSCRIPTION = new Set(['Housing', 'Utilities', 'Insurance', 'Healthcare', 'Debt repayment', 'Transfer', 'Savings & investments', 'Income']);
export function subscriptions(today = new Date().toLocaleDateString('en-CA')) {
  const list = bills(today).filter((b) => b.direction === 'out' && !b.hidden && !b.ended && !b.can_card && !b.card
    && !NOT_SUBSCRIPTION.has(b.grp ?? 'Misc') && b.amount >= 0.5).map((b) => {
    const r = b.recent ?? [];
    // A price change: the latest charge differs from the one before by more than 1% (and 50¢).
    const change = r.length >= 2 && Math.abs(r[0].amount - r[1].amount) > Math.max(0.5, r[1].amount * 0.01)
      ? { from: r[1].amount, to: r[0].amount, since: r[0].date } : null;
    return { key: b.key, name: b.name, category: b.category, grp: b.grp, frequency: b.frequency, amount: b.amount, estimate: b.estimate,
      monthly: perMonth(b), yearly: perMonth(b) * 12, next: b.next_date, last: r[0]?.date ?? b.last_date, account: b.account, change, recent: r };
  }).sort((a, b) => b.yearly - a.yearly);
  return { items: list, monthly: list.reduce((s, x) => s + x.monthly, 0), yearly: list.reduce((s, x) => s + x.yearly, 0) };
}

// The year in review: income, spending, savings rate, where it went, the biggest month and purchase, and trips.
export function yearInReview(year = new Date().getFullYear(), today = new Date().toLocaleDateString('en-CA')) {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const income = -q(`SELECT COALESCE(SUM(amount), 0) v FROM transactions WHERE grp = 'Income' AND date BETWEEN ? AND ?`, from, to).v;
  const spending = q(`SELECT COALESCE(SUM(amount), 0) v FROM transactions WHERE ${SPEND_SQL} AND date BETWEEN ? AND ?`, from, to).v;
  const groups = db.prepare(`SELECT grp name, SUM(amount) v FROM transactions WHERE ${SPEND_SQL} AND date BETWEEN ? AND ? GROUP BY grp HAVING v > 0.5 ORDER BY v DESC`).all(from, to);
  const months = db.prepare(`SELECT substr(date, 1, 7) m, SUM(amount) v FROM transactions WHERE ${SPEND_SQL} AND date BETWEEN ? AND ? GROUP BY m ORDER BY v DESC`).all(from, to);
  const cats = {};
  for (const r of db.prepare(`SELECT grp, category, SUM(amount) v FROM transactions WHERE ${SPEND_SQL} AND date BETWEEN ? AND ? GROUP BY grp, category HAVING v > 0.5 ORDER BY v DESC`).all(from, to))
    (cats[r.grp] ??= []).push({ name: r.category, v: r.v });
  // Biggest purchase: not rent, utilities or insurance (bills, not purchases).
  const biggest = q(`SELECT date, COALESCE(merchant, name) name, amount, category FROM transactions WHERE ${SPEND_SQL}
    AND COALESCE(grp, 'Misc') NOT IN ('Housing', 'Utilities', 'Insurance') AND date BETWEEN ? AND ?
    ORDER BY amount DESC LIMIT 1`, from, to) ?? null;
  const trips = db.prepare(`SELECT tr.id, tr.name, tr.start, tr.end, COALESCE(SUM(t.amount), 0) total FROM trips tr LEFT JOIN transactions t ON t.trip_id = tr.id
    WHERE tr.status = 'confirmed' AND tr.start BETWEEN ? AND ? GROUP BY tr.id ORDER BY tr.start`).all(from, to);
  const merchants = db.prepare(`SELECT COALESCE(merchant, name) name, COUNT(DISTINCT date) visits, SUM(amount) v FROM transactions
    WHERE ${SPEND_SQL} AND amount > 0 AND merchant IS NOT NULL AND date BETWEEN ? AND ? GROUP BY 1 ORDER BY visits DESC, v DESC LIMIT 5`).all(from, to);
  const first = q('SELECT MIN(date) d FROM transactions WHERE date BETWEEN ? AND ?', from, to).d;
  const complete = coverageStart();
  const startYear = historyStart()?.slice(0, 4);
  const years = db.prepare("SELECT DISTINCT substr(date, 1, 4) y FROM transactions ORDER BY y DESC").all().map((r) => +r.y)
    .filter((y) => !startYear || y >= +startYear);
  return {
    year, years, income, spending, saved: income - spending, rate: income > 0 ? ((income - spending) / income) * 100 : null,
    groups: groups.map((g) => ({ ...g, share: spending ? (g.v / spending) * 100 : 0, categories: cats[g.name] ?? [] })),
    topMonth: months[0] ?? null, byMonth: [...months].sort((a, b) => a.m.localeCompare(b.m)), biggest, trips, merchants,
    // How complete the year's data is: when it starts, and whether every bank's history covers it.
    from: first, complete: !!complete && complete <= from, completeFrom: complete, soFar: today.slice(0, 4) === String(year),
  };
}
