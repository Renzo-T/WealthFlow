import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGhosts, exitList } from '../web/src/exitList.js';

const key = (r) => r.id;
const rows = (...ids) => ids.map((id) => ({ id }));

test('a sorted row stays in its place, marked leaving, until its stamp is done', () => {
  const prev = rows(1, 2, 3), next = rows(1, 3);
  const ghosts = nextGhosts(prev, next, [], key);
  assert.deepEqual(exitList(next, ghosts, key).map((r) => [r.key, r.leaving]), [[1, false], [2, true], [3, false]]);
  assert.deepEqual(exitList(next, [], key).map((r) => r.key), [1, 3]); // after the hold it is gone
});

test('several rows sorted at once keep their order; earlier ones still stamping are not dropped', () => {
  const g1 = nextGhosts(rows(1, 2, 3, 4), rows(1, 3, 4), [], key);
  const g2 = nextGhosts(rows(1, 3, 4), rows(1, 4), g1, key);
  assert.deepEqual(exitList(rows(1, 4), g2, key).map((r) => r.key), [1, 2, 3, 4]);
  assert.equal(g2.length, 2);
});

test('rows that are merely still there, or the first load, never stamp', () => {
  assert.deepEqual(nextGhosts(rows(1, 2), rows(1, 2), [], key), []);
  assert.deepEqual(nextGhosts(undefined, rows(1, 2), [], key), []);
});

test('with reduced motion the row leaves at once', () => {
  assert.deepEqual(nextGhosts(rows(1, 2), rows(1), [], key, true), []);
});

test('a row that comes back stops leaving', () => {
  const g = nextGhosts(rows(1, 2), rows(1), [], key);
  const back = nextGhosts(rows(1), rows(1, 2), g, key);
  assert.deepEqual(exitList(rows(1, 2), back, key).map((r) => r.leaving), [false, false]);
});
