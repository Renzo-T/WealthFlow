// Contributions taken from your pay (server/contributions.js): only Plaid's cash/contribution entries count; deposits
// (realized gains, fund exchanges), $0 transfer-outs and anything matching a bank transfer are left out; and Net worth
// counts them as money put in, not as a market gain.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx } from './helpers.js';

const { saveInvestmentTransactions, payContributions, contributionSummary, fetchStart } = await import('../server/contributions.js');
const { netWorthBreakdown } = await import('../server/summary.js');
const { yearInReview } = await import('../server/reports.js');

// Calendar days back (not 24-hour steps, which slip a day across a daylight-saving change).
const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString('en-CA'); };
let n = 0;
// Plaid investment transaction: positive = cash out of the account, negative = cash in.
const inv = (account_id, date, amount, type, subtype, name = `${subtype}`) =>
  ({ investment_transaction_id: `i${++n}`, account_id, date, amount, type, subtype, name });

beforeEach(() => {
  reset();
  db.prepare('DELETE FROM investment_transactions').run();
  db.prepare('DELETE FROM balance_snapshots').run();
  bank('b1');
  account('chk', { mask: '1111', balance: 5000 });
  account('k401', { type: 'investment', subtype: '401k', mask: '2222', name: 'Acme Corp 401(k)', balance: 10000 });
  account('ira', { type: 'investment', subtype: 'roth', mask: '3333', name: 'Roth IRA', balance: 2000 });
});

test('only cash/contribution money coming in counts; gains, exchanges and $0 transfer-outs do not', () => {
  saveInvestmentTransactions(['k401'], d(60), [
    inv('k401', d(20), -500, 'cash', 'contribution', 'S&P 500 INDEX - contribution'),
    inv('k401', d(20), 0, 'cash', 'withdrawal', 'S&P 500 INDEX - transferOut'),
    inv('k401', d(10), -46000, 'cash', 'deposit', 'S&P 500 INDEX - realizedGainLoss'),
    inv('k401', d(10), 200000, 'buy', 'buy', 'exchangeIn'),
    inv('k401', d(10), -200000, 'sell', 'sell', 'exchangeOut'),
    inv('k401', d(6), -500, 'cash', 'contribution'),
    inv('k401', d(5), 12, 'fee', 'miscellaneous fee'),
  ]);
  const list = payContributions(d(30), d(0));
  assert.deepEqual(list.map((c) => c.amount), [500, 500]);
  assert.equal(list[0].account, 'Acme Corp 401(k)');
});

test('a contribution that matches money seen leaving the bank is a transfer you made, not one from your pay', () => {
  saveInvestmentTransactions(['ira'], d(60), [inv('ira', d(8), -250, 'cash', 'contribution')]);
  const out = tx('chk', d(9), 250, 'Transfer to Roth IRA');
  db.prepare('UPDATE transactions SET transfer_account = ? WHERE id = ?').run('ira', out);
  assert.deepEqual(payContributions(d(30), d(0)), []);
  // Same amount but weeks apart: not the same money.
  db.prepare('UPDATE transactions SET date = ? WHERE id = ?').run(d(25), out);
  assert.equal(payContributions(d(30), d(0)).length, 1);
});

test('saving again replaces the window it covers (a corrected or removed entry goes) and keeps older history', () => {
  saveInvestmentTransactions(['k401'], d(400), [inv('k401', d(300), -100, 'cash', 'contribution'), inv('k401', d(20), -100, 'cash', 'contribution')]);
  assert.equal(fetchStart(['k401']), d(90)); // seen before: only the recent past again
  saveInvestmentTransactions(['k401'], d(90), [inv('k401', d(20), -120, 'cash', 'contribution')]);
  assert.deepEqual(payContributions(d(400), d(0)).map((c) => c.amount), [100, 120]);
});

test('Investments summary: this year and the last 12 months per account, with the latest one', () => {
  const today = d(0), y = today.slice(0, 4);
  saveInvestmentTransactions(['k401'], `${+y - 1}-01-01`, [
    inv('k401', `${+y - 1}-12-15`, -300, 'cash', 'contribution'), inv('k401', `${y}-01-02`, -400, 'cash', 'contribution'),
  ]);
  const s = contributionSummary(`${y}-01-10`);
  assert.equal(s.year, 400);
  assert.equal(s.last12, 700);
  assert.deepEqual(s.accounts[0].last, { date: `${y}-01-02`, amount: 400 });
});

test('Net worth: a contribution from your pay is money put in, not a market gain', () => {
  // Real daily values for both accounts over the last 31 days: the 401(k) grows by 600, 500 of it contributed.
  for (let i = 0; i <= 31; i++) {
    db.prepare('INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(i), 'chk', 5000);
    db.prepare('INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(i), 'k401', i > 10 ? 9400 : 10000);
    db.prepare('INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)').run(d(i), 'ira', 2000);
  }
  saveInvestmentTransactions(['k401'], d(60), [inv('k401', d(10), -500, 'cash', 'contribution')]);
  const b = netWorthBreakdown('30d');
  assert.equal(b.available, true);
  assert.equal(Math.round(b.fromPay), 500);
  assert.equal(Math.round(b.market), 100);
  assert.deepEqual(b.fromPayItems.map((a) => [a.name, a.amount, a.count]), [['Acme Corp 401(k)', 500, 1]]);
  const k = b.investments.find((a) => a.name === 'Acme Corp 401(k)');
  assert.equal(Math.round(k.change), 100);
});

test('Year in review: contributions from your pay count as saved, and the rate is over income plus them', () => {
  const y = new Date().getFullYear();
  saveInvestmentTransactions(['k401'], `${y}-01-01`, [inv('k401', `${y}-01-05`, -1000, 'cash', 'contribution')]);
  tx('chk', `${y}-01-03`, -4000, 'Acme Corp payroll', { primary: 'INCOME', detailed: 'INCOME_WAGES' });
  tx('chk', `${y}-01-04`, 1000, 'Grocer', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  db.prepare("UPDATE transactions SET grp = 'Income', category = 'Salary' WHERE name = 'Acme Corp payroll'").run();
  db.prepare("UPDATE transactions SET grp = 'Food', category = 'Groceries' WHERE name = 'Grocer'").run();
  const r = yearInReview(y, `${y}-12-31`);
  assert.equal(r.fromPay, 1000);
  assert.equal(r.saved, 4000);
  assert.equal(Math.round(r.rate), 80);
});

test('Money flow: each account with contributions from pay is its own source, into Savings & investments', async () => {
  const { flow, accountFlow } = await import('../server/insights.js');
  saveInvestmentTransactions(['k401'], d(60), [inv('k401', d(10), -500, 'cash', 'contribution'), inv('k401', d(40), -500, 'cash', 'contribution')]);
  tx('chk', d(12), -3000, 'Acme Corp payroll');
  db.prepare("UPDATE transactions SET grp = 'Income', category = 'Salary' WHERE name = 'Acme Corp payroll'").run();
  const f = flow(d(30), d(-1));
  assert.equal(f.income, 3000); // take-home pay only
  assert.equal(f.fromPay, 500);
  assert.deepEqual(f.sources.filter((s) => s.pay).map((s) => [s.name, s.value]), [['Acme Corp 401(k) from pay', 500]]);
  assert.deepEqual(f.categories.filter((c) => c.name === 'Savings & investments').map((c) => [c.value, c.fromPay]), [[500, 500]]);
  const left = f.sources.reduce((s, x) => s + x.value, 0), right = f.categories.reduce((s, x) => s + x.value, 0);
  assert.equal(Math.round(left), Math.round(right)); // both sides still balance
  const g = accountFlow(d(30), d(-1));
  assert.ok(g.links.some((l) => l.source === 'p:k401' && l.target === 'a:k401' && l.value === 500));
});
