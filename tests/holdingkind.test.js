import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
const { holdingKind } = await import('../server/insights.js');

test('workplace-plan index funds get a real class, not Other', () => {
  assert.equal(holdingKind({ type: 'mutual fund', name: 'Acme S&P 500 Index Fund' }), 'Index funds');
  assert.equal(holdingKind({ type: 'other', name: 'Acme Total Market Collective Investment Trust' }), 'Index funds');
  assert.equal(holdingKind({ type: null, name: 'Acme International CIT Class C' }), 'Index funds');
  assert.equal(holdingKind({ type: 'other', name: 'Acme Target Date 2050 Fund' }), 'Target date funds');
  assert.equal(holdingKind({ type: 'mutual fund', name: 'Acme Aggregate Bond Index' }), 'Bonds');
});

test('existing classes are unchanged', () => {
  assert.equal(holdingKind({ type: 'etf', name: 'Acme S&P 500 Index ETF' }), 'ETFs');
  assert.equal(holdingKind({ type: 'equity', subtype: 'common stock', name: 'Acme Corp' }), 'Stocks');
  assert.equal(holdingKind({ type: 'equity', name: 'Acme Plan Fund' }), 'Employer plan funds');
  assert.equal(holdingKind({ type: 'other', name: 'Acme Bank Deposit Sweep' }), 'Cash');
  assert.equal(holdingKind({ type: 'mutual fund', name: 'Acme Growth Fund' }), 'Mutual funds');
  assert.equal(holdingKind({ type: 'other', name: 'Mystery asset' }), 'Other');
});
