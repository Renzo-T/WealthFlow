import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { classify, noteCategory, peerOf } = await import('../server/categories.js');

beforeEach(() => { reset(); bank('v', 'Venmo - Personal'); account('ven', { item: 'v' }); bank('b1'); account('card', { type: 'credit', subtype: 'credit card' }); });

test('payments with people ignore Plaid\'s guess from the note', () => {
  // Plaid filed a trip payment as clothing because the note said "Portland".
  const t = tx('ven', '2026-09-14', 517.83, 'Alex Rivera "Portland"', { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES' });
  classify();
  assert.equal(row(t).category, 'Payment apps');
  assert.equal(row(t).cat_source, 'person');
});

test('the note decides when it says what it was', () => {
  const sushi = tx('ven', '2026-09-10', 34.01, 'Taylor Park "Sushi"', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  const fund = tx('ven', '2026-09-11', 15, 'Alex Rivera "Food fund"', { primary: 'GOVERNMENT_AND_NON_PROFIT', detailed: 'GOVERNMENT_AND_NON_PROFIT_DONATIONS' });
  const climb = tx('ven', '2026-09-12', 65.49, 'Sam Lee "🧗"', { primary: 'OTHER', detailed: 'OTHER_OTHER' });
  const back = tx('ven', '2026-09-13', -11, 'Casey Morgan "🥒🧋"', { primary: 'OTHER', detailed: 'OTHER_OTHER' });
  classify();
  assert.equal(row(sushi).category, 'Restaurants');
  assert.equal(row(fund).category, 'Restaurants'); // "food", not a donation
  assert.equal(row(climb).category, 'Fitness');
  assert.equal(row(back).category, 'Coffee'); // 🧋 boba
  assert.equal(row(sushi).cat_source, 'note');
  assert.equal(noteCategory('🕷️'), null);
});

test('money paid back counts against the charge it paid back', () => {
  const tickets = tx('card', '2026-08-20', 97.98, 'ALAMO DRAFTHOUSE', { primary: 'ENTERTAINMENT', detailed: 'ENTERTAINMENT_TV_AND_MOVIES' });
  const back = tx('ven', '2026-08-25', -16.33, 'Riley Brooks "🕷️👨"', { primary: 'OTHER', detailed: 'OTHER_OTHER' });
  db.prepare('UPDATE transactions SET reimburses = ? WHERE id = ?').run(tickets, back);
  classify();
  assert.equal(row(back).category, 'Entertainment');
  assert.equal(row(back).cat_source, 'paid back');
  // Your choice for the charge carries over to what paid it back.
  db.prepare("UPDATE transactions SET user_category = 'Gifts & donations' WHERE id = ?").run(tickets);
  classify();
  assert.equal(row(back).category, 'Gifts & donations');
});

test('people are recognized in Venmo-style and Zelle descriptions, not at merchants', () => {
  assert.deepEqual(peerOf({ name: 'Sam Lee "Climbing"' }, 'Venmo - Personal'), { person: 'Sam Lee', note: 'Climbing', pattern: 'Sam Lee "' });
  assert.equal(peerOf({ name: 'Zelle payment to JORDAN KIM Conf# mqudn7wpf' }, 'Bank of America').person, 'JORDAN KIM');
  assert.equal(peerOf({ name: 'Sam Lee "Climbing"' }, 'Bank of America'), null); // only in a payment-app account
  assert.equal(peerOf({ name: 'Some Shop' }, 'PayPal'), null);
  assert.equal(peerOf({ name: 'Drew Patel "Convenience fee - Alamo drafthouse cancel"', counterparty: 'merchant' }, 'Venmo').person, 'Drew Patel');
});

test('a payment with a person never pairs as a transfer, even with a same-amount transfer nearby', () => {
  account('chk');
  const p = tx('ven', '2026-09-20', 7.5, 'Jamie Cruz "Vb"', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  tx('chk', '2026-09-21', -7.5, 'TRANSFER FROM SAVINGS', { primary: 'TRANSFER_IN' });
  classify();
  assert.equal(row(p).transfer_pair, null);
  assert.equal(row(p).category, 'Fitness'); // "vb": volleyball
});

test('a rule for a person covers all their payments; your rules beat the note', () => {
  const a = tx('ven', '2026-09-01', 65.49, 'Sam Lee "Climbing"', { primary: 'OTHER' });
  const b = tx('ven', '2026-09-15', 20, 'Sam Lee "🪨"', { primary: 'OTHER' });
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('Sam Lee \"', 'Entertainment')").run();
  classify();
  assert.equal(row(a).category, 'Entertainment');
  assert.equal(row(b).category, 'Entertainment');
  assert.equal(row(a).cat_source, 'rule');
});

test('review lists start 3 months before the first bank was connected', async () => {
  const { reviewSince } = await import('../server/categories.js');
  db.prepare("UPDATE items SET created_at = '2026-09-30 21:45:50'").run();
  assert.equal(reviewSince(), '2026-06-30');
});
