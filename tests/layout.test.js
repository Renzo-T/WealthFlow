import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultLayout, mergeLayout } from '../web/src/layout.js';

const PANELS = [{ id: 'cards' }, { id: 'networth' }, { id: 'upcoming', rail: true }, { id: 'recent' }];

test('no saved layout → the default', () => {
  assert.deepEqual(mergeLayout(null, PANELS), defaultLayout(PANELS));
  assert.deepEqual(defaultLayout(PANELS).rail, ['upcoming']);
});

test('your order and hidden panels are kept', () => {
  const l = mergeLayout({ order: ['recent', 'cards', 'networth', 'upcoming'], hidden: ['networth'], rail: [] }, PANELS);
  assert.deepEqual(l.order, ['recent', 'cards', 'networth', 'upcoming']);
  assert.deepEqual(l.hidden, ['networth']);
  assert.deepEqual(l.rail, [], 'you moved Upcoming out of the side column; it stays out');
});

test('a panel added later appears at its default spot, visible, and in the side column if that is its default', () => {
  const later = [...PANELS.slice(0, 2), { id: 'watchlist' }, ...PANELS.slice(2), { id: 'cashnow', rail: true }];
  const l = mergeLayout({ order: ['recent', 'cards', 'networth', 'upcoming'], hidden: [], rail: ['upcoming'] }, later);
  assert.deepEqual(l.order, ['recent', 'cards', 'networth', 'watchlist', 'upcoming', 'cashnow']);
  assert.ok(!l.hidden.includes('watchlist'));
  assert.deepEqual(l.rail, ['upcoming', 'cashnow']);
});

test('panels that no longer exist are dropped', () => {
  const l = mergeLayout({ order: ['old', 'cards', 'networth', 'upcoming', 'recent'], hidden: ['old'], rail: ['old'] }, PANELS);
  assert.deepEqual(l.order, ['cards', 'networth', 'upcoming', 'recent']);
  assert.deepEqual(l.hidden, []);
  assert.deepEqual(l.rail, []);
});

// Panels that start hidden for people with no saved layout (Customize still lists them).
const WITH_HIDDEN = [{ id: 'cards' }, { id: 'networth' }, { id: 'allocation', hidden: true }, { id: 'upcoming', rail: true, hidden: true }, { id: 'recent' }];

test('a saved layout is untouched by panels that are hidden by default', () => {
  const saved = { order: ['recent', 'cards', 'networth', 'allocation', 'upcoming'], hidden: ['networth'], rail: ['upcoming'] };
  const l = mergeLayout(saved, WITH_HIDDEN);
  assert.deepEqual(l, saved, 'a layout that shows Allocation and Upcoming keeps showing them');
  assert.deepEqual(mergeLayout({ order: saved.order, hidden: [], rail: [] }, WITH_HIDDEN).hidden, []);
});

test('no saved layout (or a reset) → panels marked hidden start hidden but stay in the order', () => {
  const l = mergeLayout(null, WITH_HIDDEN);
  assert.deepEqual(l.hidden, ['allocation', 'upcoming']);
  assert.deepEqual(l.order, ['cards', 'networth', 'allocation', 'upcoming', 'recent']);
  assert.deepEqual(defaultLayout(WITH_HIDDEN), l);
});

test('a hidden-by-default panel added later starts hidden in a saved layout; a normal new one does not', () => {
  const later = [...WITH_HIDDEN, { id: 'extra', hidden: true }, { id: 'fresh' }];
  const saved = { order: ['cards', 'networth', 'allocation', 'upcoming', 'recent'], hidden: [], rail: ['upcoming'] };
  const l = mergeLayout(saved, later);
  assert.deepEqual(l.hidden, ['extra']);
  assert.ok(l.order.includes('extra') && l.order.includes('fresh'));
});

test('a saved layout that still names removed dashboard panels drops them', () => {
  const now = [{ id: 'cards' }, { id: 'recent' }];
  const l = mergeLayout({ order: ['cards', 'upcoming', 'safe', 'projection', 'recent'], hidden: ['upcoming', 'safe', 'projection'], rail: ['upcoming', 'safe'] }, now);
  assert.deepEqual(l, { order: ['cards', 'recent'], hidden: [], rail: [] });
});

// Two panels merged into one: the dashboard's month spread and glance sheet became "This month" (id month, was glance).
const MERGED = [{ id: 'cards' }, { id: 'month', was: ['glance'] }, { id: 'insight' }, { id: 'recent' }];

test('a merged panel takes the earlier of the two positions, once', () => {
  const l = mergeLayout({ order: ['recent', 'glance', 'cards', 'month', 'insight'], hidden: [], rail: [] }, MERGED);
  assert.deepEqual(l.order, ['recent', 'month', 'cards', 'insight']);
  assert.deepEqual(l.hidden, []);
});

test('a merged panel is hidden only if both panels it replaced were hidden', () => {
  const keptMonth = mergeLayout({ order: ['cards', 'month', 'glance', 'insight', 'recent'], hidden: ['glance'], rail: [] }, MERGED);
  assert.ok(!keptMonth.hidden.includes('month'), 'you kept the month spread, so the merged panel shows');
  const keptGlance = mergeLayout({ order: ['cards', 'month', 'glance', 'insight', 'recent'], hidden: ['month'], rail: [] }, MERGED);
  assert.ok(!keptGlance.hidden.includes('month'), 'you kept the glance sheet, so the merged panel shows');
  const both = mergeLayout({ order: ['cards', 'month', 'glance', 'insight', 'recent'], hidden: ['month', 'glance', 'recent'], rail: [] }, MERGED);
  assert.deepEqual(both.hidden, ['recent', 'month']);
  assert.deepEqual(both.order, ['cards', 'month', 'insight', 'recent']);
});

test('a saved layout that only had the old id gets the new one in its place', () => {
  const l = mergeLayout({ order: ['glance', 'cards', 'insight', 'recent'], hidden: ['glance'], rail: ['glance'] }, MERGED);
  assert.deepEqual(l, { order: ['month', 'cards', 'insight', 'recent'], hidden: ['month'], rail: ['month'] });
});

test('a layout saved after the merge is left as it is', () => {
  const saved = { order: ['cards', 'month', 'insight', 'recent'], hidden: ['insight'], rail: [] };
  assert.deepEqual(mergeLayout(saved, MERGED), saved);
});
