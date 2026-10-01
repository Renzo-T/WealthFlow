import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx } from './helpers.js';

const { whatChanged, frequentSpend, groupChanges, watchStats } = await import('../server/watch.js');
const { classify } = await import('../server/categories.js');
const food = (detailed = 'FOOD_AND_DRINK_RESTAURANT') => ({ primary: 'FOOD_AND_DRINK', detailed });

beforeEach(() => { reset(); db.prepare('DELETE FROM watchlist').run(); bank('b1'); account('card', { type: 'credit', subtype: 'credit card' }); });

test('nothing is compared before the 5th', () => {
  tx('card', '2026-09-02', 300, 'CAFE', food());
  classify();
  assert.equal(whatChanged('2026-10-03').ready, false);
  assert.deepEqual(frequentSpend('2026-10-03'), []);
  assert.deepEqual(groupChanges('2026-10-03'), {});
});

test('this month so far is compared with the same days of last month, naming the biggest changes', () => {
  tx('card', '2026-08-05', 100, 'CAFE', food());
  tx('card', '2026-08-20', 500, 'LATE AUGUST DINNER', food()); // after Aug 10: not in the comparison
  tx('card', '2026-09-03', 300, 'CAFE', food());
  tx('card', '2026-09-04', 60, 'H-E-B', food('FOOD_AND_DRINK_GROCERIES'));
  classify();
  const w = whatChanged('2026-09-10');
  assert.equal(w.prev, 100);
  assert.equal(w.cur, 360);
  assert.equal(w.diff, 260);
  assert.deepEqual(w.drivers.map((d) => d.category), ['Restaurants', 'Groceries']);
});

test('a bank connected recently is left out of the comparison', () => {
  bank('b2'); account('newcard', { item: 'b2', type: 'credit', subtype: 'credit card' });
  tx('card', '2026-08-03', 200, 'CAFE', food());
  tx('card', '2026-09-03', 200, 'CAFE', food());
  tx('newcard', '2026-09-02', 900, 'BIG DINNER', food()); // history starts this month
  classify();
  const w = whatChanged('2026-09-10');
  assert.equal(w.cur, 200);
  assert.equal(w.flat, true);
});

test('recurring bills are left out (rent posting on a different day is not "new spending")', () => {
  account('chk');
  const rent = { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT', merchant: 'Landlord' };
  tx('chk', '2026-07-29', 1555, 'RENT', rent); tx('chk', '2026-08-31', 1555, 'RENT', rent); tx('chk', '2026-09-29', 1555, 'RENT', rent);
  tx('card', '2026-08-10', 150, 'CAFE', food()); tx('card', '2026-09-10', 160, 'CAFE', food());
  classify();
  const w = whatChanged('2026-09-29');
  assert.equal(w.cur, 160);
  assert.equal(w.prev, 150);
});

test('small bases never produce a percentage', () => {
  tx('card', '2026-08-03', 20, 'CAFE', food());
  tx('card', '2026-09-03', 400, 'CAFE', food());
  classify();
  assert.equal(whatChanged('2026-09-10').flat, true, 'last month under $100: no headline');
  assert.equal(groupChanges('2026-09-10').Food, null, 'group under $25: no %');
});

test('frequent spending counts visits (days), needs 3+, and must be up on last month', () => {
  const heb = { ...food('FOOD_AND_DRINK_GROCERIES'), merchant: 'H-E-B' };
  for (const d of ['2026-09-02', '2026-09-04', '2026-09-04', '2026-09-08']) tx('card', d, 30, 'H-E-B', heb); // 3 visit days
  tx('card', '2026-08-06', 30, 'H-E-B', heb);
  classify();
  const f = frequentSpend('2026-09-10');
  assert.equal(f.length, 1);
  assert.equal(f[0].merchant, 'H-E-B');
  assert.equal(f[0].count, 3);
  assert.equal(f[0].prevCount, 1);
  assert.equal(f[0].avg, 40);
});

test('watchlist: so far, monthly average, year to date, and no projection early in the month', () => {
  const coffee = { ...food('FOOD_AND_DRINK_COFFEE'), merchant: 'Cafe Java' };
  tx('card', '2026-07-10', 30, 'CAFE JAVA', coffee); tx('card', '2026-08-10', 50, 'CAFE JAVA', coffee);
  tx('card', '2026-09-02', 20, 'CAFE JAVA', coffee); tx('card', '2026-09-09', 10, 'CAFE JAVA', coffee);
  classify();
  const s = watchStats({ kind: 'merchant', value: 'cafe java' }, '2026-09-15');
  assert.equal(s.soFar, 30);
  assert.equal(s.avg, 40); // July and August, from the first month it appears
  assert.equal(s.ytd, 110);
  assert.equal(s.projected, 60); // $30 by the 15th of a 30-day month
  assert.equal(watchStats({ kind: 'category', value: 'Coffee' }, '2026-09-03').projected, null);
});
