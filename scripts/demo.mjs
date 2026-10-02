// npm run demo -- <folder>: fills a NEW data folder with an invented household (about five months of paychecks, rent,
// bills, card spending, savings, a brokerage account and a trip), for screenshots and trying WealthFlow without a bank.
// Nothing here is real, and it never touches your own data folder. Then run it with:
//   WEALTHFLOW_DATA_DIR=<folder> WEALTHFLOW_PORT=3100 node scripts/app.mjs
// It can't sync (the banks are made up), so leave Refresh alone. The same seed gives the same household every time.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Use: npm run demo -- <empty folder>'); process.exit(1); }
const target = path.resolve(dir);
if (fs.existsSync(path.join(target, 'wealthflow.db'))) { console.error(`${target} already has a database; pick an empty folder.`); process.exit(1); }
if (process.env.WEALTHFLOW_DATA_DIR && path.resolve(process.env.WEALTHFLOW_DATA_DIR) !== target) { console.error('WEALTHFLOW_DATA_DIR points elsewhere.'); process.exit(1); }
process.env.WEALTHFLOW_DATA_DIR = target;
process.env.WEALTHFLOW_DB = path.join(target, 'wealthflow.db');
delete process.env.ENCRYPTION_KEY; // a fresh key in the demo folder, never yours

await import('../server/env-check.js');
const { default: db } = await import('../server/db.js');
const { classify } = await import('../server/categories.js');
const { refreshTrips, assignTrips } = await import('../server/trips.js');

// Seeded random numbers, so screenshots come out the same each time.
let seed = 20261002;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

const DAYS = 150, CONNECTED = 60; // history length, and how long ago the banks were "connected"
const iso = (d) => d.toLocaleDateString('en-CA');
const day = (ago) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ago); return d; };

// ---------- Banks and accounts ----------
const items = [['demo-bank', 'Northbridge Bank'], ['demo-card', 'Summit Card'], ['demo-invest', 'Harbor Invest']];
for (const [id, name] of items)
  db.prepare(`INSERT INTO items (id, institution, access_token, status, created_at, investments_consented, liabilities_consented)
    VALUES (?, ?, 'demo', 'ok', ?, 1, 1)`).run(id, name, `${iso(day(CONNECTED))} 09:00:00`);
const accounts = [
  ['chk', 'demo-bank', 'Everyday Checking', '3456', 'depository', 'checking', 3200],
  ['sav', 'demo-bank', 'High Yield Savings', '7812', 'depository', 'savings', 9400],
  ['card', 'demo-card', 'Rewards Visa', '9021', 'credit', 'credit card', 0],
  ['brk', 'demo-invest', 'Individual Brokerage', '5530', 'investment', 'brokerage', 24800],
];
const start = Object.fromEntries(accounts.map((a) => [a[0], a[6]]));
for (const [id, item, name, mask, type, subtype] of accounts)
  db.prepare('INSERT INTO accounts (id, item_id, name, mask, type, subtype, plaid_type, plaid_subtype, balance) VALUES (?,?,?,?,?,?,?,?,0)')
    .run(id, item, name, mask, type, subtype, type, subtype);

// ---------- Transactions (Plaid's sign: positive = money out) ----------
const HOME = { city: 'Seattle', region: 'WA', lat: 47.61, lon: -122.33 };
const TRIP = { city: 'Denver', region: 'CO', lat: 39.74, lon: -104.99, from: 41, to: 37 };
let n = 0;
const txs = [];
const add = (acct, ago, amount, name, primary, detailed, { merchant = null, place = null, online = false } = {}) => txs.push({
  id: `demo${++n}`, acct, date: iso(day(ago)), amount, name, merchant, primary, detailed,
  channel: online ? 'online' : place ? 'in store' : 'other',
  city: place?.city ?? null, region: place?.region ?? null, country: place ? 'US' : null,
  lat: place ? place.lat + between(-0.04, 0.04) : null, lon: place ? place.lon + between(-0.04, 0.04) : null });
const shop = (ago, amount, merchant, primary, detailed, opts = {}) => add('card', ago, amount, merchant.toUpperCase(), primary, detailed, { merchant, ...opts });

for (let ago = DAYS; ago >= 0; ago--) {
  const d = day(ago), dom = d.getDate(), dow = d.getDay(), away = ago <= TRIP.from && ago >= TRIP.to;
  const here = away ? TRIP : HOME;
  // Pay every other Friday; rent, bills and subscriptions on fixed days.
  if (dow === 5 && Math.floor(d.getTime() / 6048e5) % 2 === 0) add('chk', ago, -2460.15, 'ACME CORP PAYROLL DIR DEP', 'INCOME', 'INCOME_WAGES', { merchant: 'Acme Corp' });
  if (dom === 1) add('chk', ago, 1850, 'LAKEVIEW APARTMENTS RENT', 'RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_RENT', { merchant: 'Lakeview Apartments' });
  if (dom === 2) { add('chk', ago, 500, 'TRANSFER TO SAVINGS 7812', 'TRANSFER_OUT', 'TRANSFER_OUT_ACCOUNT_TRANSFER'); add('sav', ago, -500, 'TRANSFER FROM CHECKING 3456', 'TRANSFER_IN', 'TRANSFER_IN_ACCOUNT_TRANSFER'); }
  if (dom === 3) shop(ago, 39.99, 'Elevate Fitness', 'PERSONAL_CARE', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS');
  if (dom === 7) shop(ago, 15.49, 'Netflix', 'ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES', { online: true });
  if (dom === 12) add('chk', ago, between(68, 112), 'CITY POWER & LIGHT', 'RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', { merchant: 'City Power & Light' });
  if (dom === 15) shop(ago, 11.99, 'Spotify', 'ENTERTAINMENT', 'ENTERTAINMENT_MUSIC_AND_AUDIO', { online: true });
  if (dom === 16) { add('chk', ago, 400, 'TRANSFER TO HARBOR INVEST', 'TRANSFER_OUT', 'TRANSFER_OUT_ACCOUNT_TRANSFER'); add('brk', ago, -400, 'TRANSFER FROM NORTHBRIDGE', 'TRANSFER_IN', 'TRANSFER_IN_ACCOUNT_TRANSFER'); }
  if (dom === 18) add('chk', ago, 65, 'FIBERLINE INTERNET', 'RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE', { merchant: 'Fiberline' });
  if (dom === 22) shop(ago, 45, 'Clearwave Mobile', 'RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE');
  if (dom === 28) add('sav', ago, -between(28, 34), 'INTEREST PAYMENT', 'INCOME', 'INCOME_INTEREST_EARNED');
  // Everyday spending, in person where they are (home, or on the trip).
  if (!away && rnd() < 0.27) shop(ago, between(48, 138), pick(["Trader Joe's", 'Safeway', 'Whole Foods Market', 'QFC']), 'FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES', { place: here });
  if (rnd() < (away ? 0.9 : 0.33)) shop(ago, between(16, away ? 85 : 62), pick(away ? ['Linger', 'Snooze', 'Denver Biscuit Co', 'Root Down'] : ['Tilikum Place Cafe', 'Din Tai Fung', 'Pagliacci Pizza', 'Tacos Chukis', 'Chipotle']), 'FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT', { place: here });
  if (dow > 0 && dow < 6 && rnd() < 0.3) shop(ago, between(4.25, 7.5), pick(['Starbucks', 'Victrola Coffee', 'Blue Bottle Coffee', 'Caffe Ladro', 'Storyville Coffee']), 'FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE', { place: here });
  if (!away && ago % 9 === 4) shop(ago, between(41, 58), pick(['Shell', 'Chevron']), 'TRANSPORTATION', 'TRANSPORTATION_GAS', { place: here });
  if (!away && rnd() < 0.12) shop(ago, between(14, 96), pick(['Amazon', 'Target']), 'GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES', { online: true });
  if (rnd() < (away ? 0.6 : 0.07)) shop(ago, between(11, 34), away ? 'Uber' : pick(['Uber', 'Lyft']), 'TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES', { place: here });
  if (!away && rnd() < 0.03) shop(ago, between(35, 140), pick(['Uniqlo', 'REI']), 'GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES', { place: here });
}
// The trip: flights booked ahead online, the hotel paid at the end.
add('card', TRIP.from + 23, 386.4, 'ALASKA AIRLINES', 'TRAVEL', 'TRAVEL_FLIGHTS', { merchant: 'Alaska Airlines', online: true });
add('card', TRIP.to, 612.85, 'THE MAVEN HOTEL', 'TRAVEL', 'TRAVEL_LODGING', { merchant: 'The Maven Hotel', place: TRIP });
add('card', TRIP.from - 1, 74, 'RED ROCKS PARK TICKETS', 'ENTERTAINMENT', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS', { merchant: 'Red Rocks', place: TRIP });

// Pay the card in full on the 25th: what was charged since the last payment.
txs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
let owed = 0;
const withPayments = [];
for (let ago = DAYS; ago >= 0; ago--) {
  const date = iso(day(ago));
  for (const t of txs.filter((x) => x.date === date)) { withPayments.push(t); if (t.acct === 'card') owed += t.amount; }
  if (day(ago).getDate() === 25 && owed > 0) {
    const amt = Math.round(owed * 100) / 100;
    withPayments.push({ id: `demo${++n}`, acct: 'chk', date, amount: amt, name: 'SUMMIT CARD PAYMENT', merchant: null, primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', channel: 'other' });
    withPayments.push({ id: `demo${++n}`, acct: 'card', date, amount: -amt, name: 'PAYMENT THANK YOU', merchant: null, primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', channel: 'other' });
    owed = 0;
  }
}
const ins = db.prepare(`INSERT INTO transactions (id, account_id, date, name, merchant, amount, pfc_primary, pfc_detailed, pending,
  pfc_confidence, city, region, country, channel, lat, lon) VALUES (?,?,?,?,?,?,?,?,0,'HIGH',?,?,?,?,?,?)`);
db.transaction(() => { for (const t of withPayments) ins.run(t.id, t.acct, t.date, t.name, t.merchant, t.amount, t.primary, t.detailed, t.city ?? null, t.region ?? null, t.country ?? null, t.channel, t.lat ?? null, t.lon ?? null); })();

// ---------- Balances: today's, and a daily snapshot since "connecting" (the brokerage drifts like a market) ----------
const flows = {};
for (const t of withPayments) ((flows[t.acct] ??= {})[t.date] ??= 0, flows[t.acct][t.date] += t.amount);
const bal = { ...start };
const snap = db.prepare('INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)');
let market = 1;
for (let ago = DAYS; ago >= 0; ago--) {
  const date = iso(day(ago));
  for (const [id, , , , type] of accounts) {
    const f = flows[id]?.[date] ?? 0;
    bal[id] = type === 'credit' ? bal[id] + f : bal[id] - f;
  }
  market *= 1 + between(-0.011, 0.0135);
  if (ago <= CONNECTED) for (const [id, , , , type] of accounts)
    snap.run(date, id, Math.round((type === 'investment' ? bal[id] * market : bal[id]) * 100) / 100);
}
bal.brk = Math.round(bal.brk * market * 100) / 100;
for (const id in bal) db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(Math.round(bal[id] * 100) / 100, id);

// Holdings that add up to the brokerage balance.
const mix = [['VTI', 'Vanguard Total Stock Market ETF', 'etf', 0.66, 291.4, 0.82], ['VXUS', 'Vanguard Total International Stock ETF', 'etf', 0.16, 66.1, 0.9],
  ['BND', 'Vanguard Total Bond Market ETF', 'etf', 0.12, 73.2, 1.01], [null, 'Cash', 'cash', 0.06, 1, 1]];
for (const [ticker, name, type, share, price, basis] of mix) {
  const value = Math.round(bal.brk * share * 100) / 100, qty = Math.round((value / price) * 1000) / 1000;
  db.prepare('INSERT INTO holdings (account_id, security_id, name, ticker, type, quantity, price, value, cost_basis) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('brk', `demo-${ticker ?? 'cash'}`, name, ticker, type, qty, price, value, ticker ? Math.round(value * basis * 100) / 100 : null);
}
// The card's latest statement (paid on the 25th).
const lastStatement = (() => { const d = new Date(); d.setDate(20); if (d > new Date()) d.setMonth(d.getMonth() - 1); return d; })();
const due = new Date(lastStatement); due.setDate(due.getDate() + 25);
db.prepare(`INSERT INTO card_statements (account_id, last_statement_balance, last_statement_date, next_due_date, minimum_payment,
  last_payment_amount, last_payment_date) VALUES ('card', ?, ?, ?, 35, ?, ?)`).run(812.4, iso(lastStatement), iso(due), 812.4, iso(new Date(lastStatement.getTime() + 5 * 864e5)));

// ---------- What a settled-in user has set up ----------
db.prepare("INSERT INTO home_bases (city, region, since, lat, lon) VALUES ('Seattle', 'WA', ?, 47.61, -122.33)").run(iso(day(DAYS)));
for (const [c, a] of [['Income', 4900], ['Rent', 1850], ['Groceries', 450], ['Restaurants', 300], ['Coffee', 45], ['Gas', 140], ['Shopping', 180], ['Clothing', 60],
  ['Entertainment', 30], ['Fitness', 40], ['Utilities', 110], ['Phone & internet', 110], ['Rideshare & transit', 50]])
  db.prepare('INSERT INTO budgets (category, amount) VALUES (?, ?)').run(c, a);
const later = (months) => { const d = new Date(); d.setMonth(d.getMonth() + months); return iso(d); };
db.prepare("INSERT INTO goals (name, target, saved, account_id, target_date) VALUES ('Emergency fund', 15000, NULL, 'sav', ?)").run(later(14));
db.prepare("INSERT INTO goals (name, target, saved, account_id, target_date) VALUES ('Japan trip', 4500, 1650, NULL, ?)").run(later(9));
db.prepare("INSERT INTO goals (name, target, saved, account_id, target_date) VALUES ('New laptop', 1800, 1800, NULL, NULL)").run();
for (const [k, v] of [['last_sync', new Date().toISOString()], ['update_checks', '0'], ['setup_dismissed', '1'], ['setup_home_ok', '1']])
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);

classify();
refreshTrips();
db.prepare("UPDATE trips SET status = 'confirmed' WHERE status = 'suggested'").run();
assignTrips();
const count = (sql) => db.prepare(sql).get().n;
console.log(`Demo household in ${target}: ${count('SELECT COUNT(*) n FROM transactions')} transactions, ${count('SELECT COUNT(*) n FROM trips')} trip(s).`);
console.log(`Run it: WEALTHFLOW_DATA_DIR="${target}" WEALTHFLOW_PORT=3100 node scripts/app.mjs`);
