import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { classify, friendly, groupOf } = await import('../server/categories.js');

beforeEach(() => { reset(); bank('b1'); });

test('friendly: detailed category wins, primary is the fallback, unknown is Other', () => {
  assert.equal(friendly('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES'), 'Groceries');
  assert.equal(friendly('FOOD_AND_DRINK', 'FOOD_AND_DRINK_SOMETHING_NEW'), 'Restaurants');
  assert.equal(friendly('TRANSFER_OUT', 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS'), 'Payment apps'); // Venmo/Zelle, any spelling
  assert.equal(friendly(null, null), 'Other');
  assert.equal(groupOf('Groceries'), 'Food');
  assert.equal(groupOf('Flights'), 'Travel');
  assert.equal(groupOf('Not a real category'), 'Misc');
});

test('transfers pair across accounts: same amount, opposite sign, within 5 days', () => {
  account('chk'); account('card', { type: 'credit', subtype: 'credit card' });
  const out = tx('chk', '2026-09-28', 500, 'PAYMENT TO CARD', { primary: 'LOAN_PAYMENTS' });
  const inn = tx('card', '2026-09-30', -500, 'ONLINE PAYMENT THANK YOU', { primary: 'OTHER' });
  classify();
  assert.equal(row(out).transfer_pair, inn);
  assert.equal(row(inn).transfer_pair, out);
  assert.equal(row(out).category, 'Transfer');
  assert.equal(row(inn).category, 'Transfer');
});

test('transfers do not pair within one account, beyond 5 days, or for purchases', () => {
  account('chk'); account('sav', { subtype: 'savings' });
  const a = tx('chk', '2026-09-01', 100, 'TRANSFER OUT', { primary: 'TRANSFER_OUT' });
  tx('chk', '2026-09-01', -100, 'TRANSFER IN', { primary: 'TRANSFER_IN' }); // same account: a sweep, not a pair
  const b = tx('chk', '2026-09-10', 200, 'TRANSFER OUT', { primary: 'TRANSFER_OUT' });
  tx('sav', '2026-09-20', -200, 'TRANSFER IN', { primary: 'TRANSFER_IN' }); // 10 days later
  const c = tx('chk', '2026-09-15', 50, 'COFFEE SHOP', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' });
  tx('sav', '2026-09-15', -50, 'TRANSFER IN', { primary: 'TRANSFER_IN' });
  classify();
  assert.equal(row(a).transfer_pair, null);
  assert.equal(row(b).transfer_pair, null);
  assert.equal(row(c).transfer_pair, null);
  assert.equal(row(c).category, 'Coffee');
});

test('a matched transfer into savings is a contribution; out of savings is a withdrawal', () => {
  account('chk'); account('sav', { subtype: 'savings' });
  const out = tx('chk', '2026-09-01', 300, 'TO SAVINGS', { primary: 'TRANSFER_OUT' });
  const inn = tx('sav', '2026-09-01', -300, 'FROM CHECKING', { primary: 'TRANSFER_IN' });
  const back = tx('sav', '2026-09-20', 80, 'TO CHECKING', { primary: 'TRANSFER_OUT' });
  const got = tx('chk', '2026-09-21', -80, 'FROM SAVINGS', { primary: 'TRANSFER_IN' });
  classify();
  assert.equal(row(out).category, 'Savings');
  assert.equal(row(out).grp, 'Savings & investments');
  assert.equal(row(inn).category, 'Transfer');
  assert.equal(row(got).category, 'Savings'); // negative amount in the Savings group = a withdrawal
  assert.equal(row(back).category, 'Transfer');
});

test('an unmatched transfer naming one of your accounts by number is linked to it', () => {
  account('cma', { mask: '7788' }); account('chk', { mask: '3456' });
  const t = tx('cma', '2026-09-14', -764.83, 'TRANSFERRED FROM OVERDRAFT TRANSFER VS. Z99-123456-1 (Cash)',
    { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' });
  classify();
  assert.equal(row(t).transfer_account, 'chk');
  assert.equal(row(t).category, 'Transfer');
});

test('an account number matching two of your accounts is left alone', () => {
  account('cma', { mask: '1111' }); account('x1', { mask: '3456' }); account('x2', { item: 'b1', mask: '0317' });
  db.prepare("UPDATE accounts SET mask = '3456' WHERE id = 'x2'").run();
  const t = tx('cma', '2026-09-14', -50, 'TRANSFER FROM 803456', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' });
  classify();
  assert.equal(row(t).transfer_account, null);
});

test('Bilt rent is rent, not BP gas; the BiltProtect payback is a transfer, not income', () => {
  account('card', { type: 'credit', subtype: 'credit card' });
  const rent = tx('card', '2026-02-01', 1799.75, 'BPS*BILT RENT', { primary: 'TRANSPORTATION', detailed: 'TRANSPORTATION_GAS', merchant: 'BP' });
  const old = tx('card', '2025-01-01', 1750, 'BPS*BILT REWARDS A', { primary: 'TRANSPORTATION', detailed: 'TRANSPORTATION_GAS' });
  const back = tx('card', '2026-02-02', -1799.75, 'BILTPROTECT RENT ACH CREDIT', { primary: 'INCOME', detailed: 'INCOME_RENTAL' });
  classify();
  assert.equal(row(rent).category, 'Rent');
  assert.equal(row(rent).grp, 'Housing');
  assert.equal(row(old).category, 'Rent');
  assert.equal(row(back).category, 'Transfer');
  assert.equal(row(rent).merchant, null); // Plaid's "BP" guess is dropped, so the bank's description shows
});

test('card cash back reduces spending (Misc › Cash back), not income', () => {
  account('chk');
  const t = tx('chk', '2026-09-02', -109.97, 'Bank of America DES:CASHREWARD ID:XXXX PPD', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_OTHER_TRANSFER_IN' });
  classify();
  assert.equal(row(t).category, 'Cash back');
  assert.equal(row(t).grp, 'Misc');
});

test('money-market sweeps are Sweep; a fund payout is Dividends; real investing stays Transfer', () => {
  account('cma', { subtype: 'cash management' });
  const sweep = tx('cma', '2026-09-16', 12515.01, 'PURCHASE INTO CORE ACCOUNT FIDELITY GOVERNMENT MONEY MARKET (SPAXX) (Cash)',
    { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS' });
  const div = tx('cma', '2026-09-30', -187.73, 'VANGUARD 500 INDEX FUND SHS ETF',
    { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS' });
  const buy = tx('cma', '2026-09-20', 500, 'VANGUARD BUY',
    { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS' });
  classify();
  assert.equal(row(sweep).category, 'Sweep');
  assert.equal(row(div).category, 'Dividends');
  assert.equal(row(div).grp, 'Income');
  assert.equal(row(buy).category, 'Transfer');
});

test('precedence: your one-off choice > your rules (newest first) > detection', () => {
  account('chk');
  const a = tx('chk', '2026-09-15', -5620.28, 'DIRECT DEPOSIT BROKERCO ACH TRNSFR (Cash)', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' });
  const b = tx('chk', '2026-09-16', -14012.58, 'DIRECT DEPOSIT BROKERCO ACH TRNSFR (Cash)', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' });
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('BROKERCO', 'Transfer')").run();
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('DIRECT DEPOSIT BROKERCO', 'Income')").run(); // newer wins
  db.prepare("UPDATE transactions SET user_category = 'Pets' WHERE id = ?").run(b);
  classify();
  assert.equal(row(a).category, 'Income');
  assert.equal(row(b).category, 'Pets');
});

test('merged categories: Plaid labels, old choices, rules and budgets move to the new names', async () => {
  const { migrateCategories, pickerGroups } = await import('../server/categories.js');
  assert.equal(friendly('ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES'), 'Entertainment');
  assert.equal(friendly('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ELECTRONICS'), 'Shopping');
  assert.equal(friendly('TRANSPORTATION', 'TRANSPORTATION_PUBLIC_TRANSIT'), 'Rideshare & transit');
  assert.equal(friendly('TRAVEL', 'TRAVEL_RENTAL_CARS'), 'Travel');
  account('chk');
  const t = tx('chk', '2026-09-15', 12, 'STEAM GAMES', { primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_VIDEO_GAMES' });
  db.prepare("UPDATE transactions SET user_category = 'Games' WHERE id = ?").run(t);
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('NETFLIX', 'Streaming & media')").run();
  db.prepare("INSERT INTO budgets (category, amount) VALUES ('Streaming & media', 30), ('Games', 20), ('Entertainment', 50)").run();
  migrateCategories();
  classify();
  assert.equal(row(t).category, 'Entertainment');
  assert.equal(db.prepare("SELECT category FROM category_rules WHERE pattern = 'NETFLIX'").get().category, 'Entertainment');
  assert.equal(db.prepare("SELECT amount FROM budgets WHERE category = 'Entertainment'").get().amount, 100);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM budgets WHERE category IN ('Games', 'Streaming & media')").get().n, 0);
  // Rare categories appear in menus only once used.
  const misc = () => pickerGroups().find((g) => g.group === 'Misc').subs;
  assert.ok(!misc().includes('Childcare'));
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('DAYCARE', 'Childcare')").run();
  assert.ok(misc().includes('Childcare'));
});

test('a "Transfer" rule still lets both sides pair (shown as one row)', () => {
  account('cma', { mask: '7788' }); account('chk', { mask: '3456' });
  const out = tx('cma', '2026-09-17', 18135.29, 'TRANSFERRED TO VS Z99-123456-1 (Cash)', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  const inn = tx('chk', '2026-09-17', -18135.29, 'TRANSFERRED FROM VS Z30-347788-1 (Cash)', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' });
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('TRANSFERRED TO VS Z24', 'Transfer')").run();
  classify();
  assert.equal(row(out).transfer_pair, inn);
});

test('a bank charge that funds a connected Venmo payment is a transfer, not a second expense', () => {
  bank('v1', 'Venmo - Personal');
  account('chk'); account('venmo', { item: 'v1', name: 'Venmo' });
  const fund = tx('chk', '2026-09-14', 517.83, 'Venmo', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS' });
  const pay = tx('venmo', '2026-09-13', 517.83, 'Alex Rivera "Portland"', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS' });
  const lone = tx('chk', '2026-09-20', 42, 'Venmo', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS' }); // no app-side match
  classify();
  assert.equal(row(fund).category, 'Transfer');
  assert.equal(row(fund).transfer_account, 'venmo');
  assert.equal(row(pay).category, 'Payment apps'); // the real spending, with the note
  assert.equal(row(lone).category, 'Payment apps');
});
