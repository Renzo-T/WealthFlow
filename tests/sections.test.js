import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionOf, tabTarget } from '../web/src/sections.js';

const S = [{ label: 'Today', ids: ['dashboard'] }, { label: 'Spending', ids: ['transactions', 'budget', 'bills'] }];

test('sectionOf finds the section a page belongs to, none for Settings', () => {
  assert.equal(sectionOf(S, 'budget').label, 'Spending');
  assert.equal(sectionOf(S, 'settings'), undefined);
});

test('tabTarget opens the last page used, else the first, ignoring stale values', () => {
  assert.equal(tabTarget(S, S[1], { Spending: 'bills' }), 'bills');
  assert.equal(tabTarget(S, S[1], {}), 'transactions');
  assert.equal(tabTarget(S, S[1], { Spending: 'gone' }), 'transactions');
  assert.equal(tabTarget(S, S[0], null), 'dashboard');
});
