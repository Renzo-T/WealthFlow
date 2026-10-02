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
  tx('chk', '2026-09-17', -3000, 'DIRECT DEPOSIT ACME CORP, INCDIR DEP (Cash)', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const [c] = (await get('/bills/paychecks')).body;
  assert.ok(c, 'a paycheck to ask about');
  assert.equal((await post('/bills/paychecks', { key: c.key, cadence: 'sometimes' })).status, 400);
  assert.equal((await post('/bills/paychecks', { key: c.key, cadence: 'biweekly' })).status, 200);
  assert.equal((await get('/bills/paychecks')).body.length, 0);
  const income = (await get('/bills')).body.find((b) => b.direction === 'in');
  assert.equal(income.schedule, 'every 2 weeks');
  assert.equal(income.category, 'Salary');
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
  for (const [d, a] of [['2026-08-10', 10.99], ['2026-09-10', 10.99], ['2026-10-10', 12.99]])
    tx('card', d, a, 'STREAMFLIX', { primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES', merchant: 'Streamflix' });
  tx('card', '2026-09-05', 80, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('chk', '2026-09-01', -3000, 'ACME PAYROLL', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const m = (await get('/reports/months?months=6')).body;
  assert.ok(m.months.length <= 6 && m.months.includes('2026-09')); // starts at the history cap
  const food = m.groups.find((g) => g.group === 'Food');
  assert.equal(food.values[m.months.indexOf('2026-09')], 80);
  assert.equal(m.groups.find((g) => g.income).values[m.months.indexOf('2026-09')], 3000);
  const s = (await get('/reports/subscriptions')).body;
  const flix = s.items.find((x) => /Streamflix/i.test(x.name));
  assert.ok(flix, 'the streaming charge is a subscription');
  assert.deepEqual([flix.change?.from, flix.change?.to], [10.99, 12.99]);
  const y = (await get('/reports/year?year=2026')).body;
  assert.equal(Math.round(y.spending), Math.round(80 + 10.99 * 2 + 12.99));
  assert.ok(y.years.includes(2026));
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

test('net worth breakdown: saved (income − spending) and market and other add up to the change', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const y = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
  bank('broker', 'Brokerage'); account('ira', { item: 'broker', type: 'investment', subtype: 'ira', balance: 1100 });
  db.prepare("UPDATE accounts SET balance = 2400 WHERE id = 'chk'").run();
  db.prepare("UPDATE accounts SET balance = 0 WHERE id = 'card'").run();
  for (const [d, chk, ira] of [[y, 2500, 1000], [today, 2400, 1100]])
    for (const [a, v] of [['chk', chk], ['ira', ira], ['card', 0], ['ven', 0]]) db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)').run(d, a, v);
  tx('chk', today, 100, 'SHOP', { primary: 'GENERAL_MERCHANDISE' });
  classify();
  const b = (await get('/networth/breakdown?period=all')).body;
  assert.equal(b.available, true);
  assert.equal(Math.round(b.change), 0); // −100 checking, +100 IRA
  assert.equal(Math.round(b.saved), -100);
  assert.equal(Math.round(b.market), 100);
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

test('app: the sign-in command starts this folder\'s app hidden, with paths quoted for PowerShell', async () => {
  const { startupCommand } = await import('../server/startup.js');
  const cmd = startupCommand(String.raw`C:\Users\Alex O'Neil\WealthFlow`, String.raw`C:\Program Files\nodejs\node.exe`);
  assert.match(cmd, /^powershell\.exe -NoProfile -WindowStyle Hidden -Command "/);
  assert.ok(cmd.includes(String.raw`Set-Location -LiteralPath 'C:\Users\Alex O''Neil\WealthFlow'`), cmd); // ' doubled inside '…'
  assert.ok(cmd.includes(String.raw`& 'C:\Program Files\nodejs\node.exe' 'C:\Users\Alex O''Neil\WealthFlow\scripts\app.mjs' --log`), cmd);
  assert.equal(cmd.split('"').length, 3); // one quoted -Command argument, nothing breaking out of it
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
