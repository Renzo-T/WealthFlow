// Settings kept in config.json (in the test's throwaway data folder): the encryption key made on first start, and
// environment variables (.env) winning over the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './helpers.js';

const { config, saveConfig, ensureEncryptionKey, plaidConfigured, dataDir } = await import('../server/config.js');
const file = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'));
const withoutEnv = (keys, fn) => {
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  keys.forEach((k) => delete process.env[k]);
  try { return fn(); } finally { for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v; }
};

test('the encryption key is created once, on first start, and kept', () => withoutEnv(['ENCRYPTION_KEY'], () => {
  assert.equal(ensureEncryptionKey(), true);
  const key = file().ENCRYPTION_KEY;
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(ensureEncryptionKey(), false);
  assert.equal(config().ENCRYPTION_KEY, key);
}));

test('a malformed key stops the app instead of being replaced (that would lose every bank connection)', () => {
  process.env.ENCRYPTION_KEY = 'abc';
  try { assert.throws(() => ensureEncryptionKey(), /64 characters/); } finally { process.env.ENCRYPTION_KEY = '0'.repeat(64); }
});

test('keys saved in the app are used, .env wins over them, and empty values are dropped', () => withoutEnv(['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'], () => {
  assert.equal(plaidConfigured(), false);
  saveConfig({ PLAID_CLIENT_ID: 'id-from-app', PLAID_SECRET: 'secret-from-app', PLAID_ENV: 'production' });
  assert.equal(plaidConfigured(), true);
  assert.equal(config().PLAID_ENV, 'production');
  process.env.PLAID_ENV = 'sandbox';
  assert.equal(config().PLAID_ENV, 'sandbox');
  delete process.env.PLAID_ENV;
  saveConfig({ PLAID_SECRET: '' });
  assert.ok(!('PLAID_SECRET' in file()));
  assert.ok('ENCRYPTION_KEY' in file()); // saving keys never drops the encryption key
}));
