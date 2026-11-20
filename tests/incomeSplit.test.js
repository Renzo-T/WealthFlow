import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomeSplit } from '../web/src/incomeSplit.js';

const line = (category, budget, actual) => ({ category, budget, actual });

test('one income line over while another budgeted one has received nothing: flagged', () => {
  const s = incomeSplit([line('Income', 9000, 0), line('Salary', 1200, 4000), line('Dividends', 80, 0)]);
  assert.equal(s.over.category, 'Salary');
  assert.equal(s.idle.category, 'Income');
  assert.equal(s.extra, 2800);
});

test('paid as budgeted, or a small overage: nothing to say', () => {
  assert.equal(incomeSplit([line('Income', 9000, 0), line('Salary', 4000, 4000)]), null);
  assert.equal(incomeSplit([line('Income', 9000, 0), line('Salary', 4000, 4050)]), null);
});

test('the other line has received something, or is too small to be pay: not flagged', () => {
  assert.equal(incomeSplit([line('Income', 9000, 300), line('Salary', 1200, 4000)]), null);
  assert.equal(incomeSplit([line('Dividends', 50, 0), line('Salary', 1200, 4000)]), null);
});

test('unbudgeted lines and whole-group lines are ignored', () => {
  assert.equal(incomeSplit([line('Income', null, 0), line('Salary', 1200, 4000)]), null);
  assert.equal(incomeSplit([{ ...line('Income', 9000, 0), isGroup: true }, line('Salary', 1200, 4000)]), null);
});
