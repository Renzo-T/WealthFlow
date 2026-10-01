import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';

const { describe } = await import('../server/describe.js');
const { _test: { tidy } } = await import('../server/insights.js');

test('bank descriptions become readable', () => {
  assert.equal(describe('ONLINE/MOBILE PAYMENT CONF#M08104055672'), 'Online/Mobile Payment');
  assert.equal(describe('Bank of America DES:CASHREWARD ID:DOE INDN:XXXXX1234XXXXX46XXXXX0 CO ID:XXXXX90310 PPD'), 'Bank of America · CASHREWARD');
  assert.equal(describe('ANTHROPIC CLAUDE SUB'), 'Anthropic Claude Sub');
  assert.equal(describe('DIRECT DEBIT Maple ApartmRENT (Cash)'), 'DIRECT DEBIT Maple ApartmRENT', 'mixed case is left alone');
  assert.equal(describe(''), '');
});

test('income sources get short names', () => {
  assert.equal(tidy('DIRECT DEPOSIT ACME CORP, INCDIR DEP (Cash)'), 'Acme Corp');
  assert.equal(tidy('Northwind Brokerage'), 'Northwind Brokerage');
  assert.equal(tidy('ACME CORP PAYROLL PPD'), 'Acme');
});
