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
