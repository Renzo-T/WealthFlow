import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { carryPending, removeTx, describeStatus, anyFailing, purchaseApr } = await import('../server/sync.js');

beforeEach(() => { reset(); bank('b1'); account('card', { type: 'credit', subtype: 'credit card' }); bank('v', 'Venmo - Personal'); account('ven', { item: 'v' }); });

test('when a pending charge posts, your category, trip choice, split and paid-back links move to it', () => {
  const pending = tx('card', '2026-10-02', 150, 'WAREHOUSE CLUB', { pending: 1, id: 'pend1' });
  const back = tx('ven', '2026-10-03', -50, 'Alex Rivera "half"', { primary: 'OTHER' });
  db.prepare("UPDATE transactions SET user_category = 'Groceries', trip_override = 'none', is_split = 1 WHERE id = 'pend1'").run();
  db.prepare(`INSERT INTO transactions (id, account_id, date, name, amount, user_category, split_of) VALUES
    ('pend1:1', 'card', '2026-10-02', 'WAREHOUSE CLUB', 100, 'Groceries', 'pend1'), ('pend1:2', 'card', '2026-10-02', 'WAREHOUSE CLUB', 50, 'Shopping', 'pend1')`).run();
  db.prepare("UPDATE transactions SET reimburses = 'pend1' WHERE id = ?").run(back);
  const posted = tx('card', '2026-10-04', 150, 'WAREHOUSE CLUB', { id: 'post1' });
  assert.equal(carryPending(pending, posted), true);
  removeTx('pend1'); // what sync does next (this statement once threw, which stopped the bank's sync)
  assert.equal(db.prepare("SELECT COUNT(*) n FROM transactions WHERE id = 'pend1' OR split_of = 'pend1'").get().n, 0);
  const p = row('post1');
  assert.deepEqual([p.user_category, p.trip_override, p.is_split], ['Groceries', 'none', 1]);
  assert.deepEqual(db.prepare("SELECT id, category FROM transactions WHERE split_of = 'post1' ORDER BY id").all().map((r) => r.id), ['post1:1', 'post1:2']);
  assert.equal(row(back).reimburses, 'post1');
});

test('your choice on the posted transaction is kept over the pending one', () => {
  tx('card', '2026-10-02', 20, 'CAFE', { pending: 1, id: 'p2' });
  tx('card', '2026-10-03', 20, 'CAFE', { id: 'q2' });
  db.prepare("UPDATE transactions SET user_category = 'Coffee' WHERE id = 'p2'").run();
  db.prepare("UPDATE transactions SET user_category = 'Restaurants' WHERE id = 'q2'").run();
  carryPending('p2', 'q2');
  assert.equal(row('q2').user_category, 'Restaurants');
  assert.equal(carryPending('missing', 'q2'), false);
});

test('only real sign-in problems ask you to reconnect; other failures say why and are retried', () => {
  assert.deepEqual(describeStatus('ok'), { state: 'ok', reason: null });
  assert.deepEqual(describeStatus(null), { state: 'ok', reason: null });
  for (const code of ['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION', 'INVALID_MFA']) assert.equal(describeStatus(code).state, 'sign-in');
  assert.deepEqual(describeStatus('INSTITUTION_NOT_RESPONDING'), { state: 'error', reason: "the bank isn't responding right now" });
  assert.match(describeStatus('getaddrinfo ENOTFOUND production.plaid.com').reason, /internet/);
  assert.match(describeStatus('SOME_NEW_CODE').reason, /Plaid said SOME_NEW_CODE/);
  // A bug in Mizo Money (like the one that once showed as "sign in again") must not send you to reconnect.
  const bug = describeStatus('Too many parameter values were provided');
  assert.equal(bug.state, 'error');
  assert.match(bug.reason, /went wrong in Mizo Money/);
});

test('a bank whose last sync failed is noticed, so startup syncs again', () => {
  assert.equal(anyFailing(), false);
  db.prepare("UPDATE items SET status = 'INSTITUTION_DOWN' WHERE id = 'b1'").run();
  assert.equal(anyFailing(), true);
});

// ---------- card APR from Plaid Liabilities ----------
// Plaid's credit liability: aprs is [{ apr_percentage (a percent), apr_type, balance_subject_to_apr, interest_charge_amount }],
// empty when the bank has no APR data. We keep the purchase APR; anything else is NULL, never 0.
test('purchaseApr picks the purchase rate and returns null when there is none to show', () => {
  const apr = (apr_type, apr_percentage) => ({ apr_type, apr_percentage, balance_subject_to_apr: null, interest_charge_amount: null });
  assert.equal(purchaseApr([apr('balance_transfer_apr', 15.24), apr('cash_apr', 27.95), apr('purchase_apr', 12.5), apr('special', 0)]), 12.5);
  assert.equal(purchaseApr([apr('cash_apr', 27.95)]), null);
  assert.equal(purchaseApr([apr('purchase_apr', 0)]), null);
  assert.equal(purchaseApr([]), null);
  assert.equal(purchaseApr(undefined), null);
  assert.equal(purchaseApr(null), null);
});

test('a sync stores each card\'s purchase APR from a stubbed Liabilities response, and stores nothing when the bank sends none', async (t) => {
  const { PlaidApi } = await import('plaid');
  const { encrypt } = await import('../server/crypto.js');
  const { syncItem } = await import('../server/sync.js');
  account('card2', { type: 'credit', subtype: 'credit card' }); account('card3', { type: 'credit', subtype: 'credit card' });
  db.prepare("UPDATE items SET access_token = ? WHERE id = 'b1'").run(encrypt('access-test'));
  let credit = [
    { account_id: 'card', last_statement_balance: 400, last_statement_issue_date: '2026-10-01', next_payment_due_date: '2026-10-26', minimum_payment_amount: 35,
      aprs: [{ apr_percentage: 15.24, apr_type: 'balance_transfer_apr' }, { apr_percentage: 24.99, apr_type: 'purchase_apr', balance_subject_to_apr: 400, interest_charge_amount: 7 }] },
    { account_id: 'card2', last_statement_balance: 90, aprs: [] },
    { account_id: 'card3', last_statement_balance: 10 }, // no aprs field at all
  ];
  const acct = (account_id, current) => ({ account_id, name: account_id, mask: null, type: 'credit', subtype: 'credit card', balances: { current, iso_currency_code: 'USD' } });
  t.mock.method(PlaidApi.prototype, 'transactionsSync', async () => ({ data: { added: [], modified: [], removed: [], next_cursor: 'c', has_more: false } }));
  t.mock.method(PlaidApi.prototype, 'accountsGet', async () => ({ data: { accounts: [acct('card', 400), acct('card2', 90), acct('card3', 10)] } }));
  t.mock.method(PlaidApi.prototype, 'itemGet', async () => ({ data: { item: { consented_products: ['transactions', 'liabilities'] } } }));
  t.mock.method(PlaidApi.prototype, 'liabilitiesGet', async () => ({ data: { liabilities: { credit } } }));
  t.mock.method(PlaidApi.prototype, 'transactionsRecurringGet', async () => { throw new Error('not enough history'); });

  assert.equal((await syncItem(db.prepare("SELECT * FROM items WHERE id = 'b1'").get())).status, 'ok');
  const apr = () => Object.fromEntries(db.prepare('SELECT account_id, purchase_apr FROM card_statements').all().map((r) => [r.account_id, r.purchase_apr]));
  assert.deepEqual(apr(), { card: 24.99, card2: null, card3: null });

  // The bank stops sending it: the old figure goes rather than lingering.
  credit = [{ account_id: 'card', last_statement_balance: 400, aprs: [] }];
  await syncItem(db.prepare("SELECT * FROM items WHERE id = 'b1'").get());
  assert.equal(apr().card, null);
});
