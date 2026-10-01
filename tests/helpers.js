// Shared setup for tests: an in-memory database (never your real data) and small seeding helpers.
// Import this before any server module, so db.js opens ':memory:'.
process.env.WEALTHFLOW_DB = ':memory:';
process.env.ENCRYPTION_KEY ??= '0'.repeat(64);

export const { default: db } = await import('../server/db.js');

export function reset() {
  for (const t of ['items', 'accounts', 'transactions', 'category_rules', 'bill_settings', 'card_statements', 'recurring', 'holdings', 'budgets', 'budget_groups', 'trips', 'home_bases'])
    db.prepare(`DELETE FROM ${t}`).run();
}

export function bank(id, institution = id) {
  db.prepare("INSERT INTO items (id, institution, access_token) VALUES (?, ?, 'x')").run(id, institution);
}

// account('chk', { item: 'b1', type: 'depository', subtype: 'checking', mask: '1234', name: 'Checking' })
export function account(id, { item = 'b1', type = 'depository', subtype = 'checking', mask = null, name = id, balance = 0 } = {}) {
  db.prepare('INSERT INTO accounts (id, item_id, name, mask, type, subtype, balance) VALUES (?,?,?,?,?,?,?)')
    .run(id, item, name, mask, type, subtype, balance);
}

// Plaid convention: positive amount = money out, negative = money in.
let n = 0;
export function tx(account_id, date, amount, name, { primary = 'GENERAL_MERCHANDISE', detailed = null, merchant = null, pending = 0, id = `t${++n}` } = {}) {
  db.prepare(`INSERT INTO transactions (id, account_id, date, name, merchant, amount, pfc_primary, pfc_detailed, pending)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, account_id, date, name, merchant, amount, primary, detailed, pending);
  return id;
}

export const row = (id) => db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
