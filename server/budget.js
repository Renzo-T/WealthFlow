import db from './db.js';
import { GROUPS, NOT_SPENDING, SPEND_SQL } from './categories.js';
import { bills } from './recurring.js';

// Monthly budgets, set per subcategory (Groceries, Rent…) and rolled up into budget groups (Food, Housing…), or set
// for a whole group as one amount (budget_groups), when its categories then only show what was spent.
// One amount per category applies to every month. Actuals are signed: refunds reduce spending.
// A category is "fixed" when a recurring bill lands in it, otherwise "flexible".

const BUDGET_GROUPS = Object.keys(GROUPS).filter((g) => g !== 'Transfer'); // Income is budgeted too (expected income)
const monthEnd = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };

// A bill's amount per month: weekly bills happen ~4.33 times a month, quarterly ones a third of a time.
const perMonth = (b) => (b.rule?.kind === 'semi' ? b.amount * 2 : b.rule?.kind === 'weeks' ? (b.amount * 52) / 12 / b.rule.n : b.rule?.kind === 'months' ? b.amount / b.rule.n : b.amount);

function fixedBills(today) {
  const out = {};
  for (const b of bills(today)) {
    if (b.hidden || b.ended || b.direction !== 'out' || !b.category || b.can_card) continue;
    (out[b.category] ??= []).push({ name: b.name, monthly: perMonth(b), nonMonthly: b.rule?.kind === 'months' && b.rule.n > 1 });
  }
  return out;
}

// Average monthly actual per category over the last `n` finished months that have any transactions at all.
function averages(month, n = 3) {
  const months = [];
  for (let k = 1; months.length < n && k <= 12; k++) {
    const m = shiftMonth(month, -k);
    if (db.prepare('SELECT 1 FROM transactions WHERE substr(date, 1, 7) = ? LIMIT 1').get(m)) months.push(m);
  }
  if (!months.length) return { months, avg: {} };
  const rows = db.prepare(`SELECT category, grp, SUM(amount) s FROM transactions
    WHERE substr(date, 1, 7) IN (${months.map(() => '?').join(',')}) AND grp != 'Transfer' ${NO_TRIPS()} GROUP BY category`).all(...months);
  const avg = Object.fromEntries(rows.map((r) => [r.category, (r.grp === 'Income' ? -r.s : r.s) / months.length]));
  return { months, avg };
}

// Whether money spent on confirmed trips counts in budget categories (default yes). When it doesn't, trips are
// left out of actuals, suggestions and rollover, and the page says how much was left out.
export const tripsInBudget = () => db.prepare("SELECT value FROM meta WHERE key = 'budget_trips'").get()?.value !== '0';
const NO_TRIPS = () => (tripsInBudget() ? '' : "AND (trip_id IS NULL OR trip_id NOT IN (SELECT id FROM trips WHERE status = 'confirmed'))");

// What was budgeted in a month: that month's own amount if it has one, otherwise the usual one.
const overridesFor = (from, to) => {
  const out = {};
  for (const r of db.prepare('SELECT month, item, amount FROM budget_overrides WHERE month >= ? AND month <= ?').all(from, to)) (out[r.month] ??= {})[r.item] = r.amount;
  return out;
};

// Rollover: unspent money carries into the next month (overspending reduces it), from the month it was turned on.
function carries(month, budgets) {
  const rolls = db.prepare('SELECT category, since FROM budget_rollover WHERE since < ?').all(month);
  if (!rolls.length) return {};
  const first = rolls.reduce((m, r) => (r.since < m ? r.since : m), month);
  const prevEnd = monthEnd(shiftMonth(month, -1));
  const actual = {};
  for (const r of db.prepare(`SELECT substr(date, 1, 7) m, category, SUM(amount) s FROM transactions WHERE date >= ? AND date <= ? AND grp != 'Transfer'
    AND category IN (${rolls.map(() => '?').join(',')}) ${NO_TRIPS()} GROUP BY m, category`).all(`${first}-01`, prevEnd, ...rolls.map((r) => r.category))) (actual[r.m] ??= {})[r.category] = r.s;
  const over = overridesFor(first, shiftMonth(month, -1));
  const out = {};
  for (const { category, since } of rolls) {
    const history = [];
    for (let m = since; m < month; m = shiftMonth(m, 1)) {
      const budget = over[m]?.[category] ?? budgets[category] ?? 0, spent = actual[m]?.[category] ?? 0;
      history.push({ month: m, budget, actual: spent, left: budget - spent });
    }
    out[category] = { carry: history.reduce((s, h) => s + h.left, 0), history };
  }
  return out;
}

export function budgetMonth(month, today = new Date().toLocaleDateString('en-CA')) {
  const budgets = Object.fromEntries(db.prepare('SELECT category, amount FROM budgets').all().map((r) => [r.category, r.amount]));
  const wholes = Object.fromEntries(db.prepare('SELECT grp, amount FROM budget_groups').all().map((r) => [r.grp, r.amount]));
  const over = overridesFor(month, month)[month] ?? {};
  const rolling = new Set(db.prepare('SELECT category FROM budget_rollover').all().map((r) => r.category));
  const carried = carries(month, budgets);
  const actual = Object.fromEntries(db.prepare(`SELECT category, grp, SUM(amount) s FROM transactions
    WHERE date >= ? AND date <= ? AND grp != 'Transfer' ${NO_TRIPS()} GROUP BY category`).all(`${month}-01`, monthEnd(month))
    .map((r) => [r.category, r.grp === 'Income' ? -r.s : r.s]));
  const fixed = fixedBills(today);
  const { months, avg } = averages(month);
  // The transactions behind each actual (largest first), for the hover on the Actual column.
  const txns = {};
  for (const t of db.prepare(`SELECT date, COALESCE(merchant, name) name, amount, category FROM transactions
    WHERE date >= ? AND date <= ? AND grp != 'Transfer' ${NO_TRIPS()} ORDER BY ABS(amount) DESC`).all(`${month}-01`, monthEnd(month))) (txns[t.category] ??= []).push(t);
  const round = (v) => Math.max(0, Math.round(v / 5) * 5); // suggestions in $5 steps

  const groups = BUDGET_GROUPS.map((group) => {
    const categories = GROUPS[group].filter((c) => c !== 'Sweep').map((category) => {
      const fixedHere = fixed[category];
      const suggested = fixedHere ? Math.round(fixedHere.reduce((s, b) => s + b.monthly, 0)) : avg[category] ? round(avg[category]) : 0;
      return {
        category, budget: category in over ? over[category] : budgets[category] ?? null, actual: actual[category] ?? 0,
        usual: budgets[category] ?? null, overridden: category in over,
        rollover: rolling.has(category), carry: carried[category]?.carry ?? 0, carryHistory: carried[category]?.history ?? [],
        count: txns[category]?.length ?? 0, top: (txns[category] ?? []).slice(0, 6).map(({ date, name, amount }) => ({ date, name, amount })),
        // Fixed: has a recurring bill. Non-monthly: its bills come every few months or yearly (budget = monthly share).
        kind: !fixedHere ? 'flexible' : fixedHere.every((b) => b.nonMonthly) ? 'nonmonthly' : 'fixed', bills: fixedHere?.map((b) => b.name) ?? [],
        suggested: suggested > 0 ? suggested : null,
        basis: fixedHere ? `your bills: ${fixedHere.map((b) => b.name).join(', ')}` : avg[category] ? `average of ${months.length} month${months.length > 1 ? 's' : ''}` : null,
      };
    });
    const sum = (k) => categories.reduce((s, c) => s + (c[k] ?? 0), 0);
    const whole = group in wholes;
    if (whole) for (const c of categories) c.budget = null; // the group's amount covers them
    const gKey = `group:${group}`, gBudget = whole ? (gKey in over ? over[gKey] : wholes[group] ?? null) : null;
    return {
      group, income: group === 'Income', spending: !NOT_SPENDING.includes(group), categories, actual: sum('actual'),
      whole, groupBudget: gBudget, groupUsual: whole ? wholes[group] ?? null : null, groupOverridden: whole && gKey in over,
      groupSuggested: Math.round(sum('suggested')) || null,
      budget: whole ? gBudget ?? 0 : sum('budget'),
      // As one amount, the group is fixed only when every category with spending or a bill is fixed.
      kind: categories.some((c) => c.kind === 'flexible' && (c.actual || c.suggested)) ? 'flexible'
        : categories.some((c) => c.kind === 'fixed') ? 'fixed' : categories.some((c) => c.kind === 'nonmonthly') ? 'nonmonthly' : 'flexible',
    };
  });

  const income = groups.find((g) => g.income);
  const expenses = groups.filter((g) => !g.income);
  // A group budgeted as one amount counts as one item of its kind.
  const all = expenses.flatMap((g) => (g.whole ? [{ kind: g.kind, budget: g.groupBudget, actual: g.actual }] : g.categories));
  const kindTotals = (kind) => {
    const cs = all.filter((c) => c.kind === kind && c.budget != null);
    return { budget: cs.reduce((s, c) => s + c.budget, 0), actual: cs.reduce((s, c) => s + c.actual, 0) };
  };
  // How far through the month we are (for the "on pace" marker): 1 for past months, 0 for future ones.
  const start = Date.parse(`${month}-01T00:00Z`), end = Date.parse(`${monthEnd(month)}T00:00Z`) + 864e5, now = Date.parse(`${today}T12:00Z`);
  return {
    month, prev: shiftMonth(month, -1), next: shiftMonth(month, 1), progress: Math.min(1, Math.max(0, (now - start) / (end - start))),
    income, expenses,
    totals: { income: income.budget, incomeActual: income.actual, expenses: expenses.reduce((s, g) => s + g.budget, 0),
      expensesActual: expenses.reduce((s, g) => s + g.actual, 0), fixed: kindTotals('fixed'), flexible: kindTotals('flexible'),
      nonmonthly: kindTotals('nonmonthly') },
    leftToBudget: income.budget - expenses.reduce((s, g) => s + g.budget, 0),
    trips: { counted: tripsInBudget(), left_out: tripsInBudget() ? 0 : db.prepare(`SELECT COALESCE(SUM(t.amount), 0) v FROM transactions t
      JOIN trips tr ON tr.id = t.trip_id AND tr.status = 'confirmed' WHERE t.date >= ? AND t.date <= ? AND ${SPEND_SQL.replace('grp', 't.grp')}`).get(`${month}-01`, monthEnd(month)).v },
    suggestedFrom: months,
  };
}

// Dashboard panel: budgeted groups this month, with spending.
export function budgetGroups(today = new Date().toLocaleDateString('en-CA')) {
  const b = budgetMonth(today.slice(0, 7), today);
  return b.expenses.filter((g) => g.budget > 0).map((g) => ({ category: g.group, amount: g.budget, spent: Math.max(0, g.actual) }));
}
