import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';

const { reachedOn } = await import('../server/goals.js');
const hist = (...b) => b.map((balance, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, balance }));

test('reachedOn: the first day of the run at or over the target that is still going', () => {
  assert.equal(reachedOn(hist(100, 900, 1000, 1200), 1000), '2026-10-03');
  // dipped below and came back: counts from the comeback
  assert.equal(reachedOn(hist(100, 1000, 900, 1100, 1100), 1000), '2026-10-04');
});

test('reachedOn: unknown when not over the target now or when the history starts over it', () => {
  assert.equal(reachedOn(hist(100, 900), 1000), null);
  assert.equal(reachedOn(hist(1500, 1600), 1000), null);
  assert.equal(reachedOn([], 1000), null);
});
