import test from 'node:test';
import assert from 'node:assert/strict';
import { ago, syncLine } from '../web/src/syncStatus.js';

const now = Date.parse('2026-11-16T12:00:00Z');
const before = (min) => new Date(now - min * 60000).toISOString();

test('ago uses minutes, hours then days', () => {
  assert.equal(ago(before(0), now), 'just now');
  assert.equal(ago(before(14), now), '14 min ago');
  assert.equal(ago(before(180), now), '3 h ago');
  assert.equal(ago(before(3 * 1440), now), '3 d ago');
});

test('syncLine says Synced, Checking while a sync runs, and Not synced yet with no sync', () => {
  assert.equal(syncLine(before(14), false, now), 'Synced 14 min ago');
  assert.equal(syncLine(before(14), true, now), 'Checking for new data…');
  assert.equal(syncLine(null, false, now), 'Not synced yet');
});
