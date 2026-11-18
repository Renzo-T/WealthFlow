import db from './db.js';

// Assets and debts Plaid can't see (a house, a loan you made, a 529 at a provider that isn't linked), each with a
// value history so net worth history uses the value each day had, not today's value for every day.
// manual_asset_values: (asset_id, date, value, tx_id). date '' means "from the start" (owned before any history);
// otherwise the value from that day on. tx_id is the transfer that moved the money (into the asset, or paid toward the
// debt), so What moved counts it as a move between your own things rather than money leaving.

export const KINDS = ['real_estate', 'vehicle', 'investment', 'receivable', 'other', 'liability'];
const debt = (kind) => kind === 'liability';
const today = () => new Date().toLocaleDateString('en-CA');

export const entriesOf = (id) => db.prepare("SELECT * FROM manual_asset_values WHERE asset_id = ? ORDER BY date, id").all(id);

// The value on a date: the latest entry on or before it; before the first dated entry, nothing (it wasn't yours yet).
export function valueOn(entries, date) {
  let v = 0;
  for (const e of entries) if (e.date <= date) v = e.value; else break;
  return v;
}

// Every asset with its entries, oldest first.
export function manualAssets() {
  const byId = {};
  // tx_name: the transfer an entry came from, to name it on the page.
  for (const e of db.prepare(`SELECT v.*, COALESCE(t.merchant, t.name) tx_name FROM manual_asset_values v
    LEFT JOIN transactions t ON t.id = v.tx_id ORDER BY v.date, v.id`).all()) (byId[e.asset_id] ??= []).push(e);
  return db.prepare('SELECT * FROM manual_assets ORDER BY id').all().map((a) => ({ ...a, entries: byId[a.id] ?? [] }));
}

// Their net worth on a date (debts subtracted).
export const manualOn = (date, assets = manualAssets()) =>
  assets.reduce((s, a) => s + (debt(a.kind) ? -1 : 1) * valueOn(a.entries, date), 0);

// manual_assets.value stays today's value, for the places that only need that (allocation, the summary bars).
export function syncCurrent(id) {
  db.prepare('UPDATE manual_assets SET value = ? WHERE id = ?').run(valueOn(entriesOf(id), today()), id);
}

// Set the value from a date on ('' = from the start). One entry per date: a second one on the same day replaces it.
export function setValue(id, date, value, txId = null) {
  const old = db.prepare('SELECT id FROM manual_asset_values WHERE asset_id = ? AND date = ?').get(id, date);
  if (old) db.prepare('UPDATE manual_asset_values SET value = ?, tx_id = COALESCE(?, tx_id) WHERE id = ?').run(value, txId, old.id);
  else db.prepare('INSERT INTO manual_asset_values (asset_id, date, value, tx_id) VALUES (?,?,?,?)').run(id, date, value, txId);
  syncCurrent(id);
}

// What a transfer did to the asset's value: Plaid's positive amount left a linked account, so it went into the asset
// (or paid down the debt); a negative one came back out of it.
export const deltaFor = (kind, amount) => (debt(kind) ? -amount : amount);

// Count a transfer toward an asset from its date. "add": the asset grew by the amount from that day (later values move
// with it). "included": the value you entered already has it, so the days before it were lower by the amount.
export function linkTransfer(asset, t, mode) {
  const delta = deltaFor(asset.kind, t.amount);
  const entries = entriesOf(asset.id);
  const at = valueOn(entries, t.date);
  db.transaction(() => {
    if (mode === 'included') {
      for (const e of entries.filter((e) => e.date < t.date)) db.prepare('UPDATE manual_asset_values SET value = ? WHERE id = ?').run(Math.max(0, e.value - delta), e.id);
      setValue(asset.id, t.date, at, t.id);
    } else {
      for (const e of entries.filter((e) => e.date > t.date)) db.prepare('UPDATE manual_asset_values SET value = ? WHERE id = ?').run(Math.max(0, e.value + delta), e.id);
      setValue(asset.id, t.date, Math.max(0, at + delta), t.id);
    }
  })();
  syncCurrent(asset.id);
}

// Money that left (or came back into) a linked account without reaching another tracked one: a transfer, saving or
// debt payment to somewhere Mizo Money can't see. The same rule as What moved's "Moved to accounts not tracked".
export const UNTRACKED_SQL = `t.grp IN ('Savings & investments', 'Debt repayment', 'Transfer')
  AND COALESCE(t.is_split, 0) = 0 AND COALESCE(t.cat_source, '') <> 'sweep' AND t.transfer_pair IS NULL
  AND (t.transfer_account IS NULL OR t.transfer_account NOT IN (SELECT id FROM accounts WHERE in_networth = 1))`;

// Recent untracked transfers not yet counted toward an asset, largest first: what you might have moved into one.
export function linkCandidates(days = 120) {
  const since = new Date(Date.now() - days * 864e5).toLocaleDateString('en-CA');
  return db.prepare(`SELECT t.id, t.date, COALESCE(t.merchant, t.name) name, t.amount, COALESCE(a.nickname, a.name) account
    FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.in_networth = 1
    WHERE t.date >= ? AND t.pending = 0 AND ABS(t.amount) >= 100 AND ${UNTRACKED_SQL}
      AND t.id NOT IN (SELECT tx_id FROM manual_asset_values WHERE tx_id IS NOT NULL)
    ORDER BY ABS(t.amount) DESC, t.date DESC LIMIT 8`).all(since);
}
