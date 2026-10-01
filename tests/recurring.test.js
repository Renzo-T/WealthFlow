import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx } from './helpers.js';

const { nextFromRule, ruleText, bills, _test } = await import('../server/recurring.js');
const { classify } = await import('../server/categories.js');
const { holidays, isBiz, monthlyRule } = _test;
const TODAY = '2026-10-01';
const find = (name) => bills(TODAY).find((b) => b.name === name);

beforeEach(() => { reset(); bank('b1'); account('chk', { name: 'Checking' }); });

// ---------- business days and holidays ----------
test('US bank holidays, including Sunday holidays observed on Monday', () => {
  const h = holidays(2026);
  assert.ok(h.has('2026-09-07'), 'Labor Day: first Monday of September');
  assert.ok(h.has('2026-11-26'), 'Thanksgiving: fourth Thursday of November');
  assert.ok(h.has('2026-05-25'), 'Memorial Day: last Monday of May');
  assert.ok(holidays(2027).has('2027-07-05'), 'July 4 2027 is a Sunday, observed Monday the 5th');
  assert.equal(isBiz('2026-09-07'), false);
  assert.equal(isBiz('2026-08-29'), false, 'Saturday');
  assert.equal(isBiz('2026-08-31'), true);
});

// ---------- schedule rules ----------
test('day-of-month rules move off weekends and holidays the way you choose', () => {
  assert.equal(nextFromRule({ kind: 'dom', n: 29, roll: 1 }, '2026-08-01'), '2026-08-31', 'Sat 29th → Mon 31st');
  assert.equal(nextFromRule({ kind: 'dom', n: 29, roll: -1 }, '2026-08-01'), '2026-08-28', 'Sat 29th → Fri 28th');
  assert.equal(nextFromRule({ kind: 'dom', n: 29, roll: 0 }, '2026-08-01'), '2026-08-29');
  assert.equal(nextFromRule({ kind: 'dom', n: 5, roll: 1 }, '2026-09-01'), '2026-09-08', 'Sat 5th, then Labor Day → Tue 8th');
  assert.equal(nextFromRule({ kind: 'dom', n: 31, roll: 0 }, '2026-02-01'), '2026-02-28', 'the 31st in February is the last day');
});

test('end-of-month and business-day rules', () => {
  assert.equal(nextFromRule({ kind: 'eom', n: 3, roll: 0 }, '2026-10-01'), '2026-10-28');
  assert.equal(nextFromRule({ kind: 'bday', n: 1 }, '2026-11-01'), '2026-11-02', 'Nov 1 2026 is a Sunday');
  assert.equal(nextFromRule({ kind: 'lastbday', n: 1 }, '2026-10-01'), '2026-10-30', 'Oct 31 2026 is a Saturday');
  assert.equal(nextFromRule({ kind: 'dom', n: 15, roll: 0 }, '2026-10-16'), '2026-11-15', 'already past this month → next month');
});

test('every-N-weeks and every-N-months rules step from their anchor', () => {
  assert.equal(nextFromRule({ kind: 'weeks', n: 2, anchor: '2026-09-26' }, '2026-10-01'), '2026-10-10');
  assert.equal(nextFromRule({ kind: 'months', n: 12, day: 1, roll: 1, anchor: '2026-01-01' }, '2026-10-01'), '2027-01-04',
    'Jan 1 2027 is a holiday and Jan 2–3 a weekend');
});

test('"days before the card due date" moves to the next cycle once it has passed', () => {
  assert.equal(nextFromRule({ kind: 'due', n: 3 }, '2026-10-01', { due: '2026-10-20' }), '2026-10-17');
  assert.equal(nextFromRule({ kind: 'due', n: 3 }, '2026-10-18', { due: '2026-10-20' }), '2026-11-17');
});

test('the schedule is inferred from history: rent on the 29th, moved to Monday when it falls on a weekend', () => {
  const rule = monthlyRule(['2026-07-29', '2026-08-31', '2026-09-29']);
  assert.deepEqual(rule, { kind: 'dom', n: 29, roll: 1 });
  assert.equal(ruleText(rule), 'the 29th of each month, or the next business day');
});

// ---------- detection ----------
test('rent: detected monthly with the right next date and amount', () => {
  for (const d of ['2026-07-29', '2026-08-31', '2026-09-29'])
    tx('chk', d, 1555.4, 'DIRECT DEBIT Maple ApartmRENT', { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT', merchant: 'Maple Apartments' });
  classify();
  const b = find('Maple Apartments');
  assert.ok(b, 'detected');
  assert.equal(b.next_date, '2026-10-29');
  assert.equal(b.amount, 1555.4);
  assert.equal(b.estimate, false);
});

test('Chewy: an autoship mixed with one-off orders is the repeated amount, every 2 weeks', () => {
  account('card', { type: 'credit', subtype: 'credit card' });
  const pets = { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_PET_SUPPLIES', merchant: 'Chewy' };
  for (const [d, amt] of [['2026-07-06', 63.64], ['2026-07-21', 63.64], ['2026-08-04', 63.64], ['2026-08-18', 63.64],
    ['2026-08-20', 63.64], ['2026-09-02', 63.64], ['2026-09-08', 111.99], ['2026-09-15', 63.64]]) tx('card', d, amt, 'CHEWY.COM', pets);
  // ^ a one-off order in the middle of the recent run: only the subscription filter keeps the 2-week schedule
  tx('card', '2026-09-26', 63.64, 'CHEWY.COM', { ...pets, pending: 1 }); // pending still counts as the latest
  classify();
  const b = find('Chewy');
  assert.ok(b, 'detected');
  assert.equal(b.frequency, 'Every 2 weeks');
  assert.equal(b.amount, 63.64);
  assert.equal(b.next_date, '2026-10-10');
});

test('irregular shopping is not a bill', () => {
  for (const d of ['2026-07-03', '2026-07-19', '2026-08-25', '2026-09-02', '2026-09-28'])
    tx('chk', d, [42.5, 61.2, 38.9, 55, 47.75][['2026-07-03', '2026-07-19', '2026-08-25', '2026-09-02', '2026-09-28'].indexOf(d)], 'SUSHI PLACE', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT', merchant: 'Sushi Place' });
  classify();
  assert.equal(find('Sushi Place'), undefined);
});

test('moving money between your own checking accounts is not a bill; paying a card is', () => {
  account('chk2', { name: 'Other checking', mask: '9999' });
  account('card', { type: 'credit', subtype: 'credit card', name: 'Visa' });
  for (const d of ['2026-08-14', '2026-09-14']) {
    tx('chk', d, 200, 'TRANSFER TO CHECKING', { primary: 'TRANSFER_OUT' });
    tx('chk2', d, -200, 'TRANSFER FROM CHECKING', { primary: 'TRANSFER_IN' });
    tx('chk', d, 300, 'PAYMENT TO VISA', { primary: 'LOAN_PAYMENTS' });
    tx('card', d, -300, 'PAYMENT THANK YOU', { primary: 'OTHER' });
  }
  classify();
  assert.equal(find('Transfer to Other checking'), undefined);
  assert.ok(find('Visa payment'), 'card autopay detected');
});

test('cash back is never scheduled: its amount follows your spending', () => {
  for (const d of ['2026-07-02', '2026-08-03', '2026-09-02'])
    tx('chk', d, -85, 'Bank of America DES:CASHREWARD ID:X PPD', { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_OTHER_TRANSFER_IN' });
  classify();
  assert.equal(bills(TODAY).length, 0);
});

// ---------- card statements and your edits ----------
function cardWithStatement(paid) {
  account('card', { type: 'credit', subtype: 'credit card', name: 'Visa', balance: 420 });
  db.prepare(`INSERT INTO card_statements (account_id, last_statement_balance, last_statement_date, next_due_date, minimum_payment,
    last_payment_amount, last_payment_date) VALUES ('card', 136.69, NULL, '2026-10-20', ?, ?, ?)`)
    .run(paid ? 0 : 35, paid ? 136.69 : 50, '2026-09-10');
}

test('an unpaid card statement is a bill for the statement balance on the due date', () => {
  cardWithStatement(false);
  const b = find('Visa payment');
  assert.equal(b.source, 'card');
  assert.equal(b.next_date, '2026-10-20');
  assert.equal(b.amount, 136.69);
  assert.equal(b.unscheduled, false);
});

test('a paid statement is unscheduled until the next one, unless you pay from the running balance', () => {
  cardWithStatement(true);
  assert.equal(find('Visa payment').unscheduled, true);
  db.prepare("INSERT INTO bill_settings (key, amount_mode) VALUES ('to:card', 'current')").run();
  const b = find('Visa payment');
  assert.equal(b.unscheduled, false);
  assert.equal(b.amount, 420);
});

test('your schedule beats the detected one', () => {
  for (const d of ['2026-07-29', '2026-08-31', '2026-09-29'])
    tx('chk', d, 1555.4, 'RENT', { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT', merchant: 'Landlord' });
  classify();
  const key = find('Landlord').key;
  db.prepare('INSERT INTO bill_settings (key, rule, amount_mode, amount) VALUES (?, ?, ?, ?)')
    .run(key, JSON.stringify({ kind: 'bday', n: 1 }), 'fixed', 1600);
  const b = find('Landlord');
  assert.equal(b.next_date, '2026-10-01');
  assert.equal(b.amount, 1600);
  assert.equal(b.edited, true);
});

// ---------- safe to spend ----------
const { freeToSpend } = await import('../server/recurring.js');

test('free to spend this month = cash + income still coming − bills still due − card balances', () => {
  db.prepare("UPDATE accounts SET balance = 3000 WHERE id = 'chk'").run();
  account('sav', { subtype: 'savings', balance: 10000 }); // savings isn't everyday cash
  account('card', { type: 'credit', subtype: 'credit card', balance: 250 });
  const pay = { primary: 'INCOME', detailed: 'INCOME_SALARY', merchant: 'Acme' };
  for (const d of ['2026-08-28', '2026-09-11', '2026-09-25']) tx('chk', d, -2500, 'ACME PAYROLL', pay); // every 2 weeks → Oct 9, Oct 23
  const rent = { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT', merchant: 'Landlord' };
  for (const d of ['2026-08-05', '2026-09-05']) tx('chk', d, 1500, 'RENT', rent); // Oct 5
  for (const d of ['2026-08-20', '2026-09-20']) tx('chk', d, 80, 'POWER CO', { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', merchant: 'Power Co' }); // Oct 20
  classify();
  const s = freeToSpend(TODAY);
  assert.equal(s.until, '2026-10-31');
  assert.equal(s.cash, 3000);
  assert.equal(s.incomeTotal, 5000);
  assert.deepEqual(s.due.map((o) => o.name).sort(), ['Landlord', 'Power Co']);
  assert.equal(s.owed, 250);
  assert.equal(s.free, 3000 + 5000 - 1580 - 250);
});

test('twice a month: a day and the month end, each moved to the business day before', async () => {
  const { nextFromRule, ruleText, frequencyOf } = await import('../server/recurring.js');
  const r = { kind: 'semi', n: 15, roll: -1 };
  assert.equal(nextFromRule(r, '2026-10-01'), '2026-10-15');
  assert.equal(nextFromRule(r, '2026-10-16'), '2026-10-30'); // Oct 31, 2026 is a Saturday
  assert.equal(nextFromRule(r, '2026-11-01'), '2026-11-13'); // Nov 15 is a Sunday
  assert.equal(frequencyOf(r), 'Twice a month');
  assert.match(ruleText(r), /15th and the last day/);
});

test('a single paycheck is offered for "how often are you paid?" until answered', async () => {
  const { paycheckCandidates, paycheckRule, markPaycheckHandled } = await import('../server/recurring.js');
  db.prepare("DELETE FROM meta WHERE key = 'paycheck_handled'").run();
  tx('chk', '2026-09-17', -3510.35, 'DIRECT DEPOSIT ACME CORP, INCDIR DEP (Cash)', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const [c] = paycheckCandidates('2026-10-01');
  assert.equal(c.name, 'Acme Corp');
  assert.equal(c.amount, 3510.35);
  assert.deepEqual(paycheckRule('biweekly', c.date), { kind: 'weeks', n: 2, anchor: '2026-09-17' });
  markPaycheckHandled(c.key);
  assert.equal(paycheckCandidates('2026-10-01').length, 0);
});
