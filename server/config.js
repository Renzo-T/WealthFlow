// Settings: the Plaid keys and environment, and the key that encrypts bank tokens. They come from environment
// variables (a .env file still works) or, normally, from config.json in the data folder, which the app's first-run
// setup screen writes. Environment variables win, so an existing .env keeps working unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Where everything is kept: the database, backups and config.json. WEALTHFLOW_DATA_DIR moves it (the desktop app
// uses the user's app-data folder).
export const dataDir = path.resolve(process.env.WEALTHFLOW_DATA_DIR || 'data');
const FILE = path.join(dataDir, 'config.json');
const KEYS = ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV', 'PLAID_REDIRECT_URI', 'ENCRYPTION_KEY'];

const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
export function config() {
  const file = readFile();
  return Object.fromEntries(KEYS.map((k) => [k, process.env[k] || file[k] || '']));
}
// Where each value came from, so the app can say "set in .env" instead of offering to change it.
export const fromEnv = (k) => !!process.env[k];

export function saveConfig(patch) {
  fs.mkdirSync(dataDir, { recursive: true });
  const next = { ...readFile(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null) delete next[k];
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
}

// The encryption key: generated on first start if there isn't one. Losing it means reconnecting every bank, so it
// lives next to the data (and backups include it).
export function ensureEncryptionKey() {
  const k = config().ENCRYPTION_KEY;
  if (k) {
    if (Buffer.from(k, 'hex').length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes of hex (64 characters).');
    return false;
  }
  saveConfig({ ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') });
  return true;
}

export const plaidConfigured = () => { const c = config(); return !!(c.PLAID_CLIENT_ID && c.PLAID_SECRET); };
