import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { carryPending, removeTx } = await import('../server/sync.js');

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
