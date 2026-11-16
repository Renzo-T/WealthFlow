import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';

const { statusText } = await import('../web/src/goalStatus.js');

test('goal status: "to go" below the target, nothing at exactly the target, "past the target" only above it', () => {
  assert.match(statusText({ saved: 400, target: 1000 }), /600.* to go/);
  assert.equal(statusText({ saved: 1000, target: 1000 }), '');
  assert.match(statusText({ saved: 1250, target: 1000 }), /250.* past the target/);
});
