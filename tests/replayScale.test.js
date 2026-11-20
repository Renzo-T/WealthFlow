import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capOf, replayRange } from '../web/src/replayScale.js';

const month = (cash, start = cash[0]) => ({ start, days: cash.map((v) => ({ cash: v })), cushion: 0 });

test('a few days far above the rest cap the top, so the rest of the month keeps its shape', () => {
  // Two days at ~35K, then a sweep to investments; the rest of the month moves between 6K and 9K.
  const cash = [35400, 35100, 7200, 7000, 6800, 9100, 8900, 8700, 8600, 6400, 6300, 6900, 6700, 6500];
  assert.equal(capOf(cash), 9100);
  const [lo, hi, capped] = replayRange(month(cash, 35381));
  assert.equal(capped, true);
  assert.ok(hi < 10000 && lo <= 6300, `range ${lo}..${hi}`);
});

test('a steady month is never capped', () => {
  const cash = [5000, 5400, 5900, 6300, 6800, 7200, 7700, 8100, 8600, 9000];
  assert.equal(capOf(cash), null);
  assert.equal(replayRange(month(cash))[2], false);
});

test('lows are never capped: a dip far below the rest still fits', () => {
  const cash = [9000, 9100, 8900, 9050, -1200, 8800, 9000, 8950];
  assert.equal(capOf(cash), null);
  const [lo] = replayRange(month(cash));
  assert.ok(lo < -1200);
});

test('half the month high is a real level, not a few stray days', () => {
  const cash = [30000, 30100, 29900, 30050, 30000, 6000, 6100, 5900, 6050, 6000];
  assert.equal(capOf(cash), null);
});

test('the cushion always fits under the range', () => {
  const [lo] = replayRange({ start: 40000, days: [40000, 39000, 8000, 7900, 7800, 7700, 7600, 7500].map((cash) => ({ cash })), cushion: 3000 });
  assert.ok(lo <= 3000);
});
