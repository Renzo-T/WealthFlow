import db from './db.js';

// What a card that isn't paid off is costing. One estimate per card, nothing more.
//
// A card "carries a balance" when it owes money, its statement due date has passed, and the payments since the
// statement didn't cover it (the same test recurring.js uses for a paid statement). Only then, and only when the
// bank sent a purchase APR, is there a figure: balance × APR ÷ 12. It is an estimate: banks charge interest on
// the daily balance, and a promotional or tiered rate would change it.
// Returns { [account_id]: { apr, interest_month } }; cards with nothing to show are left out.
export function cardInterest(today = new Date().toLocaleDateString('en-CA')) {
  const out = {};
  for (const c of db.prepare(`SELECT s.*, a.balance current FROM card_statements s JOIN accounts a ON a.id = s.account_id
      WHERE a.type = 'credit' AND s.purchase_apr > 0`).all()) {
    if (!(c.current > 0.005) || !c.next_due_date || c.next_due_date >= today) continue;
    const covers = (c.last_payment_amount ?? 0) >= (c.last_statement_balance ?? 0) - 0.01;
    const paid = !(c.last_statement_balance > 0) || (covers && (c.last_statement_date
      ? c.last_payment_date >= c.last_statement_date : c.minimum_payment === 0));
    if (paid) continue;
    out[c.account_id] = { apr: c.purchase_apr, interest_month: Math.round((c.current * c.purchase_apr / 12)) / 100 };
  }
  return out;
}
