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
