// A refund that reverses one of your charges (classify's matchRefunds), and money a friend paid back, count on the
// charge's date: a booking cancelled next month nets out in the month it was made, instead of inflating that month
// and vanishing from the month the money came back (where a group can't go below zero).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { classify, spendingBetween } = await import('../server/categories.js');
const { monthByMonth } = await import('../server/reports.js');
const { daySpending } = await import('../server/spread.js');

const T = { primary: 'TRAVEL', detailed: 'TRAVEL_LODGING', merchant: 'Acme Travel' };
const spent = (from, to) => Math.round(spendingBetween(from, to).spent * 100) / 100;

beforeEach(() => {
  reset();
  bank('b1'); account('card', { type: 'credit', subtype: 'credit card' }); account('card2', { type: 'credit', subtype: 'credit card' });
  bank('v', 'Venmo - Personal'); account('ven', { item: 'v' });
});

test('a whole refund next month counts in the month of the booking it cancels', () => {
  const booking = tx('card', '2026-10-08', 650.06, 'ACME TRAVEL 1234', T);
  tx('card', '2026-11-03', 256.55, 'ACME TRAVEL 5678', T); // the rebooking: real November spending
  const refund = tx('card', '2026-11-17', -650.06, 'ACME TRAVEL REFUND', T);
  classify();
  assert.equal(row(refund).refund_of, booking);
  assert.equal(row(refund).counts_on, '2026-10-08');
  assert.equal(row(refund).cat_source, 'refund');
  assert.equal(spent('2026-10-01', '2026-10-31'), 0);
  assert.equal(spent('2026-11-01', '2026-11-30'), 256.55); // before: 0, with the refund beyond it dropped
  assert.equal(daySpending('2026-10-01', '2026-10-31')['2026-10-08'], 0);
});

test('a refund in pieces that add up to the charge exactly reverses it', () => {
  const booking = tx('card', '2026-08-13', 704, 'ACME TRAVEL', T);
  const a = tx('card', '2026-11-03', -286.22, 'ACME TRAVEL', T), b = tx('card', '2026-11-03', -417.78, 'ACME TRAVEL', T);
  const stray = tx('card', '2026-11-04', -50, 'ACME TRAVEL', T); // a price drop on something else: no charge to reverse
  classify();
  assert.equal(row(a).refund_of, booking);
  assert.equal(row(b).refund_of, booking);
  assert.equal(row(stray).refund_of, null);
  assert.equal(row(stray).counts_on, null);
  assert.equal(spent('2026-08-01', '2026-08-31'), 0);
});

test('only a refund of the same amount, merchant and account, after the charge and within six months', () => {
  tx('card', '2026-09-01', 120, 'ACME TRAVEL', T);
  const otherShop = tx('card', '2026-09-10', -120, 'GLOBEX HOTELS', { ...T, merchant: 'Globex Hotels' });
  const otherCard = tx('card2', '2026-09-10', -120, 'ACME TRAVEL', T);
  const early = tx('card', '2026-08-20', -120, 'ACME TRAVEL', T); // before the charge
  tx('card', '2026-01-05', 99, 'ACME TRAVEL', T);
  const late = tx('card', '2026-08-01', -99, 'ACME TRAVEL', T); // 208 days later
  classify();
  for (const id of [otherShop, otherCard, early, late]) assert.equal(row(id).refund_of, null);
});

test('an exact refund reverses the latest charge of that amount before it', () => {
  tx('card', '2026-07-03', 15.99, 'GLOBEX STREAMING', { primary: 'ENTERTAINMENT', merchant: 'Globex Streaming' });
  const aug = tx('card', '2026-08-03', 15.99, 'GLOBEX STREAMING', { primary: 'ENTERTAINMENT', merchant: 'Globex Streaming' });
  const refund = tx('card', '2026-08-10', -15.99, 'GLOBEX STREAMING', { primary: 'ENTERTAINMENT', merchant: 'Globex Streaming' });
  classify();
  assert.equal(row(refund).refund_of, aug);
});

test('a refund takes the category of the charge you corrected; yours on the refund wins', () => {
  const gift = tx('card', '2026-09-01', 80, 'ACME STORE', { primary: 'GENERAL_MERCHANDISE', merchant: 'Acme Store' });
  const back = tx('card', '2026-10-02', -80, 'ACME STORE', { primary: 'GENERAL_MERCHANDISE', merchant: 'Acme Store' });
  db.prepare("UPDATE transactions SET user_category = 'Gifts & donations' WHERE id = ?").run(gift);
  classify();
  assert.equal(row(back).category, 'Gifts & donations');
  db.prepare("UPDATE transactions SET user_category = 'Clothing' WHERE id = ?").run(back);
  classify();
  assert.equal(row(back).category, 'Clothing');
  assert.equal(row(back).refund_of, gift); // still counts on the charge's date
});

test('transfers and income never pair as refunds', () => {
  tx('card', '2026-09-01', 500, 'ACME CORP', { primary: 'GENERAL_MERCHANDISE', merchant: 'Acme Corp' });
  const pay = tx('card', '2026-09-15', -500, 'ACME CORP PAYROLL', { primary: 'INCOME', detailed: 'INCOME_WAGES', merchant: 'Acme Corp' });
  classify();
  assert.equal(row(pay).refund_of, null);
});

test('money a friend paid back counts in the month of the charge, in reports too', () => {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const ym = (k) => new Date(y, mo + k, 1).toLocaleDateString('en-CA').slice(0, 7);
  const last = ym(-1), cur = ym(0);
  db.prepare('UPDATE items SET created_at = ?').run(`${last}-01`);
  const cabin = tx('card', `${last}-20`, 1200, 'ACME CABINS', { ...T, merchant: 'Acme Cabins' });
  tx('card', `${cur}-02`, 40, 'GROCER', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  const backs = [tx('ven', `${cur}-03`, -300, 'Alex Rivera "Cabin"', { primary: 'OTHER' }), tx('ven', `${cur}-04`, -300, 'Sam Lee "🏠"', { primary: 'OTHER' })];
  for (const b of backs) db.prepare('UPDATE transactions SET reimburses = ? WHERE id = ?').run(cabin, b);
  classify();
  assert.equal(row(backs[0]).counts_on, `${last}-20`);
  assert.equal(row(backs[0]).grp, 'Travel');
  const r = monthByMonth(12, `${cur}-28`);
  const travel = r.groups.find((g) => g.group === 'Travel');
  assert.equal(travel.values[r.months.indexOf(last)], 600); // your share
  assert.equal(travel.values[r.months.indexOf(cur)] ?? 0, 0);
  assert.equal(travel.refunded[r.months.indexOf(cur)] ?? 0, 0); // nothing dropped
  assert.equal(spent(`${cur}-01`, `${cur}-28`), 40);
});
