// End-to-end tests through the HTTP routes (the same requests the pages send), against the in-memory database.
// These catch the bugs unit tests can't: a page sending a field the route rejects, a route that doesn't load, etc.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const express = (await import('express')).default;
const routers = await Promise.all(['data', 'plan', 'system', 'trips', 'reports'].map((r) => import(`../server/routes/${r}.js`)));
const { classify } = await import('../server/categories.js');
const link = await import('../server/routes/link.js');

let server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  for (const r of routers) app.use('/api', r.default);
  app.use('/api/link', link.default);
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const get = (p) => call('GET', p), post = (p, b) => call('POST', p, b), put = (p, b) => call('PUT', p, b), patch = (p, b) => call('PATCH', p, b), del = (p) => call('DELETE', p);

beforeEach(() => {
  reset();
  for (const t of ['goals', 'budget_groups', 'budget_overrides', 'budget_rollover', 'meta', 'watchlist']) db.prepare(`DELETE FROM ${t}`).run();
  bank('b1'); account('chk', { balance: 2500 }); account('card', { type: 'credit', subtype: 'credit card' });
  bank('v', 'Venmo - Personal'); account('ven', { item: 'v' });
});

// ---------- Investments: contributions from your pay ----------
test('investments: contributions from your pay are listed per account', async () => {
  const { saveInvestmentTransactions } = await import('../server/contributions.js');
  account('k401', { type: 'investment', subtype: '401k', name: 'Acme Corp 401(k)' });
  const day = new Date().toLocaleDateString('en-CA');
  saveInvestmentTransactions(['k401'], day, [{ investment_transaction_id: 'c1', account_id: 'k401', date: day, amount: -750, type: 'cash', subtype: 'contribution' }]);
  const { status, body } = await get('/investments/contributions');
  assert.equal(status, 200);
  assert.equal(body.last12, 750);
  assert.deepEqual(body.accounts.map((a) => [a.name, a.last.amount]), [['Acme Corp 401(k)', 750]]);
});

// ---------- Goals ----------
test('goals: add, edit a goal that follows an account (the form sends an empty "saved"), remove', async () => {
  const { body: { id } } = await post('/goals', { name: 'Emergency', target: 2000, account_id: 'chk' });
  // The edit form hides "Saved so far" for a linked goal but used to send it empty, which was rejected.
  let r = await patch(`/goals/${id}`, { name: 'Rainy day', target: 3000, account_id: 'chk', target_date: '2027-06-30', saved: '' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const [g] = (await get('/goals')).body;
  assert.equal(g.name, 'Rainy day');
  assert.equal(g.saved, 2500); // follows the account
  assert.equal(g.target_date, '2027-06-30');
  r = await patch(`/goals/${id}`, { target: 0 });
  assert.equal(r.status, 400);
  await del(`/goals/${id}`);
  assert.equal((await get('/goals')).body.length, 0);
});

test('goals: a reached goal says when (from the balance history, or the day you entered the amount)', async () => {
  const { iso } = await import('../server/summary.js');
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  db.prepare('DELETE FROM balance_snapshots').run();
  for (let n = 60; n >= 0; n--) db.prepare('INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(ago(n), 'chk', n > 20 ? 1500 : 2500);
  await post('/goals', { name: 'Crossed', target: 2000, account_id: 'chk' });
  await post('/goals', { name: 'Always over', target: 1000, account_id: 'chk' });
  await post('/goals', { name: 'Not yet', target: 5000, account_id: 'chk' });
  const [crossed, always, notYet] = (await get('/goals')).body;
  assert.equal(crossed.reached, ago(20)); // the first day at or over the target
  assert.equal(always.reached, null); // already over when the history starts: unknown
  assert.equal('reached' in notYet, false);
  db.prepare('DELETE FROM balance_snapshots').run();

  // A goal you enter amounts for remembers the day the amount reached the target, until it drops back below.
  const { body: { id } } = await post('/goals', { name: 'Manual', target: 400, saved: 500 });
  const manual = async () => (await get('/goals')).body.find((g) => g.id === id);
  assert.equal((await manual()).reached, iso(new Date()));
  await patch(`/goals/${id}`, { saved: 100 });
  assert.equal('reached' in await manual(), false);
  await patch(`/goals/${id}`, { saved: 450 });
  assert.equal((await manual()).reached, iso(new Date()));
});

test('goal ideas answer even with no history', async () => {
  const { status, body } = await get('/goals/ideas');
  assert.equal(status, 200);
  assert.equal(body.emergency3, null);
});

// ---------- Budgets ----------
test('budget a group as one amount, refuse a category inside it, split it back, clear', async () => {
  await put('/budgets/Groceries', { amount: 300 });
  await put('/budgets/Restaurants', { amount: 200 });
  let r = await put('/budget-groups/Food', { whole: true });
  assert.equal(r.body.amount, 500); // the categories added up
  r = await put('/budgets/Coffee', { amount: 20 });
  assert.equal(r.status, 400); // Food is one amount now
  let b = (await get('/budget?month=2026-10')).body;
  assert.equal(b.expenses.find((g) => g.group === 'Food').budget, 500);
  r = await post('/budgets/clear', { groups: ['Food'] });
  assert.equal(r.body.removed, 1);
  b = (await get('/budget?month=2026-10')).body;
  assert.equal(b.expenses.find((g) => g.group === 'Food').groupBudget, null);
  await put('/budget-groups/Food', { whole: false });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM budget_groups').get().n, 0);
  r = await post('/budgets/clear', {});
  assert.equal(r.status, 200);
});

// ---------- Transactions and payments with people ----------
test('"Always for <person>" makes one rule for every payment with them', async () => {
  const a = tx('ven', '2026-09-01', 20, 'Sam Lee "🪨"', { primary: 'OTHER' });
  const b = tx('ven', '2026-09-08', 20, 'Sam Lee "rocks"', { primary: 'OTHER' });
  classify();
  const r = await patch(`/transactions/${a}`, { category: 'Fitness', person: true });
  assert.equal(r.status, 200);
  assert.equal(row(b).category, 'Fitness');
  assert.equal(db.prepare('SELECT pattern FROM category_rules').get().pattern, 'Sam Lee "');
});

test('renaming a merchant changes the name shown (list and CSV) for every row with it; an empty name restores it', async () => {
  db.prepare('DELETE FROM merchant_names').run();
  const a = tx('chk', '2026-09-01', 12, 'DIRECT DEBIT ACME PAYMNT 123456789', { primary: 'GENERAL_SERVICES' });
  const b = tx('chk', '2026-09-08', 12, 'DIRECT DEBIT ACME PAYMNT 987654321', { primary: 'GENERAL_SERVICES' });
  const shown = async (id) => (await get('/transactions')).body.find((t) => t.id === id).display;
  const before = await shown(a);
  assert.equal((await put('/merchant-names', { from: before, to: 'Acme Corp' })).status, 200);
  assert.equal(await shown(a), 'Acme Corp');
  assert.equal(row(a).name.includes('PAYMNT'), true); // the raw name (used for categorizing) is untouched
  assert.equal(await shown(b), 'Acme Corp'); // same cleaned name
  assert.equal((await put('/merchant-names', { from: before, to: '' })).status, 200);
  assert.equal(await shown(a), before);
  assert.equal((await put('/merchant-names', { from: '', to: 'x' })).status, 400);
});

test('recategorizing returns the rule it made; deleting the rule, or clearing a one-off, undoes it', async () => {
  const a = tx('card', '2026-09-01', 30, 'CORNER STORE 1', { primary: 'GENERAL_MERCHANDISE' });
  classify();
  const was = row(a).category;
  let r = await patch(`/transactions/${a}`, { category: 'Groceries', all: false });
  assert.equal(r.body.rule, null);
  assert.equal(row(a).category, 'Groceries');
  assert.equal((await patch(`/transactions/${a}`, { clear: true })).status, 200);
  assert.equal(row(a).category, was);
  r = await patch(`/transactions/${a}`, { category: 'Groceries', all: true });
  assert.equal(typeof r.body.rule, 'number');
  assert.equal(row(a).category, 'Groceries');
  await del(`/rules/${r.body.rule}`);
  assert.equal(row(a).category, was);
});

test('money a friend sent back counts against the charge it paid back; undo restores it', async () => {
  const charge = tx('card', '2026-09-01', 90, 'CINEMA TICKETS', { primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES' });
  const back = tx('ven', '2026-09-03', -30, 'Riley Brooks "🍿"', { primary: 'OTHER' });
  db.prepare("UPDATE items SET created_at = '2026-09-30'").run();
  classify();
  const people = (await get('/review/people')).body;
  assert.equal(people.items[0].candidates[0].id, charge);
  assert.equal(people.items[0].candidates[0].split, 3);
  await post(`/transactions/${back}/paidback`, { charge });
  assert.equal(row(back).category, 'Entertainment');
  await post(`/transactions/${back}/paidback`, { charge: null });
  assert.equal(row(back).category, 'Payment apps');
  assert.equal((await post(`/transactions/${back}/paidback`, { charge: 'nope' })).status, 400);
});

test('a payback can be linked from its details to a charge months earlier; refunds show what they reverse', async () => {
  const cabin = tx('card', '2026-06-20', 900, 'ACME CABINS', { primary: 'TRAVEL', merchant: 'Acme Cabins' });
  const back = tx('ven', '2026-08-30', -150, 'Alex Rivera "Cabin"', { primary: 'OTHER' });
  const booking = tx('card', '2026-08-01', 310, 'ACME TRAVEL', { primary: 'TRAVEL', merchant: 'Acme Travel' });
  const refund = tx('card', '2026-09-02', -310, 'ACME TRAVEL', { primary: 'TRAVEL', merchant: 'Acme Travel' });
  classify();
  const picks = (await get(`/transactions/${back}/paidback`)).body;
  assert.equal(picks.charge, null);
  assert.equal(picks.candidates[0].id, cabin); // splits evenly (÷ 6), 71 days before
  await post(`/transactions/${back}/paidback`, { charge: cabin });
  const rows = (await get('/transactions?limit=50')).body;
  const by = (id) => rows.find((r) => r.id === id);
  assert.equal(by(back).peer, true);
  assert.equal(by(back).counts_on, '2026-06-20');
  assert.equal(by(cabin).repaid, 150);
  assert.equal(by(refund).refund_name, 'Acme Travel');
  assert.equal(by(booking).refunded, 310);
  assert.equal((await get(`/transactions/${back}/paidback`)).body.charge, cabin);
  assert.equal((await get(`/transactions/${booking}/paidback`)).status, 404); // a charge, not money in
});

test('review lists skip anything older than 3 months before the first connection', async () => {
  tx('ven', '2026-01-10', 25, 'Alex Rivera "?"', { primary: 'OTHER' });
  tx('ven', '2026-09-10', 25, 'Alex Rivera "!"', { primary: 'OTHER' });
  db.prepare("UPDATE items SET created_at = '2026-09-30'").run();
  classify();
  assert.equal((await get('/review/people')).body.count, 1);
  const todo = (await get('/todo')).body;
  assert.equal(todo.find((t) => t.key === 'people').count, 1);
});

// ---------- Trips ----------
test('trips: add, rename, move a purchase on and off, delete; home bases validate', async () => {
  const t = tx('card', '2026-09-08', 40, 'DINER', { primary: 'FOOD_AND_DRINK' });
  let r = await post('/trips', { name: 'Coast', start: '2026-09-07', end: '2026-09-09' });
  const id = r.body.id;
  assert.equal((await post('/trips', { name: 'Bad', start: '2026-09-09', end: '2026-09-01' })).status, 400);
  await patch(`/trips/${id}`, { name: 'Coast weekend' });
  await post(`/transactions/${t}/trip`, { trip: id });
  assert.equal(row(t).trip_id, id);
  await post(`/transactions/${t}/trip`, { trip: 'none' });
  assert.equal(row(t).trip_id, null);
  const list = (await get('/trips')).body;
  assert.equal(list.trips[0].name, 'Coast weekend');
  await del(`/trips/${id}`);
  assert.equal((await get('/trips')).body.trips.length, 0);
  r = await put('/home-bases', [{ city: 'Denver', region: 'co', since: '2026-01-01', until: '2025-01-01' }]);
  assert.equal(r.status, 400); // ends before it starts
  r = await put('/home-bases', [{ city: 'Denver', region: 'co', since: '2026-01-01' }]);
  assert.equal(r.body.home[0].region, 'CO');
  assert.equal((await put('/settings/travel', { mode: 'state' })).body.mode, 'state');
});

// ---------- Paychecks ----------
test('answering "how often are you paid?" adds recurring income that sets payday', async () => {
  const recent = new Date(Date.now() - 10 * 864e5).toLocaleDateString('en-CA'); // inside the 45-day window, whatever today is
  tx('chk', recent, -3000, 'DIRECT DEPOSIT ACME CORP, INCDIR DEP (Cash)', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const [c] = (await get('/bills/paychecks')).body;
  assert.ok(c, 'a paycheck to ask about');
  assert.equal((await post('/bills/paychecks', { key: c.key, cadence: 'sometimes' })).status, 400);
  assert.equal((await post('/bills/paychecks', { key: c.key, cadence: 'biweekly' })).status, 200);
  assert.equal((await get('/bills/paychecks')).body.length, 0);
  const income = (await get('/bills')).body.filter((b) => b.direction === 'in');
  assert.equal(income.length, 1);
  assert.equal(income[0].schedule, 'every 2 weeks');
  assert.equal(income[0].category, 'Salary');
  assert.ok(income[0].name.endsWith('paycheck'));
  assert.notEqual(income[0].source, 'manual', 'the schedule goes on the deposits themselves, so a later pattern is the same bill');
});

test('bills from a payment: "this repeats" schedules it; bad input is refused', async () => {
  tx('chk', new Date(Date.now() - 300 * 864e5).toLocaleDateString('en-CA'), 480, 'ACME INSURANCE', { primary: 'GENERAL_SERVICES', detailed: 'GENERAL_SERVICES_INSURANCE' });
  classify();
  const id = db.prepare("SELECT id FROM transactions WHERE name = 'ACME INSURANCE'").get().id;
  assert.equal((await post('/bills/from-payment', { id: 'nope', cadence: 'yearly' })).status, 404);
  assert.equal((await post('/bills/from-payment', { id, cadence: 'sometimes' })).status, 400);
  const r = await post('/bills/from-payment', { id, cadence: 'yearly', name: 'Car insurance' });
  assert.equal(r.status, 200);
  const b = (await get('/bills')).body.find((x) => x.key === r.body.key);
  assert.equal(b.name, 'Car insurance');
  assert.equal(b.frequency, 'Yearly');
  assert.equal((await get('/transactions')).body.find((t) => t.id === id).recurring, true, 'its payments get the repeat marker');
});

// ---------- Everything loads ----------
test('every page\'s GET routes answer without errors on an empty database', async () => {
  for (const p of ['/summary', '/networth', '/transactions?summary=1', '/categories/all', '/review', '/review/people', '/todo', '/bills',
    '/coverage', '/safe-to-spend', '/insights', '/watchlist', '/budgets', '/budget', '/goals', '/goals/ideas', '/trips', '/flow', '/cashflow', '/rules']) {
    const r = await get(p);
    assert.equal(r.status, 200, `${p}: ${JSON.stringify(r.body).slice(0, 200)}`);
  }
});

// ---------- Splitting ----------
test('split a purchase into categories: totals count each part once; undo restores it', async () => {
  const t = tx('card', '2026-10-02', 150, 'WAREHOUSE CLUB', { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_SUPERSTORES' });
  classify();
  assert.equal((await post(`/transactions/${t}/split`, { parts: [{ amount: 100, category: 'Groceries' }, { amount: 40, category: 'Shopping' }] })).status, 400); // 140 ≠ 150
  assert.equal((await post(`/transactions/${t}/split`, { parts: [{ amount: 150, category: 'Groceries' }] })).status, 400); // one part
  let r = await post(`/transactions/${t}/split`, { parts: [{ amount: 100, category: 'Groceries' }, { amount: 50, category: 'Shopping' }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const b = (await get('/budget?month=2026-10')).body;
  const cat = (name) => b.expenses.flatMap((g) => g.categories).find((c) => c.category === name);
  assert.equal(cat('Groceries').actual, 100);
  assert.equal(cat('Shopping').actual, 50);
  assert.equal(b.totals.expensesActual, 150); // not 300
  const list = (await get('/transactions?summary=1')).body;
  assert.equal(list.rows.length, 1); // the original, with its parts attached
  assert.equal(list.rows[0].shown, 'Split');
  assert.deepEqual(list.rows[0].parts.map((p) => [p.category, p.amount]), [['Groceries', 100], ['Shopping', 50]]);
  assert.equal(list.summary.spent, 150);
  assert.equal((await get('/transactions?category=Groceries')).body.length, 1); // found by its part
  await del(`/transactions/${t}/split`);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM transactions WHERE split_of IS NOT NULL').get().n, 0);
  assert.equal(row(t).category, 'Shopping');
});

// ---------- Budget: one month only, and rollover ----------
test('an amount for one month only, then back to the usual amount', async () => {
  await put('/budgets/Gifts%20%26%20donations', { amount: 50 });
  await put('/budgets/Gifts%20%26%20donations', { amount: 400, month: '2026-12' });
  const cat = async (m) => (await get(`/budget?month=${m}`)).body.expenses.flatMap((g) => g.categories).find((c) => c.category === 'Gifts & donations');
  assert.deepEqual([(await cat('2026-12')).budget, (await cat('2026-12')).overridden, (await cat('2026-12')).usual], [400, true, 50]);
  assert.equal((await cat('2026-11')).budget, 50);
  await put('/budgets/Gifts%20%26%20donations', { amount: '', month: '2026-12' });
  assert.equal((await cat('2026-12')).budget, 50);
});

test('rollover carries unspent money forward (overspending reduces it)', async () => {
  await put('/budgets/Fees', { amount: 10 });
  await put('/budget-rollover/Fees', { on: true, since: '2026-08' });
  tx('card', '2026-09-03', 25, 'BANK FEE', { primary: 'BANK_FEES' }); // August: +10 unspent; September: 10 − 25 = −15
  classify();
  const fees = (await get('/budget?month=2026-10')).body.expenses.flatMap((g) => g.categories).find((c) => c.category === 'Fees');
  assert.equal(fees.rollover, true);
  assert.equal(fees.carry, -5);
  assert.deepEqual(fees.carryHistory.map((h) => [h.month, h.left]), [['2026-08', 10], ['2026-09', -15]]);
  await put('/budget-rollover/Fees', { on: false });
  const off = (await get('/budget?month=2026-10')).body.expenses.flatMap((g) => g.categories).find((c) => c.category === 'Fees');
  assert.equal(off.carry, 0);
});

// ---------- Close the month ----------
test('closing out last month: the prompt goes away, only that is recorded, and it never moves back', async () => {
  const d = new Date(), ym = (k) => new Date(d.getFullYear(), d.getMonth() + k, 1).toLocaleDateString('en-CA').slice(0, 7);
  const [now, last, before] = [ym(0), ym(-1), ym(-2)];
  await put('/budgets/Groceries', { amount: 300 });
  tx('card', `${last}-08`, 420, 'ACME GROCERY', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  classify();
  const tables = () => ['budgets', 'budget_groups', 'budget_overrides', 'budget_rollover'].map((t) => db.prepare(`SELECT * FROM ${t}`).all());
  const strip = ({ closed, ...b }) => b;
  const was = { tables: tables(), last: (await get(`/budget?month=${last}`)).body, now: (await get(`/budget?month=${now}`)).body };
  assert.equal(was.last.closed, false); // not closed yet: the page offers "Close out"
  // Skipping it changes nothing: just looking leaves no trace.
  assert.equal(db.prepare("SELECT COUNT(*) n FROM meta WHERE key = 'closed_month'").get().n, 0);

  assert.equal((await post('/budget/close', { month: now })).status, 400); // this month isn't finished
  assert.equal((await post('/budget/close', { month: 'last' })).status, 400);
  const r = await post('/budget/close', { month: last });
  assert.equal(r.status, 200);
  assert.equal(r.body.closed_month, last);
  const after = { last: (await get(`/budget?month=${last}`)).body, now: (await get(`/budget?month=${now}`)).body };
  assert.equal(after.last.closed, true); // the prompt goes away
  assert.equal((await get(`/budget?month=${before}`)).body.closed, true); // and earlier months count as closed too
  assert.equal(after.now.closed, false);
  // Closing records the month and nothing else: budgets and the numbers are as they were.
  assert.deepEqual(tables(), was.tables);
  assert.deepEqual(strip(after.last), strip(was.last));
  assert.deepEqual(strip(after.now), strip(was.now));

  // Closing an earlier month afterwards doesn't move it back.
  assert.equal((await post('/budget/close', { month: before })).body.closed_month, last);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'closed_month'").get().value, last);
});

// ---------- Trips in the budget, rules, the "unsure" filter ----------
test('leave confirmed trips out of budget categories', async () => {
  const t = tx('card', '2026-10-03', 80, 'SEASIDE GRILL', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  tx('card', '2026-10-05', 20, 'LOCAL CAFE', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  classify();
  const { body: { id } } = await post('/trips', { name: 'Coast', start: '2026-10-02', end: '2026-10-04' });
  await post(`/transactions/${t}/trip`, { trip: id });
  const restaurants = async () => (await get('/budget?month=2026-10')).body.expenses.flatMap((g) => g.categories).find((c) => c.category === 'Restaurants').actual;
  assert.equal(await restaurants(), 100);
  await put('/settings/budget-trips', { on: false });
  assert.equal(await restaurants(), 20);
  assert.equal((await get('/budget?month=2026-10')).body.trips.left_out, 80);
  await put('/settings/budget-trips', { on: true });
});

test('a rule can be pointed at another category', async () => {
  const t = tx('chk', '2026-09-01', 30, 'GYM CO', { primary: 'GENERAL_SERVICES' });
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('GYM CO', 'Services')").run();
  classify();
  const [r] = (await get('/rules')).body;
  await patch(`/rules/${r.id}`, { category: 'Fitness' });
  assert.equal(row(t).category, 'Fitness');
  assert.equal((await patch(`/rules/${r.id}`, { category: 'Nope' })).status, 400);
});

test('"Plaid wasn\'t sure" lists recent low-confidence guesses only', async () => {
  const recent = tx('card', '2026-09-20', 12, 'MYSTERY SHOP', { primary: 'GENERAL_MERCHANDISE' });
  const old = tx('card', '2025-01-20', 12, 'MYSTERY SHOP', { primary: 'GENERAL_MERCHANDISE' });
  db.prepare("UPDATE transactions SET pfc_confidence = 'LOW'").run();
  db.prepare("UPDATE items SET created_at = '2026-09-30'").run();
  classify();
  const ids = (await get('/transactions?category=unsure')).body.map((t) => t.id);
  assert.deepEqual(ids, [recent]);
  assert.ok(!ids.includes(old));
});

test('deleting a suggested trip dismisses it, so it is not suggested again', async () => {
  const { lastInsertRowid: id } = db.prepare("INSERT INTO trips (name, start, end, status, source) VALUES ('Somewhere trip', '2026-09-01', '2026-09-03', 'confirmed', 'auto')").run();
  await del(`/trips/${id}`);
  assert.equal(db.prepare('SELECT status FROM trips WHERE id = ?').get(id).status, 'dismissed');
});

test('free to spend: cash + income still coming − bills due − card balances − cushion', async () => {
  db.prepare("UPDATE accounts SET balance = 400 WHERE id = 'card'").run();
  const today = new Date().toLocaleDateString('en-CA');
  const last = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(0, 10);
  if (today === last) return; // nothing left of the month to test with
  db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, rule, amount_mode, amount) VALUES ('man:1', 1, 'Gym', 'out', ?, 'fixed', 100)`)
    .run(JSON.stringify({ kind: 'dom', n: +last.slice(8), roll: 0 }));
  await put('/settings/cushion', { amount: 500 });
  const d = (await get('/safe-to-spend')).body;
  assert.equal(d.cash, 2500);
  assert.equal(d.owed, 400);
  assert.equal(d.dueTotal, 100);
  assert.equal(d.free, 2500 - 100 - 400 - 500);
});

test('dismissing a "Booked before the trip?" suggestion stops it being suggested', async () => {
  const flight = tx('card', '2026-08-20', 300, 'AIRLINE', { primary: 'TRAVEL', detailed: 'TRAVEL_FLIGHTS' });
  classify();
  const { body: { id } } = await post('/trips', { name: 'Coast', start: '2026-09-07', end: '2026-09-09' });
  const bookings = async () => (await get('/trips')).body.trips.find((t) => t.id === id).bookings.map((b) => b.id);
  assert.deepEqual(await bookings(), [flight]);
  await post(`/transactions/${flight}/trip`, { trip: 'none' });
  assert.deepEqual(await bookings(), []);
});

test('getting started: steps tick off from the data; "looks right" and hide stick', async () => {
  let s = (await get('/setup')).body;
  const step = (k) => s.steps.find((x) => x.key === k);
  assert.equal(step('banks').done, true); // a bank is connected in these tests
  assert.equal(step('banks').href, '#/networth'); // banks are connected on the merged Accounts & net worth page
  assert.equal(step('budget').done, false);
  await put('/budgets/Groceries', { amount: 300 });
  await post('/setup/home-ok');
  s = (await get('/setup')).body;
  assert.equal(step('budget').done, true);
  assert.equal(step('home').done, true);
  await post('/setup/dismiss');
  assert.equal((await get('/setup')).body.dismissed, true);
  assert.equal((await post('/setup/bogus')).status, 404);
});

// ---------- Reports ----------
test('reports: month by month, subscriptions with price changes, year in review', async () => {
  // Dates follow the calendar from today: a monthly charge more than a few days late counts as ended, so fixed
  // 2026 dates would stop being a live subscription once the test runs past them.
  const now = new Date();
  const ym = (k) => new Date(now.getFullYear(), now.getMonth() + k, 1).toLocaleDateString('en-CA').slice(0, 7);
  const [m2, m1, m0] = [ym(-2), ym(-1), ym(0)];
  const flix = [[`${m2}-01`, 10.99], [`${m1}-01`, 10.99], [`${m0}-01`, 12.99]];
  for (const [d, a] of flix)
    tx('card', d, a, 'STREAMFLIX', { primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES', merchant: 'Streamflix' });
  tx('card', `${m1}-05`, 80, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('chk', `${m1}-01`, -3000, 'ACME PAYROLL', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const m = (await get('/reports/months?months=6')).body;
  assert.ok(m.months.length <= 6 && m.months.includes(m1)); // starts at the history cap
  const food = m.groups.find((g) => g.group === 'Food');
  assert.equal(food.values[m.months.indexOf(m1)], 80);
  assert.equal(m.groups.find((g) => g.income).values[m.months.indexOf(m1)], 3000);
  const s = (await get('/reports/subscriptions')).body;
  const sub = s.items.find((x) => /Streamflix/i.test(x.name));
  assert.ok(sub, 'the streaming charge is a subscription');
  assert.deepEqual([sub.change?.from, sub.change?.to], [10.99, 12.99]);
  const year = now.getFullYear();
  const y = (await get(`/reports/year?year=${year}`)).body;
  const spent = [...flix, [`${m1}-05`, 80]].filter(([d]) => d.startsWith(String(year))).reduce((t, [, a]) => t + a, 0);
  assert.equal(Math.round(y.spending), Math.round(spent));
  assert.ok(y.years.includes(year));
});

test('year at a glance: every month of the year, each day on the month spread\'s dot scale, nothing for days ahead', async () => {
  const today = new Date().toLocaleDateString('en-CA'), year = +today.slice(0, 4), month = today.slice(0, 7);
  tx('chk', today, 42.5, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('chk', today, -500, 'TRANSFER IN', { primary: 'TRANSFER_IN' }); // not spending
  classify();
  const y = (await get(`/reports/year?year=${year}`)).body;
  assert.deepEqual(y.glance.map((g) => g.m), Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`));
  const g = y.glance.find((x) => x.m === month);
  assert.equal(g.steps.length, new Date(year, +month.slice(5), 0).getDate());
  const spread = (await get(`/month-spread?month=${month}`)).body;
  assert.deepEqual(g.steps, spread.days.map((d) => d.step)); // the same scale and days as the dashboard's spread
  assert.equal(g.steps[+today.slice(8) - 1], 3);
  for (const later of y.glance.filter((x) => x.m > month)) { assert.equal(later.future, true); assert.ok(later.steps.every((s) => s === null)); }
});

test('a bank with only investment accounts does not make spending months incomplete', async () => {
  tx('chk', '2026-06-01', 10, 'SHOP', { primary: 'GENERAL_MERCHANDISE' });
  bank('broker', 'Brokerage'); account('ira', { item: 'broker', type: 'investment', subtype: 'ira' });
  tx('ira', '2026-09-30', -5, 'DIVIDEND', { primary: 'INCOME', detailed: 'INCOME_DIVIDENDS' });
  classify();
  assert.equal((await get('/coverage')).body.start, '2026-06-01');
});

test('net worth: an investment account with no history yet shows when tracking started, not "no change"', async () => {
  bank('broker', 'Brokerage'); account('ira', { item: 'broker', type: 'investment', subtype: 'ira', balance: 5000 });
  tx('chk', '2026-08-01', 10, 'SHOP', { primary: 'GENERAL_MERCHANDISE' });
  const ira = (await get('/networth')).body.accounts.find((a) => a.id === 'ira');
  assert.equal(ira.change, null);
  assert.ok(ira.tracking_since);
  const chk = (await get('/networth')).body.accounts.find((a) => a.id === 'chk');
  assert.notEqual(chk.change, null); // bank balances are worked out from transactions
});

test('net worth breakdown: saved (income − spending), moved to untracked accounts and market and other add up to the change', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  bank('broker', 'Brokerage'); account('ira', { item: 'broker', type: 'investment', subtype: 'ira', balance: 1100 });
  db.prepare("UPDATE accounts SET balance = 2400 WHERE id = 'chk'").run();
  db.prepare("UPDATE accounts SET balance = 0 WHERE id = 'card'").run();
  for (const [d, chk, ira] of [[y, 2500, 1000], [today, 2400, 1100]])
    for (const [a, v] of [['chk', chk], ['ira', ira], ['card', 0], ['ven', 0]]) db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(d, a, v);
  tx('chk', today, 100, 'SHOP', { primary: 'GENERAL_MERCHANDISE' });
  classify();
  let b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(b.available, true);
  assert.equal(Math.round(b.change), 0); // −100 checking, +100 IRA
  assert.equal(Math.round(b.saved), -100);
  assert.equal(Math.round(b.market), 100);
  assert.equal(Math.round(b.moved), 0);

  // $2,800 from checking to a brokerage that isn't linked, filed under Investments: it left net worth but is still
  // yours, so it's "moved", not market.
  const snap = (d, a, v) => db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(d, a, v);
  snap(y, 'chk', 5300);
  const out = tx('chk', today, 2800, 'TRANSFER TO ACME BROKERAGE', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS' });
  db.prepare("UPDATE transactions SET user_category = 'Investments' WHERE id = ?").run(out);
  classify();
  b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(Math.round(b.change), -2800);
  assert.equal(Math.round(b.saved), -100);
  assert.equal(Math.round(b.moved), -2800);
  assert.equal(Math.round(b.market), 100); // unchanged
  assert.equal(Math.round(b.saved + b.moved + b.market), Math.round(b.change));
  assert.deepEqual(b.movedItems.map((t) => [t.date, t.amount]), [[today, -2800]]);

  // The same transfer arriving in a linked account pairs with it: nothing left net worth.
  db.prepare('UPDATE transactions SET user_category = NULL WHERE id = ?').run(out);
  tx('ira', today, -2800, 'TRANSFER FROM CHECKING', { primary: 'TRANSFER_IN' });
  snap(today, 'ira', 3900);
  classify();
  assert.ok(row(out).transfer_pair);
  b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(Math.round(b.change), 0);
  assert.equal(Math.round(b.moved), 0);
  assert.equal(Math.round(b.market), 100);
  assert.equal(Math.round(b.saved + b.moved + b.market), Math.round(b.change));
  // The IRA went up $2,900, but $2,800 of that was your own money: its market row says +$100, not +$2,900.
  const ira = b.investments.find((a) => a.name === 'ira' || a.name === 'Brokerage' || a.added);
  assert.deepEqual([Math.round(ira.change), Math.round(ira.added)], [100, 2800]);

  // Seen only from checking, naming the IRA by its number: still money you moved in, not a gain.
  db.prepare('DELETE FROM transactions WHERE account_id = ?').run('ira');
  db.prepare("UPDATE transactions SET transfer_pair = NULL, transfer_account = 'ira' WHERE id = ?").run(out);
  b = (await get('/networth/breakdown?period=all')).body;
  const ira2 = b.investments.find((a) => Math.abs(a.added) > 0);
  assert.deepEqual([Math.round(ira2.change), Math.round(ira2.added)], [100, 2800]);

  // A pending refund isn't in the card's balance yet, so it isn't "saved" yet either (it would leave −$450 in market).
  const before = b;
  const p = tx('card', today, -450, 'TRAVEL CO REFUND', { primary: 'TRAVEL' });
  db.prepare('UPDATE transactions SET pending = 1 WHERE id = ?').run(p);
  classify();
  db.prepare("UPDATE transactions SET transfer_pair = NULL, transfer_account = 'ira' WHERE id = ?").run(out); // as set above
  b = (await get('/networth/breakdown?period=all')).body;
  assert.deepEqual([Math.round(b.saved), Math.round(b.market)], [Math.round(before.saved), Math.round(before.market)]);
  db.prepare('DELETE FROM balance_snapshots').run();
});

test('estimated balances join up with the earliest real snapshot, not today\'s balance', async () => {
  const { accountHistory } = await import('../server/summary.js');
  const d = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA');
  db.prepare("UPDATE accounts SET balance = 13 WHERE id = 'chk'").run();
  db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(1), 'chk', 0); // yesterday: 0
  db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(0), 'chk', 13);
  tx('chk', d(10), 5, 'OLD PURCHASE', { primary: 'GENERAL_MERCHANDISE' });
  const h = accountHistory([db.prepare("SELECT * FROM accounts WHERE id = 'chk'").get()], 12).chk;
  const on = (n) => h.find((p) => p.date === d(n)).balance;
  assert.equal(on(2), 0); // from yesterday's real 0, not today's 13
  assert.equal(on(11), 5); // before the purchase, rewound from 0
  db.prepare('DELETE FROM balance_snapshots').run();
});

test('charts and reports start 3 months before the first connection unless you turn that off', async () => {
  db.prepare("UPDATE items SET created_at = '2026-09-30'").run();
  let h = (await get('/settings/history')).body;
  assert.deepEqual(h, { capped: true, start: '2026-06-30' });
  const months = async () => (await get('/reports/months?months=12')).body.months;
  assert.equal((await months())[0], '2026-06'); // from June (the month the cap falls in)
  h = (await put('/settings/history', { capped: false })).body;
  assert.equal(h.capped, false);
  assert.equal((await months()).length, 12);
  await put('/settings/history', { capped: true });
});

// ---------- The app: how it's running, starting at sign-in ----------
test('app: reports the mode, and Stop only works for the background copy', async () => {
  const r = await get('/app');
  assert.equal(r.body.mode, 'dev');
  assert.equal(typeof r.body.startup.supported, 'boolean');
  assert.equal((await post('/app/quit')).status, 400); // in development it must not exit the server
});

test('app: the sign-in command starts this folder\'s app with no window, detached from any console', async () => {
  const { startupCommand } = await import('../server/startup.js');
  const cmd = startupCommand(String.raw`C:\Users\Alex O'Neil\Mizo Money`, String.raw`C:\Program Files\nodejs\node.exe`);
  // No PowerShell window that Windows Terminal could show (and closing would stop Mizo Money).
  assert.equal(cmd, String.raw`conhost.exe --headless "C:\Program Files\nodejs\node.exe" "C:\Users\Alex O'Neil\Mizo Money\scripts\app.mjs" --background --log`);
});

// ---------- First run: Plaid keys, and Hosted Link ----------
test('setup: no keys yet means the first-run screen; saving needs both keys and never echoes the secret', async () => {
  const s = (await get('/link/setup')).body;
  assert.equal(s.configured, false);
  assert.equal(s.env, 'sandbox');
  assert.ok(!('secret' in s));
  for (const body of [{}, { client_id: 'abc' }, { client_id: ' ', secret: 'x' }]) {
    const r = await post('/link/setup', body);
    assert.equal(r.status, 400);
    assert.match(r.body.error_message, /client ID and the secret/);
  }
});

test('Hosted Link: a session is open, connected a bank, finished an update, or was left', () => {
  const { sessionResult } = link;
  assert.deepEqual(sessionResult({}), { done: false });
  assert.deepEqual(sessionResult({ link_sessions: [{ started_at: 'x' }] }), { done: false }); // still on Plaid's page
  assert.deepEqual(sessionResult({ link_sessions: [{ finished_at: 'x', results: { item_add_results: [{ public_token: 'public-1', institution: { name: 'Acme Bank' } }] } }] }),
    { done: true, public_token: 'public-1', institution: 'Acme Bank' });
  assert.deepEqual(sessionResult({ link_sessions: [{ finished_at: 'x', on_success: { public_token: 'public-2', metadata: { institution: { name: 'Acme Credit Union' } } } }] }),
    { done: true, public_token: 'public-2', institution: 'Acme Credit Union' });
  assert.deepEqual(sessionResult({ link_sessions: [{ finished_at: 'x', results: { item_update_results: [{ item_id: 'i' }] } }] }), { done: true });
  assert.deepEqual(sessionResult({ link_sessions: [{ finished_at: 'x', exit: { error: { display_message: 'The bank is down' } } }] }),
    { done: true, cancelled: true, error: 'The bank is down' });
  // Several attempts in one session: the last finished one counts.
  assert.deepEqual(sessionResult({ link_sessions: [{ finished_at: 'a', exit: {} }, { finished_at: 'b', results: { item_add_results: [{ public_token: 'public-3' }] } }] }),
    { done: true, public_token: 'public-3', institution: null });
});

test('app: the Start button\'s link is reported alongside starting at sign-in', async () => {
  const r = (await get('/app')).body;
  assert.deepEqual(Object.keys(r.launcher).sort(), ['enabled', 'here', 'supported']);
  assert.equal(typeof r.launcher.enabled, 'boolean');
});

test('banks list says whether a problem needs you (sign in) or not (error, with a reason)', async () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED' WHERE id = 'b1'").run();
  db.prepare("UPDATE items SET status = 'INSTITUTION_DOWN' WHERE id = 'v'").run();
  const items = Object.fromEntries((await get('/items')).body.items.map((i) => [i.id, i]));
  assert.equal(items.b1.state, 'sign-in');
  assert.equal(items.v.state, 'error');
  assert.match(items.v.reason, /bank isn't available/);
});

test('update notice: reports this version and never asks GitHub from tests', async () => {
  const u = (await get('/update')).body;
  assert.match(u.version, /^\d+\.\d+\.\d+$/);
  assert.equal(u.enabled, false); // WEALTHFLOW_UPDATE_CHECKS=0 in tests/helpers.js
  assert.equal(u.available, false);
  assert.equal((await post('/update/check')).status, 200);
});

test('bills: "Not a bill" works on a bill you never edited, including payments to a person with a note', async () => {
  const key = 'alex rivera "🏠 rent"|out';
  const r = await put(`/bills/${encodeURIComponent(key)}`, { hidden: true });
  assert.equal(r.status, 200, JSON.stringify(r.body)); // used to fail: no schedule saved yet
  assert.deepEqual(db.prepare('SELECT hidden, rule, name FROM bill_settings WHERE key = ?').get(key), { hidden: 1, rule: null, name: null });
  assert.equal((await put(`/bills/${encodeURIComponent(key)}`, { hidden: false })).status, 200);
});

test('accounts page: each account\'s activity this month and how far back its history goes', async () => {
  const month = new Date().toLocaleDateString('en-CA').slice(0, 7);
  tx('chk', `${month}-01`, -1200, 'ACME CORP PAYROLL', { primary: 'INCOME' });
  tx('chk', `${month}-01`, 80, 'GROCER');
  tx('chk', '2025-01-15', 20, 'OLD COFFEE');
  db.prepare("INSERT INTO transactions (id, account_id, date, name, amount, split_of) VALUES ('part', 'chk', ?, 'GROCER', 40, 'x')").run(`${month}-01`);
  const a = (await get('/accounts/activity')).body.chk;
  assert.deepEqual([a.month_in, a.month_out, a.n, a.first], [1200, 80, 3, '2025-01-15']); // the split part isn't counted twice
});

test('holdings: the day\'s change uses the last price recorded before this one, and the range covers the past year', async () => {
  bank('broker', 'Brokerage'); account('ira', { item: 'broker', type: 'investment', subtype: 'ira', balance: 1050 });
  const today = new Date().toLocaleDateString('en-CA'), ago = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA');
  db.prepare("INSERT INTO holdings (account_id, security_id, name, ticker, type, quantity, price, value, cost_basis, price_as_of) VALUES ('ira', 's1', 'Acme Index Fund', 'ACME', 'etf', 10, 105, 1050, 900, ?)").run(today);
  for (const [d, p] of [[ago(400), 50], [ago(30), 90], [ago(3), 100], [today, 105]])
    db.prepare("INSERT INTO holding_prices (security_id, date, price) VALUES ('s1', ?, ?)").run(d, p);
  const [h] = (await get('/holdings')).body.filter((x) => x.security_id === 's1');
  assert.deepEqual([h.prev_price, h.prev_date], [100, ago(3)]); // the weekend gap: the last price before today's
  assert.deepEqual([h.low, h.high, h.range_since], [90, 105, ago(30)]); // the one from 400 days ago is outside the year
  db.prepare("DELETE FROM holdings WHERE security_id = 's1'").run(); db.prepare('DELETE FROM holding_prices').run();
});

test('month spread: each day\'s spending on one fixed dot scale, with bills and paydays stamped, and nothing yet for days ahead', async () => {
  const { step } = await import('../server/spread.js');
  assert.deepEqual([0, 5, 29.99, 30, 200, 5000].map(step), [0, 1, 2, 3, 5, 7]); // fixed thresholds, not relative to the month
  const today = new Date().toLocaleDateString('en-CA'), month = today.slice(0, 7);
  tx('chk', today, 42.5, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('chk', today, -500, 'TRANSFER IN', { primary: 'TRANSFER_IN' }); // not spending
  classify();
  const s = (await get(`/month-spread?month=${month}`)).body;
  const d = s.days.find((x) => x.date === today);
  assert.equal(d.today, true);
  assert.equal(d.spent, 42.5);
  assert.equal(d.step, 3);
  assert.equal(s.days.length, new Date(+month.slice(0, 4), +month.slice(5), 0).getDate());
  for (const f of s.days.filter((x) => x.future)) assert.equal(f.spent, null);
});

test('month spread and replay: each stamp carries its bill\'s group and category (for its drawn icon), and whether it pays a card', async () => {
  const { kindOf } = await import('../server/spread.js');
  const { groupOf } = await import('../server/categories.js');
  assert.deepEqual(kindOf({ grp: 'Housing', category: 'Rent', card: null, can_card: false }), { grp: 'Housing', category: 'Rent', card: false });
  assert.equal(kindOf({ card: { due: '2026-01-05' } }).card, true); // a card statement
  assert.equal(kindOf({ can_card: true }).card, true); // a card payment's occurrence
  const today = new Date().toLocaleDateString('en-CA'), month = today.slice(0, 7);
  const last = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(0, 10);
  if (today === last) return; // nothing left of the month to test with
  db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, category, rule, amount_mode, amount) VALUES ('man:stamp', 1, 'Acme Gym', 'out', 'Fitness', ?, 'fixed', 40)`)
    .run(JSON.stringify({ kind: 'dom', n: +last.slice(8), roll: 0 }));
  try {
    for (const path of ['/month-spread', '/month-replay']) {
      const day = (await get(`${path}?month=${month}`)).body.days.find((x) => x.date === last);
      const m = day.marks.find((x) => x.name === 'Acme Gym');
      assert.ok(m, `${path}: the bill is stamped on its day`);
      assert.deepEqual([m.category, m.grp, m.card, m.done], ['Fitness', groupOf('Fitness'), false, false], path);
    }
  } finally { db.prepare("DELETE FROM bill_settings WHERE key = 'man:stamp'").run(); }
});

test('backup download: named after the app, keeps 5 downloaded copies, and never deletes the daily automatic backups', async () => {
  const fs = await import('node:fs'), path = await import('node:path');
  const dir = path.join(process.env.WEALTHFLOW_DATA_DIR, 'backups');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const autos = ['01', '02', '03', '04', '05', '06', '07'].map((d) => `auto-2026-01-${d}.db`);
  for (const f of autos) fs.writeFileSync(path.join(dir, f), '');
  for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(dir, `wealthflow-2025-0${i + 1}-01-12-00.db`), '');
  const r = await fetch(`${base}/backup/download`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /mizo-money-[\d-]+\.db/);
  await r.arrayBuffer();
  const left = fs.readdirSync(dir);
  for (const f of autos) assert.ok(left.includes(f), `${f} was deleted`);
  assert.equal(left.filter((f) => /^(mizo-money|wealthflow)-/.test(f)).length, 5);
  assert.ok(left.some((f) => f.startsWith('mizo-money-')));
  const csv = await fetch(`${base}/transactions.csv`);
  if (csv.status === 200) assert.match(csv.headers.get('content-disposition'), /mizo-money-transactions-/);
});

test('month replay: cash in everyday accounts each day, rewound from today\'s balance, flat ahead with nothing scheduled', async () => {
  account('sav', { subtype: 'savings', balance: 9999 }); // savings isn't everyday cash
  const today = new Date().toLocaleDateString('en-CA'), month = today.slice(0, 7);
  tx('chk', today, -500, 'PAYROLL ACME CORP', { primary: 'INCOME', detailed: 'INCOME_WAGES' });
  tx('chk', today, 42.5, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('card', today, 80, 'DINER'); // on a card: not cash yet
  classify();
  const r = (await get(`/month-replay?month=${month}`)).body;
  assert.ok(r.accounts.includes('chk') && !r.accounts.includes('sav') && !r.accounts.includes('card'));
  assert.equal(r.days.length, new Date(+month.slice(0, 4), +month.slice(5), 0).getDate());
  const i = r.days.findIndex((d) => d.today);
  assert.equal(r.days[i].cash, 2500);
  assert.equal(r.days[i].in, 500);
  assert.equal(r.days[i].out, 42.5);
  assert.equal(i > 0 ? r.days[i - 1].cash : r.start, 2042.5); // the day before: today's money in and out undone
  for (const d of r.days.filter((x) => x.future)) assert.equal(d.cash, 2500); // no paydays or bills scheduled
  assert.equal(r.low.cash, Math.min(...r.days.map((d) => d.cash).filter((c) => c != null)));
  assert.deepEqual((await get('/month-replay?month=2999-01')).body.days, []); // a month that hasn't started
});

test('month replay: each day\'s change splits into paydays, bills, savings, money moved in, spending and the rest, adding up exactly', async () => {
  account('brk', { type: 'investment', subtype: 'brokerage' });
  const today = new Date().toLocaleDateString('en-CA'), month = today.slice(0, 7);
  tx('chk', today, -3000, 'PAYROLL ACME CORP', { primary: 'INCOME', detailed: 'INCOME_WAGES' });
  tx('chk', today, 28000, 'TRANSFER TO BROKERAGE 9999', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS' });
  tx('chk', today, -28065.12, 'MONEY MARKET REDEMPTION', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS' });
  tx('chk', today, 300, 'PAYMENT TO CARD 3456', { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' });
  tx('card', today, -300, 'PAYMENT THANK YOU', { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' });
  tx('chk', today, 42.5, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('chk', today, -12.25, 'GROCER REFUND', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  classify();
  const r = (await get(`/month-replay?month=${month}`)).body;
  const i = r.days.findIndex((d) => d.today), d = r.days[i];
  const prev = i > 0 ? r.days[i - 1].cash : r.start;
  assert.equal(d.change, Math.round((d.cash - prev) * 100) / 100);
  const by = Object.fromEntries(d.parts.map((p) => [p.key, p.amount]));
  assert.deepEqual(d.parts.map((p) => p.key), ['payday', 'bill', 'saved', 'movedIn', 'spending']); // in the readout's order
  assert.deepEqual(by, { payday: 3000, bill: -300, saved: -28000, movedIn: 28065.12, spending: -30.25 });
  assert.equal(d.parts.find((p) => p.key === 'saved').top.name, 'TRANSFER TO BROKERAGE 9999');
  const sum = (ps) => Math.round(ps.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  assert.equal(sum(d.parts), d.change);

  // A balance the transactions don't explain (a snapshot) shows up as "Other changes", so the parts still add up.
  if (i > 0) {
    db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(r.days[i - 1].date, 'chk', 100);
    const d2 = (await get(`/month-replay?month=${month}`)).body.days[i];
    assert.equal(d2.change, 2500 - 100);
    assert.equal(d2.parts.at(-1).key, 'other');
    assert.equal(sum(d2.parts), d2.change);
    db.prepare('DELETE FROM balance_snapshots').run();
  }
  for (const x of r.days.filter((x) => x.change != null)) assert.equal(sum(x.parts), x.change, x.date);
  // A monthly transfer to savings repeats like a bill but is still a move to savings; a card payment is a bill.
  const { partOf } = await import('../server/spread.js');
  assert.equal(partOf({ amount: 500, grp: 'Transfer' }, { direction: 'out' }), 'saved');
  assert.equal(partOf({ amount: 500, grp: 'Transfer', pair_type: 'credit' }, { direction: 'out' }), 'bill');
  assert.equal(partOf({ amount: -500, grp: 'Transfer' }, null), 'movedIn');
});

test('getting started: once every step has been done, something new to sort doesn\'t bring the checklist back', async () => {
  await put('/budgets/Groceries', { amount: 300 });
  await post('/setup/home-ok');
  await post('/bills', { name: 'Acme Corp payroll', direction: 'in', amount: 2400, rule: { kind: 'semi', a: 1, b: 15 } });
  const steps = (await get('/setup')).body.steps;
  assert.deepEqual(steps.filter((s) => !s.optional && !s.done).map((s) => s.key), [], 'every required step done');
  assert.equal((await get('/setup')).body.dismissed, true);
  tx('ven', new Date().toLocaleDateString('en-CA'), 25, 'Alex Rivera "for the thing"'); // a new payment with a person to sort
  classify();
  const s = (await get('/setup')).body;
  assert.equal(s.steps.find((x) => x.key === 'sort').done, false); // still counted...
  assert.equal(s.dismissed, true); // ...but the checklist stays away
});

test('notices setting: off by default, the three kinds and the bill threshold round-trip, a bad threshold is refused', async () => {
  let s = (await get('/settings/notify')).body;
  assert.equal(s.enabled, false);
  assert.deepEqual(s.kinds, { signin: true, bill: true, free: true });
  assert.equal(s.billMin, 200);
  assert.equal(typeof s.supported, 'boolean');
  // What Settings › App sends: the switch, one checkbox, the amount from a number box (a string).
  s = (await put('/settings/notify', { enabled: true, kinds: { free: false }, billMin: '350' })).body;
  assert.deepEqual({ enabled: s.enabled, kinds: s.kinds, billMin: s.billMin }, { enabled: true, kinds: { signin: true, bill: true, free: false }, billMin: 350 });
  s = (await get('/settings/notify')).body;
  assert.equal(s.kinds.free, false);
  assert.equal(s.billMin, 350);
  const r = await put('/settings/notify', { billMin: -1 });
  assert.equal(r.status, 400);
  assert.match(r.body.error_message, /0 or more/);
  assert.equal((await get('/settings/notify')).body.billMin, 350);
  s = (await put('/settings/notify', { enabled: false })).body;
  assert.equal(s.enabled, false);
  assert.equal(s.kinds.free, false); // turning it off keeps your choices for next time
});

test('card interest: the Net worth page gets the APR and a monthly estimate only for a card still carrying a balance past its due date', async () => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const stmt = db.prepare(`INSERT INTO card_statements (account_id, last_statement_balance, last_statement_date, next_due_date, minimum_payment,
    last_payment_amount, last_payment_date, purchase_apr) VALUES (?,?,?,?,?,?,?,?)`);
  const card = (id, bal) => account(id, { type: 'credit', subtype: 'credit card', balance: bal });
  card('late', 1200); stmt.run('late', 900, day(-40), day(-15), 35, 50, day(-20), 24.99); // paid 50 of 900, due date gone
  card('paid', 1200); stmt.run('paid', 900, day(-40), day(-15), 0, 900, day(-20), 24.99); // paid in full
  card('noapr', 1200); stmt.run('noapr', 900, day(-40), day(-15), 35, 50, day(-20), null); // the bank sent no APR
  card('early', 1200); stmt.run('early', 900, day(-5), day(20), 35, 0, day(-30), 24.99); // not due yet
  const by = Object.fromEntries((await get('/networth')).body.accounts.map((a) => [a.id, a]));
  assert.deepEqual([by.late.apr, by.late.interest_month], [24.99, 24.99]); // 1,200 × 24.99% ÷ 12
  for (const id of ['paid', 'noapr', 'early', 'chk']) assert.deepEqual([id, by[id].apr, by[id].interest_month], [id, null, null]);
});

// ---------- Assets you add by hand ----------
test('assets: add, give a new value from a date, count a transfer toward one, and What moved treats it as a move', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  for (const [d, v] of [[y, 30000], [today, 2000]]) for (const [a, b] of [['chk', v], ['card', 0], ['ven', 0]])
    db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(d, a, b);
  const t = tx('chk', today, 28000, 'TRANSFER TO 9999', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  classify();

  let r = await post('/assets', { name: 'Loan to Alex Rivera', value: '40000', kind: 'receivable' });
  assert.equal(r.status, 200);
  const id = r.body.id;
  r = await get('/networth');
  assert.equal(r.body.manual[0].entries.length, 1);
  assert.deepEqual(r.body.candidates.map((c) => c.id), [t]); // the transfer is offered to count toward it
  let b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(Math.round(b.moved), -28000);

  r = await post(`/assets/${id}/link`, { tx_id: t, mode: 'add' });
  assert.equal(r.status, 200);
  assert.equal((await post(`/assets/${id}/link`, { tx_id: t, mode: 'add' })).status, 400); // only once
  r = await get('/networth');
  assert.equal(r.body.manual[0].value, 68000);
  assert.equal(r.body.candidates.length, 0);
  b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(Math.round(b.change), 0); // −$28,000 checking, +$28,000 loan
  assert.equal(Math.round(b.moved), 0);
  assert.equal(Math.round(b.revalued), 0);
  assert.equal(Math.round(b.market), 0);

  // A new value you enter (no transfer) shows as its own row.
  assert.equal((await post(`/assets/${id}/values`, { date: '2999-01-01', value: 1 })).status, 400);
  assert.equal((await post(`/assets/${id}/values`, { date: today, value: 70000 })).status, 200);
  b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(Math.round(b.revalued), 2000);
  assert.deepEqual(b.valued.map((a) => a.name), ['Loan to Alex Rivera']);
  assert.equal(Math.round(b.saved + b.moved + b.revalued + b.market), Math.round(b.change));

  // Rename, change kind, remove a value (not the last), remove the asset.
  assert.equal((await patch(`/assets/${id}`, { name: 'Loan to Sam', kind: 'other' })).status, 200);
  let a = (await get('/networth')).body.manual[0];
  assert.equal(a.name, 'Loan to Sam'); assert.equal(a.kind, 'other');
  const todays = a.entries.find((e) => e.date === today);
  assert.equal((await del(`/assets/${id}/values/${todays.id}`)).status, 200);
  a = (await get('/networth')).body.manual[0];
  assert.equal(a.value, 40000);
  assert.equal((await del(`/assets/${id}/values/${a.entries[0].id}`)).status, 400);
  assert.equal((await del(`/assets/${id}`)).status, 200);
  assert.equal((await get('/networth')).body.manual.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM manual_asset_values').get().n, 0);
  db.prepare('DELETE FROM balance_snapshots').run();
});

// ---------- One definition of "spent" ----------
test('spent this month: a refund reduces only its own group, and the strip, the month spread and the budget agree', async () => {
  const today = new Date().toLocaleDateString('en-CA'), month = today.slice(0, 7), first = `${month}-01`;
  tx('chk', first, 300, 'ACME GROCERY', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('card', first, 200, 'ACME AIR', { primary: 'TRAVEL', detailed: 'TRAVEL_FLIGHTS' });
  tx('card', today, -1000, 'ACME AIR REFUND', { primary: 'TRAVEL', detailed: 'TRAVEL_FLIGHTS' }); // last month's trip, refunded
  classify();
  const s = (await get('/summary')).body;
  assert.equal(Math.round(s.spending.value), 300); // not 0: Travel's refund doesn't pay for groceries
  assert.equal(Math.round(s.spending.refunds), 800);
  assert.equal(Math.round((await get(`/month-spread?month=${month}`)).body.total), 300);
  const b = (await get(`/budget?month=${month}`)).body;
  assert.equal(Math.round(b.totals.expensesActual), 300);
  assert.equal(Math.round(b.totals.refundsLeftOut), 800);
});

test('bills: a paycheck you added that detection also finds is set aside, and "They\'re different" counts both', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const d2 = (n) => new Date(Date.parse(today + 'T00:00Z') - n * 864e5).toISOString().slice(0, 10);
  for (const n of [56, 42, 28, 14]) tx('chk', d2(n), -3000, 'DIRECT DEPOSIT ACME CORP', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, account_id, rule, amount_mode, amount, category)
    VALUES ('man:9', 1, 'Acme paycheck', 'in', 'chk', ?, 'fixed', 3000, 'Salary')`).run(JSON.stringify({ kind: 'weeks', n: 2, anchor: d2(14) }));
  const list = (await get('/bills')).body, det = list.find((b) => b.source === 'detected' && b.direction === 'in');
  assert.equal(list.find((b) => b.key === 'man:9').same_as?.key, det.key);
  assert.equal(det.name, 'Acme paycheck');
  assert.equal((await post('/bills/distinct', { a: 'man:9' })).status, 400);
  assert.equal((await post('/bills/distinct', { a: 'man:9', b: det.key })).status, 200);
  assert.equal((await get('/bills')).body.find((b) => b.key === 'man:9').same_as, undefined);
});

test('since: counts new transactions (not split parts), bills paid and the next income', async () => {
  const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA');
  tx('chk', day(-10), 20, 'Old purchase');
  tx('chk', day(-1), 12, 'Corner Cafe');
  tx('chk', day(-1), 30, 'Acme Market');
  const parent = tx('chk', day(-2), 50, 'Big Box');
  tx('chk', day(-2), 25, 'Big Box part', { id: 'part1' });
  db.prepare("UPDATE transactions SET split_of = ? WHERE id = 'part1'").run(parent);
  db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, rule, amount_mode, amount) VALUES ('man:pay', 1, 'Acme Corp', 'in', ?, 'fixed', 2000)`)
    .run(JSON.stringify({ kind: 'weeks', n: 2, anchor: day(5), roll: 0 }));
  const d = (await get(`/since?from=${day(-5)}`)).body;
  assert.equal(d.transactions, 3);
  assert.equal(d.nextIncome.name, 'Acme Corp');
  assert.equal(d.nextIncome.amount, 2000);
  assert.ok(d.nextIncome.date >= day(0));
  assert.equal((await get('/since')).body.transactions, 0); // no date: since today
});
