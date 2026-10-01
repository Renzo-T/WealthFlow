import db from './db.js';
import { iso } from './summary.js';
import { SPEND_SQL, NOT_SPENDING, historyStart } from './categories.js';
import { bills } from './recurring.js';

export const ACCT = `COALESCE(a.nickname, a.name)`; // display name for an account row aliased `a`

const monthKeys = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i));
  return iso(d).slice(0, 7);
});

// First date on which every connected bank has transactions. Months before it are missing data from
// at least one bank, so they're flagged `partial` and left out of averages. Only everyday accounts (checking, savings,
// cards) count: a bank that only holds investments doesn't change what you earned or spent.
const EVERYDAY = "a.type IN ('depository', 'credit')";
export function coverageStart() {
  return db.prepare(`SELECT MAX(first) d FROM (SELECT MIN(t.date) first FROM transactions t
    JOIN accounts a ON a.id = t.account_id WHERE ${EVERYDAY} GROUP BY a.item_id)`).get().d;
}

// Which bank's history starts last (it decides which months count as complete), for explaining averages.
export function coverage() {
  const banks = db.prepare(`SELECT i.institution, MIN(t.date) first FROM transactions t JOIN accounts a ON a.id = t.account_id
    JOIN items i ON i.id = a.item_id WHERE ${EVERYDAY} GROUP BY i.id ORDER BY first DESC`).all();
  return { start: banks[0]?.first ?? null, latest: banks[0] ?? null };
}

// Income vs spending per month. Transfers and debt payments excluded; refunds reduce spending.
export function cashFlow(n = 6) {
  const shownFrom = historyStart()?.slice(0, 7);
  const keys = monthKeys(n).filter((k, i, all) => !shownFrom || k >= shownFrom || i === all.length - 1); // not before charts start
  const rows = db.prepare(`SELECT substr(date,1,7) m,
      SUM(CASE WHEN grp = 'Income' THEN -amount ELSE 0 END) income,
      SUM(CASE WHEN ${SPEND_SQL} THEN amount ELSE 0 END) spending
    FROM transactions WHERE date >= ? GROUP BY m`).all(keys[0] + '-01');
  const by = Object.fromEntries(rows.map((r) => [r.m, r]));
  const start = coverageStart();
  return keys.map((k) => ({ month: k, income: Math.max(0, by[k]?.income ?? 0), spending: Math.max(0, by[k]?.spending ?? 0),
    partial: !start || k + '-01' < start }));
}

// Income is grouped by payer (Plaid's merchant, else the description). Bank descriptions like
// "DIRECT DEPOSIT ACME CORP, INCDIR DEP (Cash)" are tidied to "Acme Corp salary" (the suffix comes from the
// Income subcategory); the user can rename any source.
const KIND = { Salary: ' salary', Dividends: ' dividends', Interest: ' interest' };
const TITLE = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);
function tidy(key) {
  const s = key.replace(/\(.*?\)/g, ' ').replace(/DIR\s*DEP/gi, ' ')
    .replace(/\b(DIRECT DEPOSIT|DEPOSIT|ACH|TRNSFR|TRANSFER|PAYROLL|PPD|DES:.*)\b/gi, ' ')
    .replace(/[,\s]+(INC|LLC|CORP|CO)\.?\s*$/i, '').replace(/\s+/g, ' ').replace(/[\s,.-]+$/, '').trim();
  return s ? TITLE(s) : key;
}
export function incomeSources(from, to) {
  const names = Object.fromEntries(db.prepare('SELECT key, label FROM income_names').all().map((r) => [r.key, r.label]));
  const rows = db.prepare(`SELECT COALESCE(merchant, name) key, -SUM(amount) value, MAX(category) kind FROM transactions
    WHERE grp = 'Income' AND date >= ? AND date < ? GROUP BY 1`).all(from, to);
  const by = new Map();
  for (const r of rows) {
    const name = incomeName(r.key, r.kind, names);
    const x = by.get(name) ?? { name, key: r.key, value: 0 };
    x.value += r.value;
    by.set(name, x);
  }
  return { list: [...by.values()].filter((x) => x.value > 0).sort((a, b) => b.value - a.value), names };
}
export const incomeName = (key, kind, names) => names[key] ?? tidy(key) + (KIND[kind] ?? '');

// Where money came from and went over [from, to): income sources on the left; budget groups, savings,
// debt repayment and what's left over on the right. A group that netted negative (refunds, cash back,
// a withdrawal from savings) is money in, so it goes on the left. Transfers are summed separately.
export function flow(from, to) {
  const top = (rows, n, rest) => {
    const out = rows.slice(0, n);
    const r = rows.slice(n).reduce((s, x) => s + x.value, 0);
    if (r > 0.5) out.push({ name: rest, value: r });
    return out;
  };
  const sources = incomeSources(from, to).list;
  const net = db.prepare(`SELECT COALESCE(grp,'Misc') name, SUM(amount) value, ${SPEND_SQL} spend FROM transactions
    WHERE COALESCE(grp,'Misc') NOT IN ('Income','Transfer','Split') AND date >= ? AND date < ? GROUP BY 1 ORDER BY spend DESC, value DESC`).all(from, to);
  const cats = net.filter((c) => c.value > 0.005);
  const credits = net.filter((c) => c.value < -0.005).map((c) => ({ name: c.name, value: -c.value, credit: true }));
  const income = sources.reduce((s, x) => s + x.value, 0);
  const spending = net.filter((c) => c.spend).reduce((s, x) => s + x.value, 0); // net, same as the dashboard
  const allocated = net.reduce((s, x) => s + x.value, 0); // spending + savings + debt repayment
  const moved = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) v FROM transactions
    WHERE ((transfer_pair IS NOT NULL AND amount > 0) OR (transfer_pair IS NULL AND transfer_account IS NOT NULL))
      AND date >= ? AND date < ?`).get(from, to).v;
  const subs = db.prepare(`SELECT COALESCE(grp,'Misc') g, COALESCE(category,'Other') c, SUM(amount) v FROM transactions
    WHERE COALESCE(grp,'Misc') NOT IN ('Income','Transfer') AND date >= ? AND date < ? GROUP BY 1, 2 HAVING v > 0.005 ORDER BY v DESC`).all(from, to);
  for (const c of cats) c.subs = subs.filter((x) => x.g === c.name).slice(0, 3).map((x) => ({ name: x.c, value: x.v }));
  const left = [...top(sources, 5, 'Other income'), ...credits], right = [...cats];
  if (income > allocated) right.push({ name: 'Left over', value: income - allocated, saved: true });
  if (allocated > income) left.push({ name: 'From savings', value: allocated - income, saved: true });
  return { from, to, income, spending, moved, sources: left, categories: right };
}

// Money moving through your accounts over [from, to), as a graph for a multi-column Sankey:
// income sources → the accounts it landed in → accounts it moved to → spending. Spending is one node here
// (the budget-group breakdown lives in the other view); savings and debt repayment stay separate.
// Transfers between two accounts are netted to one direction, and any remaining loop is broken at its
// smallest link, because a Sankey can't draw cycles. Each account is balanced with "Kept in accounts"
// (more came in than went out) or "From account balances" (more went out, e.g. paying last month's card).
// Sweeps (cash moving to the account's own money-market fund) are ignored.
export function accountFlow(from, to) {
  const { names } = incomeSources(from, to);
  const accts = Object.fromEntries(db.prepare(`SELECT a.id, ${ACCT} name, a.type, a.subtype, i.institution FROM accounts a
    LEFT JOIN items i ON i.id = a.item_id`).all().map((a) => [a.id, a]));
  const txns = db.prepare(`SELECT t.account_id, t.amount, t.grp, t.category, t.transfer_pair, t.transfer_account, t.pfc_detailed,
      COALESCE(t.merchant, t.name) key, p.account_id pair_account
    FROM transactions t LEFT JOIN transactions p ON p.id = t.transfer_pair
    WHERE t.date >= ? AND t.date < ?`).all(from, to);

  const nodes = new Map();
  const node = (id, name, kind, extra = {}) => { if (!nodes.has(id)) nodes.set(id, { id, name, kind, ...extra }); return id; };
  const edges = new Map(); // "a|b" -> value (a → b)
  const add = (a, b, v) => { const k = `${a}|${b}`; edges.set(k, (edges.get(k) ?? 0) + v); };
  const acct = (id) => node(`a:${id}`, accts[id]?.name ?? 'Unknown account', 'account', { institution: accts[id]?.institution });

  for (const t of txns) {
    const A = acct(t.account_id);
    if (t.transfer_pair) { // matched transfer: only the outgoing side makes the link
      if (t.amount > 0) add(A, acct(t.pair_account), t.amount);
      continue;
    }
    if (t.transfer_account) { // other side missing, account known from the description
      if (t.amount > 0) add(A, acct(t.transfer_account), t.amount);
      else add(acct(t.transfer_account), A, -t.amount);
      continue;
    }
    if (t.grp === 'Income') {
      const name = incomeName(t.key, t.category, names);
      add(node(`i:${name}`, name, 'income', { key: t.key }), A, -t.amount);
    } else if (t.grp === 'Transfer') {
      if (t.category === 'Sweep') continue;
      if (t.amount > 0) add(A, node('x:out', 'Accounts not connected', 'external'), t.amount);
      else add(node('x:in', 'From accounts not connected', 'external'), A, -t.amount);
    } else {
      const g = t.grp ?? 'Misc';
      const kind = NOT_SPENDING.includes(g) ? 'saving' : 'group';
      if (t.amount > 0) add(A, kind === 'saving' ? node(`g:${g}`, g, kind) : node('g:spending', 'Spending', 'group'), t.amount);
      else if (kind === 'saving') add(node(`r:${g}`, g === 'Savings & investments' ? 'From savings' : g, 'credit'), A, -t.amount);
      else add(node('r:refunds', 'Refunds & cash back', 'credit'), A, -t.amount);
    }
  }

  // Net opposite links (A→B and B→A) and links into and out of the same pooled node.
  const net = new Map();
  for (const [k, v] of edges) {
    const [a, b] = k.split('|');
    const back = `${b}|${a}`;
    if (net.has(back)) {
      const d = net.get(back) - v;
      if (d >= 0) net.set(back, d); else { net.delete(back); net.set(k, -d); }
    } else net.set(k, v);
  }
  for (const [k, v] of net) if (v < 1) net.delete(k);

  // Break cycles among accounts at the smallest link, then re-check.
  const cycle = () => {
    const out = new Map();
    for (const k of net.keys()) { const [a, b] = k.split('|'); if (!out.has(a)) out.set(a, []); out.get(a).push(b); }
    const state = new Map(), stack = [];
    const dfs = (n) => {
      state.set(n, 1); stack.push(n);
      for (const m of out.get(n) ?? []) {
        if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m];
        if (!state.has(m)) { const c = dfs(m); if (c) return c; }
      }
      state.set(n, 2); stack.pop();
      return null;
    };
    for (const n of out.keys()) if (!state.has(n)) { const c = dfs(n); if (c) return c; }
    return null;
  };
  for (let c = cycle(); c; c = cycle()) {
    const ks = c.slice(0, -1).map((n, i) => `${n}|${c[i + 1]}`);
    net.delete(ks.reduce((m, k) => (net.get(k) < net.get(m) ? k : m)));
  }

  // Balance every account.
  const inflow = new Map(), outflow = new Map();
  for (const [k, v] of net) {
    const [a, b] = k.split('|');
    outflow.set(a, (outflow.get(a) ?? 0) + v); inflow.set(b, (inflow.get(b) ?? 0) + v);
  }
  for (const id of nodes.keys()) {
    if (!id.startsWith('a:')) continue;
    const d = (inflow.get(id) ?? 0) - (outflow.get(id) ?? 0);
    if (d >= 1) net.set(`${id}|${node('b:keep', 'Kept in accounts', 'balance')}`, d);
    else if (d <= -1) net.set(`${node('b:draw', 'From account balances', 'balance')}|${id}`, -d);
  }

  const used = new Set([...net.keys()].flatMap((k) => k.split('|')));
  return {
    from, to,
    nodes: [...nodes.values()].filter((n) => used.has(n.id)),
    links: [...net].map(([k, value]) => { const [source, target] = k.split('|'); return { source, target, value }; }),
  };
}

// This month's spending by category: top N plus one "REST" bucket.
// While this month has no spending yet (its first days), show last month instead, labelled as such.
export function topCategories(limit = 5) {
  const month = (m) => db.prepare(`SELECT COALESCE(grp,'Misc') c, SUM(amount) total FROM transactions
    WHERE substr(date,1,7) = ? AND ${SPEND_SQL}
    GROUP BY c HAVING total > 0 ORDER BY total DESC`).all(m);
  const now = new Date(), thisMonth = iso(now).slice(0, 7), lastMonth = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  let rows = month(thisMonth), shown = thisMonth;
  if (!rows.length) { rows = month(lastMonth); shown = lastMonth; }
  const total = rows.reduce((s, r) => s + r.total, 0);
  // Subcategories within each group (refunds net out), shown when hovering a row.
  const subs = {};
  for (const r of db.prepare(`SELECT COALESCE(grp,'Misc') g, COALESCE(category,'Other') c, SUM(amount) total FROM transactions
    WHERE substr(date,1,7) = ? AND ${SPEND_SQL} GROUP BY g, c HAVING ABS(total) > 0.5 ORDER BY total DESC`).all(shown)) (subs[r.g] ??= []).push({ name: r.c, total: r.total });
  const items = rows.slice(0, limit).map((r) => ({ category: r.c, total: r.total, subs: subs[r.c] ?? [] }));
  const rest = rows.slice(limit);
  if (rest.length) items.push({ category: 'REST', total: rest.reduce((s, r) => s + r.total, 0), subs: rest.map((r) => ({ name: r.c, total: r.total })) });
  return { total, month: shown, fallback: shown !== thisMonth, items: items.map((i) => ({ ...i, share: total ? (i.total / total) * 100 : 0 })) };
}

// What kind of holding, shared by the dashboard and the Investments page. Plaid calls both single stocks and
// 401(k) collective trusts "equity"; only real stocks carry a subtype. Brokerage deposit programs are cash.
export function holdingKind(h) {
  if (h.type === 'cash' || (h.type === 'other' && /deposit|money market|cash/i.test(h.name ?? ''))) return 'Cash';
  if (h.type === 'etf') return 'ETFs';
  if (h.type === 'mutual fund') return 'Mutual funds';
  if (h.type === 'equity') return h.subtype ? 'Stocks' : 'Employer plan funds';
  if (h.type === 'fixed income') return 'Bonds';
  return 'Other';
}

// Assets only (no cards or loans). Accounts with holdings are split by holding kind; others by account type.
const MANUAL_LABEL = { real_estate: 'Real estate', vehicle: 'Vehicles', other: 'Other' };
export function allocation() {
  const sums = {};
  const add = (k, v) => { if (v > 0) sums[k] = (sums[k] ?? 0) + v; };
  const held = {};
  for (const h of db.prepare('SELECT account_id, type, subtype, name, value v FROM holdings').all())
    (held[h.account_id] ??= []).push(h);
  for (const a of db.prepare("SELECT id, type, subtype, balance FROM accounts WHERE type NOT IN ('credit','loan') AND in_networth = 1").all()) {
    if (held[a.id]) { // holdings known: split by security type; anything the holdings don't cover counts as cash
      let sum = 0;
      for (const h of held[a.id]) { add(holdingKind(h), h.v); sum += h.v; }
      if (a.balance - sum > 1) add('Cash', a.balance - sum);
    } else {
      add(a.type === 'depository' ? 'Cash' : a.type === 'investment' ? 'Investments (no detail)' : 'Other', a.balance);
    }
  }
  for (const m of db.prepare("SELECT kind, value FROM manual_assets WHERE kind != 'liability'").all()) add(MANUAL_LABEL[m.kind] ?? 'Other', m.value);
  const total = Object.values(sums).reduce((s, v) => s + v, 0);
  const items = Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, share: (value / total) * 100 }));
  return { total, items };
}

// Plaid's predicted recurring bills and income over the next 45 days.
// Bills and recurring income due in the next `days` days (see recurring.js), skipping hidden and ended ones.
export function upcoming(days = 30, limit = 12) {
  const end = new Date(); end.setDate(end.getDate() + days);
  return bills().filter((b) => !b.hidden && !b.ended && !b.unscheduled && b.next_date && b.next_date <= iso(end) && b.amount >= 0.5).slice(0, limit);
}

// For tests only.
export const _test = { tidy };

// Dashboard investments card: total value, gain where the provider reports cost basis, and the mix by holding kind.
const RETIRE = /401|403|457|ira|roth|pension|keogh|retirement|sarsep|profit sharing|hsa/i;
export function investmentSummary() {
  const rows = db.prepare(`SELECT h.*, a.subtype account_subtype FROM holdings h JOIN accounts a ON a.id = h.account_id WHERE a.in_networth = 1`).all();
  const total = rows.reduce((s, h) => s + h.value, 0);
  const known = rows.filter((h) => h.cost_basis != null && holdingKind(h) !== 'Cash');
  const cost = known.reduce((s, h) => s + h.cost_basis, 0), knownValue = known.reduce((s, h) => s + h.value, 0);
  const kinds = {};
  for (const h of rows) kinds[holdingKind(h)] = (kinds[holdingKind(h)] ?? 0) + h.value;
  return {
    total, positions: new Set(rows.map((h) => h.ticker ?? h.name)).size,
    gain: cost ? knownValue - cost : null, gainPct: cost ? ((knownValue - cost) / cost) * 100 : null, gainOn: knownValue,
    taxAdvantaged: rows.filter((h) => RETIRE.test(h.account_subtype ?? '')).reduce((s, h) => s + h.value, 0),
    kinds: Object.entries(kinds).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}
