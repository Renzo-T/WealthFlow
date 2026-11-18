import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { classify } = await import('../server/categories.js');
const { accountHistory } = await import('../server/summary.js');
const d = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA');
const snap = (id, n, balance) => db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(n), id, balance);

beforeEach(() => {
  reset(); db.prepare('DELETE FROM balance_snapshots').run();
  bank('b1');
  account('chk', { mask: '1111', balance: 5000 });
  // Connected after the money arrived: Plaid gives no history for it, only today's value.
  account('brk', { type: 'investment', subtype: 'brokerage', mask: '3456', balance: 30000 });
  snap('chk', 0, 5000); snap('brk', 0, 30000);
});

test('a transfer you categorized still links to the account it names; its category stays yours', () => {
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('TRANSFERRED TO', 'Investments')").run();
  const id = tx('chk', d(5), 28000, 'TRANSFERRED TO VS Z99-123456-1', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  classify();
  assert.equal(row(id).category, 'Investments');
  assert.equal(row(id).cat_source, 'rule');
  assert.equal(row(id).transfer_account, 'brk');
});

test('net worth history: money moved into an account with no history isn\'t counted there before it arrived', () => {
  db.prepare("INSERT INTO category_rules (pattern, category) VALUES ('TRANSFERRED TO', 'Investments')").run();
  tx('chk', d(5), 28000, 'TRANSFERRED TO VS Z99-123456-1', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  classify();
  const accts = db.prepare('SELECT * FROM accounts').all();
  const h = accountHistory(accts, 10);
  const on = (id, n) => h[id].find((p) => p.date === d(n)).balance;
  assert.equal(on('chk', 6), 33000); // before the transfer the money was in checking...
  assert.equal(on('brk', 6), 2000); // ...and not yet in the brokerage account
  assert.equal(on('chk', 6) + on('brk', 6), 35000); // counted once
  assert.equal(on('brk', 5), 30000); // from the day it arrived
});

test('an account with no history never rewinds below zero', () => {
  tx('chk', d(5), 40000, 'TRANSFER TO 3456', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  classify();
  const h = accountHistory(db.prepare('SELECT * FROM accounts').all(), 10);
  assert.equal(h.brk.find((p) => p.date === d(6)).balance, 0);
});

// Assets you add by hand have a value history: a new value counts from the day it changed, not for every past day.
test('net worth history: raising an asset you added after moving money into it doesn\'t show a drop before the move', async () => {
  const { netWorthHistory } = await import('../server/summary.js');
  const { setValue, linkTransfer, manualAssets, valueOn } = await import('../server/assets.js');
  db.prepare("UPDATE accounts SET balance = 0 WHERE id = 'brk'").run(); snap('brk', 0, 0);
  // $28,000 lent to a friend from checking 5 days ago; the loan was already $40,000.
  const t = tx('chk', d(5), 28000, 'TRANSFER TO 9999', { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' });
  classify();
  const { lastInsertRowid: id } = db.prepare("INSERT INTO manual_assets (name, value, kind) VALUES ('Loan to Alex Rivera', 68000, 'receivable')").run();
  setValue(Number(id), '', 68000); // entered as one value after the move, as the old form did
  const on = (n) => netWorthHistory().find((p) => p.date === d(n)).value;
  assert.equal(on(6) - on(4), 28000); // today's value backdated: the move reads as a $28,000 drop

  // "Its value already includes it": before the move the loan was $28,000 lower.
  linkTransfer({ id: Number(id), kind: 'receivable' }, row(t), 'included');
  assert.equal(on(6), on(4)); // flat: the money only moved
  const a = manualAssets()[0];
  assert.equal(valueOn(a.entries, d(6)), 40000);
  assert.equal(valueOn(a.entries, d(0)), 68000);
  assert.equal(a.value, 68000); // today's value is unchanged
});

test('assets you added: a later value counts from its date; one you got later adds nothing before then', async () => {
  const { netWorthHistory } = await import('../server/summary.js');
  const { setValue, linkTransfer, manualAssets, valueOn } = await import('../server/assets.js');
  const ins = (name, kind) => Number(db.prepare('INSERT INTO manual_assets (name, value, kind) VALUES (?, 0, ?)').run(name, kind).lastInsertRowid);
  const home = ins('Home', 'real_estate');
  setValue(home, '', 300000); setValue(home, d(3), 320000);
  const car = ins('Car', 'vehicle');
  setValue(car, d(2), 15000); // bought 2 days ago
  const loan = ins('Car loan', 'liability');
  setValue(loan, '', 10000);
  tx('chk', d(10), 5, 'SHOP'); // history reaches back 10 days; no money moves in the days compared below
  const h = netWorthHistory(), at = (n) => h.find((p) => p.date === d(n)).value;
  assert.equal(at(6), 35000 + 300000 - 10000);
  assert.equal(at(3) - at(4), 20000); // the home's new value, from its date
  assert.equal(at(2) - at(3), 15000); // the car, from the day you got it
  // Paying $1,000 toward the loan from checking (counted toward it): the debt drops from that day.
  const pay = tx('chk', d(1), 1000, 'LOAN PAYMENT', { primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CAR_PAYMENT' });
  classify();
  linkTransfer({ id: loan, kind: 'liability' }, row(pay), 'add');
  const l = manualAssets().find((a) => a.id === loan);
  assert.equal(valueOn(l.entries, d(2)), 10000);
  assert.equal(valueOn(l.entries, d(1)), 9000);
});
