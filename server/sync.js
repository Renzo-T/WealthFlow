import plaid from './plaid.js';
import db from './db.js';
import { decrypt } from './crypto.js';
import { classify, friendly } from './categories.js';
import { refreshTrips } from './trips.js';
import { autoBackup } from './backup.js';

// Upsert, not replace: keeps the user's manual category. classify() fills in category and transfer_pair.
const upsertTx = db.prepare(`INSERT INTO transactions
  (id, account_id, date, name, merchant, amount, pfc_primary, pfc_detailed, pending, logo_url,
   pfc_confidence, city, region, country, channel, counterparty, lat, lon) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, date = excluded.date, name = excluded.name,
  merchant = excluded.merchant, amount = excluded.amount, pfc_primary = excluded.pfc_primary, logo_url = excluded.logo_url,
  pfc_detailed = excluded.pfc_detailed, pending = excluded.pending, pfc_confidence = excluded.pfc_confidence,
  city = excluded.city, region = excluded.region, country = excluded.country, channel = excluded.channel,
  counterparty = excluded.counterparty, lat = excluded.lat, lon = excluded.lon`);
// Move what you set on a pending transaction to its posted version: your category, trip choice, "paid back" link
// and split parts; and point anything that paid back the pending charge at the posted one. Exported for tests.
export function carryPending(oldId, newId) {
  const o = db.prepare('SELECT user_category, trip_override, reimburses, is_split FROM transactions WHERE id = ?').get(oldId);
  if (!o || oldId === newId) return false;
  db.prepare(`UPDATE transactions SET user_category = COALESCE(user_category, ?), trip_override = COALESCE(trip_override, ?),
    reimburses = COALESCE(reimburses, ?), is_split = MAX(COALESCE(is_split, 0), ?) WHERE id = ?`).run(o.user_category, o.trip_override, o.reimburses, o.is_split ?? 0, newId);
  db.prepare('UPDATE transactions SET reimburses = ? WHERE reimburses = ?').run(newId, oldId);
  for (const p of db.prepare('SELECT id FROM transactions WHERE split_of = ?').all(oldId))
    db.prepare('UPDATE transactions SET id = ?, split_of = ? WHERE id = ?').run(`${newId}${p.id.slice(oldId.length)}`, newId, p.id);
  return true;
}
// A transaction Plaid removed (e.g. a pending charge that posted) takes its split parts with it.
const deleteTx = db.prepare('DELETE FROM transactions WHERE id = @id OR split_of = @id');
export const removeTx = (id) => deleteTx.run({ id });
// A type the user chose (type_overridden) survives syncs; the bank's own type is kept in plaid_type/plaid_subtype.
const upsertAcct = db.prepare(`INSERT INTO accounts
  (id, item_id, name, mask, type, subtype, plaid_type, plaid_subtype, balance, currency) VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET item_id = excluded.item_id, name = excluded.name, mask = excluded.mask,
  plaid_type = excluded.plaid_type, plaid_subtype = excluded.plaid_subtype,
  type = CASE WHEN accounts.type_overridden THEN accounts.type ELSE excluded.type END,
  subtype = CASE WHEN accounts.type_overridden THEN accounts.subtype ELSE excluded.subtype END,
  balance = excluded.balance, currency = excluded.currency`);
// Some brokerages (seen with Merrill) report one pending dividend or fund movement many times under different
// IDs. Keep one of each exact duplicate. Limited to pending investment flows so real repeat purchases
// (two identical coffees) are never touched; the posted version replaces these anyway.
const dedupePending = db.prepare(`DELETE FROM transactions WHERE pending = 1
  AND pfc_detailed LIKE '%INVESTMENT_AND_RETIREMENT_FUNDS' AND rowid NOT IN (
    SELECT MIN(rowid) FROM transactions WHERE pending = 1 AND pfc_detailed LIKE '%INVESTMENT_AND_RETIREMENT_FUNDS'
    GROUP BY account_id, date, name, amount)`);
// Fund names come as "<fund company trust> - <fund>", e.g. "Vanguard Index Funds - Vanguard S&P 500 ETF".
// Keep the fund part; leave other names (like "Berkshire Hathaway Inc. - Ordinary Shares") alone.
const fundName = (n) => {
  const i = n?.indexOf(' - ') ?? -1;
  return i > 0 && /\b(trust|funds?|series|portfolios?)\b/i.test(n.slice(0, i)) ? n.slice(i + 3) : n;
};
const snapshot = db.prepare('INSERT OR REPLACE INTO balance_snapshots (date, account_id, balance) VALUES (?,?,?)');

export async function syncItem(item) {
  const access_token = decrypt(item.access_token);
  let added = 0, removed = 0;
  try {
    let cursor = item.cursor || undefined;
    let more = true;
    while (more) {
      const { data } = await plaid.transactionsSync({ access_token, cursor, count: 500 });
      added += data.added.length; removed += data.removed.length;
      db.transaction(() => {
        // Plaid amounts: positive = money out, negative = money in.
        for (const t of [...data.added, ...data.modified]) {
          upsertTx.run(t.transaction_id, t.account_id, t.date, t.name,
            t.merchant_name ?? null, t.amount, t.personal_finance_category?.primary ?? null,
            t.personal_finance_category?.detailed ?? null, Number(t.pending),
            t.logo_url ?? t.counterparties?.find((c) => c.logo_url)?.logo_url ?? null,
            // How sure Plaid is of its category (VERY_HIGH … LOW), where it happened, and who the other side is
            // (merchant, payment_app, …): used for categorizing payments with people and for trips.
            t.personal_finance_category?.confidence_level ?? null, t.location?.city ?? null, t.location?.region ?? null,
            t.location?.country ?? null, t.payment_channel ?? null, t.counterparties?.[0]?.type ?? null,
            t.location?.lat ?? null, t.location?.lon ?? null);
        }
        // A pending charge that posts arrives as a new transaction pointing at the pending one, which is removed.
        // Carry your choices over first, or they'd be deleted with it.
        for (const t of data.added) if (t.pending_transaction_id) carryPending(t.pending_transaction_id, t.transaction_id);
        for (const r of data.removed) removeTx(r.transaction_id);
      })();
      cursor = data.next_cursor;
      more = data.has_more;
    }
    dedupePending.run();
    const { data: a } = await plaid.accountsGet({ access_token });
    const today = new Date().toLocaleDateString('en-CA');
    db.transaction(() => {
      for (const x of a.accounts) {
        upsertAcct.run(x.account_id, item.id, x.name, x.mask ?? null, x.type, x.subtype ?? null,
          x.type, x.subtype ?? null, x.balances.current ?? 0, x.balances.iso_currency_code ?? 'USD');
        snapshot.run(today, x.account_id, x.balances.current ?? 0);
      }
      db.prepare("UPDATE items SET cursor = ?, status = 'ok' WHERE id = ?").run(cursor ?? null, item.id);
    })();
    // Investments and Liabilities are requested when a bank is first connected, so consent is normally there.
    let liabilities = false;
    try {
      const { data: it } = await plaid.itemGet({ access_token });
      const has = (p) => Number(it.item.consented_products?.includes(p) ?? false);
      // Only ever confirm: right after approval Plaid can still report the old list for a while.
      db.prepare('UPDATE items SET investments_consented = MAX(investments_consented, ?), liabilities_consented = MAX(liabilities_consented, ?) WHERE id = ?')
        .run(has('investments'), has('liabilities'), item.id);
      liabilities = !!db.prepare('SELECT liabilities_consented c FROM items WHERE id = ?').get(item.id).c;
    } catch { /* not critical; keep the last known value */ }
    if (liabilities && a.accounts.some((x) => x.type === 'credit')) {
      try {
        const { data: l } = await plaid.liabilitiesGet({ access_token });
        const ins = db.prepare(`INSERT OR REPLACE INTO card_statements (account_id, last_statement_balance, last_statement_date,
          next_due_date, minimum_payment, last_payment_amount, last_payment_date) VALUES (?,?,?,?,?,?,?)`);
        db.transaction(() => {
          for (const c of l.liabilities?.credit ?? []) ins.run(c.account_id, c.last_statement_balance ?? null, c.last_statement_issue_date ?? null,
            c.next_payment_due_date ?? null, c.minimum_payment_amount ?? null, c.last_payment_amount ?? null, c.last_payment_date ?? null);
        })();
      } catch (e) {
        // PRODUCT_NOT_READY right after approval is normal; the next sync (or the automatic one) tries again.
        const code = e.response?.data?.error_code;
        if (code === 'PRODUCTS_NOT_SUPPORTED') db.prepare('UPDATE items SET no_liabilities = 1 WHERE id = ?').run(item.id);
        else console.warn(`Card statements for ${item.institution}: ${code ?? e.message}`);
      }
    }
    if (a.accounts.some((x) => x.type === 'investment')) {
      try {
        const { data: h } = await plaid.investmentsHoldingsGet({ access_token });
        const sec = Object.fromEntries(h.securities.map((s) => [s.security_id, s]));
        const ins = db.prepare(`INSERT OR REPLACE INTO holdings
          (account_id, security_id, name, ticker, type, subtype, quantity, price, value, cost_basis) VALUES (?,?,?,?,?,?,?,?,?,?)`);
        db.transaction(() => {
          for (const x of a.accounts) db.prepare('DELETE FROM holdings WHERE account_id = ?').run(x.account_id);
          for (const x of h.holdings) {
            const s = sec[x.security_id] ?? {};
            ins.run(x.account_id, x.security_id, fundName(s.name) ?? s.ticker_symbol ?? 'Unknown', s.ticker_symbol ?? null,
              s.is_cash_equivalent ? 'cash' : (s.type ?? 'other'), s.subtype ?? null, x.quantity ?? 0, x.institution_price ?? 0,
              x.institution_value ?? 0, x.cost_basis ?? null);
          }
        })();
      } catch (e) {
        // Otherwise: consent for Investments not granted yet, or data not ready.
        if (e.response?.data?.error_code === 'PRODUCTS_NOT_SUPPORTED')
          db.prepare('UPDATE items SET no_investments = 1 WHERE id = ?').run(item.id);
      }
    }
    try {
      const { data: r } = await plaid.transactionsRecurringGet({ access_token });
      const ins = db.prepare(`INSERT OR REPLACE INTO recurring
        (id, item_id, account_id, name, amount, direction, frequency, next_date, category) VALUES (?,?,?,?,?,?,?,?,?)`);
      db.transaction(() => {
        db.prepare('DELETE FROM recurring WHERE item_id = ?').run(item.id);
        for (const [dir, list] of [['out', r.outflow_streams], ['in', r.inflow_streams]])
          for (const s of list)
            if (s.is_active && s.status !== 'TOMBSTONED' && s.predicted_next_date)
              ins.run(s.stream_id, item.id, s.account_id, s.merchant_name || s.description,
                Math.abs(s.average_amount?.amount ?? 0), dir, s.frequency, s.predicted_next_date,
                friendly(s.personal_finance_category?.primary, s.personal_finance_category?.detailed));
      })();
    } catch { /* needs enough history; try again on the next refresh */ }
    classify(); // transfers can pair across banks, so this runs over everything
    refreshTrips(); // suggest new trips and recount what's on each
    return { id: item.id, institution: item.institution, status: 'ok', added, removed };
  } catch (e) {
    // e.g. ITEM_LOGIN_REQUIRED: the bank needs re-authentication (Link update mode).
    const code = e.response?.data?.error_code || e.message;
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run(code, item.id);
    return { id: item.id, institution: item.institution, status: code, added, removed };
  }
}

// One sync of every connection at a time: the Refresh button, the startup sync and the timer all share it.
// Only reads what Plaid already has; Plaid checks banks on its own schedule (transactions a few times a day,
// holdings about daily).
export const AUTO_SYNC_HOURS = 6;
let running = null;
export function syncAll() {
  running ??= (async () => {
    const results = await Promise.all(db.prepare('SELECT * FROM items').all().map(syncItem));
    db.prepare("INSERT INTO meta (key, value) VALUES ('last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(new Date().toISOString());
    // First sync of the day also saves the day's backup; a failed backup never fails the sync.
    try { const f = await autoBackup(); if (f) console.log(`Backup saved: ${f}`); } catch (e) { console.error('Backup failed:', e.message); }
    return results;
  })().finally(() => { running = null; });
  return running;
}
export const lastSync = () => db.prepare("SELECT value FROM meta WHERE key = 'last_sync'").get()?.value ?? null;
