import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';

// WEALTHFLOW_DB points elsewhere for tests (':memory:'), so they never touch your real data.
const file = process.env.WEALTHFLOW_DB || path.join(dataDir, 'wealthflow.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
if (file !== ':memory:') db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, institution TEXT, access_token TEXT NOT NULL,
  cursor TEXT, status TEXT DEFAULT 'ok', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, item_id TEXT, name TEXT, mask TEXT, type TEXT, subtype TEXT,
  balance REAL, currency TEXT, in_networth INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, account_id TEXT, date TEXT, name TEXT, merchant TEXT,
  amount REAL, category TEXT, pending INTEGER);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
-- Your edits to a bill (schedule, amount, hidden), or a bill you added yourself (manual = 1). Keyed by the
-- bill's key from recurring.js. rule is JSON.
CREATE TABLE IF NOT EXISTS bill_settings (
  key TEXT PRIMARY KEY, manual INTEGER DEFAULT 0, name TEXT, direction TEXT, category TEXT, account_id TEXT,
  rule TEXT, amount_mode TEXT, amount REAL, hidden INTEGER DEFAULT 0);
-- Latest credit card statement from Plaid Liabilities.
CREATE TABLE IF NOT EXISTS card_statements (
  account_id TEXT PRIMARY KEY, last_statement_balance REAL, last_statement_date TEXT, next_due_date TEXT,
  minimum_payment REAL, last_payment_amount REAL, last_payment_date TEXT);
CREATE TABLE IF NOT EXISTS income_names (key TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL, category TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS balance_snapshots (
  date TEXT, account_id TEXT, balance REAL, PRIMARY KEY (date, account_id));
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY, item_id TEXT, account_id TEXT, name TEXT, amount REAL,
  direction TEXT, frequency TEXT, next_date TEXT, category TEXT);
CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, target REAL NOT NULL,
  saved REAL DEFAULT 0, account_id TEXT);
CREATE TABLE IF NOT EXISTS holdings (
  account_id TEXT, security_id TEXT, name TEXT, ticker TEXT, type TEXT,
  quantity REAL, price REAL, value REAL, PRIMARY KEY (account_id, security_id));
CREATE TABLE IF NOT EXISTS manual_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value REAL NOT NULL, kind TEXT DEFAULT 'other');
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
`);
if (!db.prepare('PRAGMA table_info(accounts)').all().some((c) => c.name === 'in_networth'))
  db.exec('ALTER TABLE accounts ADD COLUMN in_networth INTEGER DEFAULT 1');
// Transactions keep Plaid's raw categories; `category` is the friendly label computed by categories.js.
// user_category is a one-off manual choice; transfer_pair links the other side of a matched transfer.
const txCols = db.prepare('PRAGMA table_info(transactions)').all().map((c) => c.name);
if (!txCols.includes('pfc_primary')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN pfc_primary TEXT;
    ALTER TABLE transactions ADD COLUMN pfc_detailed TEXT;
    ALTER TABLE transactions ADD COLUMN user_category TEXT;
    ALTER TABLE transactions ADD COLUMN transfer_pair TEXT;
    UPDATE transactions SET pfc_primary = category;
    UPDATE items SET cursor = NULL;`); // re-download everything once so detailed categories get filled in
}
// Holdings: Plaid's security subtype (tells a single stock from a 401(k) plan fund) and cost basis for gains.
if (!db.prepare('PRAGMA table_info(holdings)').all().some((c) => c.name === 'cost_basis'))
  db.exec('ALTER TABLE holdings ADD COLUMN cost_basis REAL; ALTER TABLE holdings ADD COLUMN subtype TEXT;');
// transfer_account: for a transfer whose other side isn't in the data, the account named in its description.
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'transfer_account'))
  db.exec('ALTER TABLE transactions ADD COLUMN transfer_account TEXT');
// Budgets are per subcategory now (they were per group); drop any old group-level rows once.
db.prepare(`DELETE FROM budgets WHERE category IN ('Housing','Utilities','Food','Transportation','Insurance','Healthcare',
  'Personal & fun','Travel','Misc','Savings & investments','Debt repayment')`).run();
// logo_url: merchant logo from Plaid. Added later, so existing transactions are downloaded again once to fill it.
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'logo_url'))
  db.exec('ALTER TABLE transactions ADD COLUMN logo_url TEXT; UPDATE items SET cursor = NULL;');
// grp: the budget group of `category` (see categories.js GROUPS), filled in by classify().
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'grp'))
  db.exec('ALTER TABLE transactions ADD COLUMN grp TEXT');
// type/subtype are what the app uses; plaid_type/plaid_subtype are what the bank reports.
// When type_overridden is set, syncs update only the plaid_ columns so the user's choice sticks.
if (!db.prepare('PRAGMA table_info(accounts)').all().some((c) => c.name === 'type_overridden'))
  db.exec(`ALTER TABLE accounts ADD COLUMN plaid_type TEXT;
    ALTER TABLE accounts ADD COLUMN plaid_subtype TEXT;
    ALTER TABLE accounts ADD COLUMN type_overridden INTEGER DEFAULT 0;
    UPDATE accounts SET plaid_type = type, plaid_subtype = subtype;`);
// Optional display name for an account, shown instead of the bank's name.
if (!db.prepare('PRAGMA table_info(accounts)').all().some((c) => c.name === 'nickname'))
  db.exec('ALTER TABLE accounts ADD COLUMN nickname TEXT');
// Set when the institution can't share investment holdings through Plaid, so we stop offering "Add holdings".
if (!db.prepare('PRAGMA table_info(items)').all().some((c) => c.name === 'no_investments'))
  db.exec('ALTER TABLE items ADD COLUMN no_investments INTEGER DEFAULT 0');
// Liabilities (card statements): consent, and whether the bank can't provide it.
if (!db.prepare('PRAGMA table_info(items)').all().some((c) => c.name === 'liabilities_consented'))
  db.exec('ALTER TABLE items ADD COLUMN liabilities_consented INTEGER DEFAULT 0; ALTER TABLE items ADD COLUMN no_liabilities INTEGER DEFAULT 0;');
// Whether the user has consented to Investments on this Item (from Plaid /item/get, refreshed on every sync).
if (!db.prepare('PRAGMA table_info(items)').all().some((c) => c.name === 'investments_consented'))
  db.exec('ALTER TABLE items ADD COLUMN investments_consented INTEGER DEFAULT 0');
// Plaid's category confidence, the purchase location and channel, and the counterparty type. Added later, so
// everything is downloaded again once to fill them in.
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'pfc_confidence'))
  db.exec(`ALTER TABLE transactions ADD COLUMN pfc_confidence TEXT; ALTER TABLE transactions ADD COLUMN city TEXT;
    ALTER TABLE transactions ADD COLUMN region TEXT; ALTER TABLE transactions ADD COLUMN country TEXT;
    ALTER TABLE transactions ADD COLUMN channel TEXT; ALTER TABLE transactions ADD COLUMN counterparty TEXT;
    UPDATE items SET cursor = NULL;`);
// Coordinates of the purchase (for trips: how far from home). Downloaded again once to fill them in.
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'lat'))
  db.exec('ALTER TABLE transactions ADD COLUMN lat REAL; ALTER TABLE transactions ADD COLUMN lon REAL; UPDATE items SET cursor = NULL;');
// reimburses: money a friend sent you back for one of your charges (that charge's id); it then counts in the
// charge's category. cat_source: why classify() chose the category (shown in the transaction details).
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'reimburses'))
  db.exec('ALTER TABLE transactions ADD COLUMN reimburses TEXT; ALTER TABLE transactions ADD COLUMN cat_source TEXT;');
// Trips (trips.js): named date ranges, suggested from purchases away from home or added by you. trip_id is the
// trip a transaction counts toward (recomputed); trip_override is your choice for one transaction (a trip id or 'none').
// home_bases: where home was from a date on, when you set it (otherwise inferred).
db.exec(`CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed', source TEXT NOT NULL DEFAULT 'manual', place TEXT);
  CREATE TABLE IF NOT EXISTS home_bases (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT NOT NULL, region TEXT, since TEXT NOT NULL, lat REAL, lon REAL);`);
if (!db.prepare('PRAGMA table_info(home_bases)').all().some((c) => c.name === 'until'))
  db.exec('ALTER TABLE home_bases ADD COLUMN until TEXT');
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'trip_id'))
  db.exec('ALTER TABLE transactions ADD COLUMN trip_id INTEGER; ALTER TABLE transactions ADD COLUMN trip_override TEXT;');
// A group budgeted as one amount (Food: $580) instead of per category. A row means the group is in that mode;
// amount may be empty until set.
db.exec('CREATE TABLE IF NOT EXISTS budget_groups (grp TEXT PRIMARY KEY, amount REAL)');
// A goal's optional target date (YYYY-MM-DD): the page shows the monthly amount needed to reach it.
if (!db.prepare('PRAGMA table_info(goals)').all().some((c) => c.name === 'target_date'))
  db.exec('ALTER TABLE goals ADD COLUMN target_date TEXT');
// Split transactions: each part is its own row (split_of = the original's id) with your category, and the original
// is marked is_split (category "Split", not spending), so every total counts the parts instead. Raw per-account sums
// (balances, bill detection) skip the parts.
if (!db.prepare('PRAGMA table_info(transactions)').all().some((c) => c.name === 'split_of'))
  db.exec('ALTER TABLE transactions ADD COLUMN split_of TEXT; ALTER TABLE transactions ADD COLUMN is_split INTEGER DEFAULT 0;');
// A different amount for one month (item: a category, or "group:<name>" for a group budgeted as one amount), and
// categories whose unspent money carries over month to month, starting with `since` (YYYY-MM).
db.exec(`CREATE TABLE IF NOT EXISTS budget_overrides (month TEXT NOT NULL, item TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (month, item));
  CREATE TABLE IF NOT EXISTS budget_rollover (category TEXT PRIMARY KEY, since TEXT NOT NULL);`);
export default db;
