// Refunds count one way everywhere (spendingBetween, the dashboard's rule): a refund lowers its own group's spending,
// never below zero, and anything beyond that is named as refunds, never taken off another group.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx } from './helpers.js';

const { flow } = await import('../server/insights.js');
const { monthByMonth, yearInReview } = await import('../server/reports.js');

// This month: reports start a few months before the first connection, so older months may be left out.
const now = new Date(), y = now.getFullYear(), m = now.toLocaleDateString('en-CA').slice(0, 7);
const next = new Date(y, now.getMonth() + 1, 1).toLocaleDateString('en-CA');
const put = (date, amount, name, grp, category) => {
  const id = tx('chk', date, amount, name);
  db.prepare('UPDATE transactions SET grp = ?, category = ? WHERE id = ?').run(grp, category, id);
};

beforeEach(() => {
  reset();
  bank('b1'); account('chk');
  put(`${m}-02`, -3000, 'Acme Corp payroll', 'Income', 'Salary');
  put(`${m}-05`, 400, 'Grocer', 'Food', 'Groceries');
  put(`${m}-06`, 100, 'Airline seat fee', 'Travel', 'Flights');
  put(`${m}-20`, -700, 'Airline refund', 'Travel', 'Flights'); // refunds a trip booked earlier: 600 beyond this month's travel
});

test('Money flow: Spending matches the chart, and refunds beyond a group are one Refunds source', () => {
  const f = flow(`${m}-01`, next);
  assert.equal(f.spending, 400); // Travel nets below zero, so it adds nothing; it never lowers Food
  assert.deepEqual(f.sources.filter((s) => s.credit).map((s) => [s.name, s.value, s.parts.map((p) => p.name)]), [['Refunds', 600, ['Travel']]]);
  assert.equal(f.refunds, 600);
  const left = f.sources.reduce((s, x) => s + x.value, 0), right = f.categories.reduce((s, x) => s + x.value, 0);
  assert.equal(Math.round(left), Math.round(right));
});

test('Month by month: a group never shows below zero; the refund beyond it is noted, and the total skips it', () => {
  const r = monthByMonth(12, `${m}-28`);
  const i = r.months.indexOf(m);
  const travel = r.groups.find((g) => g.group === 'Travel');
  assert.equal(travel.values[i], 0);
  assert.equal(travel.refunded[i], 600);
  assert.equal(r.totals.spending.values[i], 400);
  assert.equal(r.totals.spending.refunded[i], 600);
});

test('Year in review: spending uses the same rule', () => {
  const r = yearInReview(y, `${y}-12-31`);
  assert.equal(r.spending, 400);
  assert.deepEqual(r.byMonth.map((x) => [x.m, x.v]), [[m, 400]]);
});
