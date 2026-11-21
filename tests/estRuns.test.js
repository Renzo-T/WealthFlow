// The estimated vs real stretches of a balance line, shared by the net worth chart and the account sparklines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estRuns } from '../web/src/estRuns.js';

test('balance lines: a lone missed sync is bridged, two estimated days in a row stay estimated, runs share their ends', () => {
  const { real, runs } = estRuns([true, true, false, true, false, false, true, true]);
  assert.deepEqual(real, [false, false, true, true, true, true, false, false]); // day 3 sits between two real days
  assert.deepEqual(runs, [{ est: true, from: 0, to: 1 }, { est: false, from: 1, to: 5 }, { est: true, from: 5, to: 7 }]);
  assert.deepEqual(estRuns([false, false]).runs, [{ est: false, from: 0, to: 1 }]); // all real: one solid run
  assert.deepEqual(estRuns([true, false]).real, [false, true]); // an end day is never bridged
});
