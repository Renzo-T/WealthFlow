import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx } from './helpers.js';

const { budgetMonth } = await import('../server/budget.js');
const { classify } = await import('../server/categories.js');
const TODAY = '2026-10-01';
const cat = (b, name) => [b.income, ...b.expenses].flatMap((g) => g.categories).find((c) => c.category === name);

beforeEach(() => { reset(); db.prepare('DELETE FROM budgets').run(); bank('b1'); account('chk'); account('card', { type: 'credit', subtype: 'credit card' }); });

test('actuals are per category and month; refunds reduce spending; income is positive', () => {
  tx('card', '2026-09-03', 120, 'H-E-B', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('card', '2026-09-10', -20, 'H-E-B REFUND', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' });
  tx('card', '2026-08-30', 999, 'H-E-B', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' }); // other month
  tx('chk', '2026-09-17', -3510.35, 'PAYROLL', { primary: 'INCOME', detailed: 'INCOME_SALARY' });
  classify();
  const b = budgetMonth('2026-09', TODAY);
  assert.equal(cat(b, 'Groceries').actual, 100);
  assert.equal(cat(b, 'Salary').actual, 3510.35);
  assert.equal(b.totals.incomeActual, 3510.35);
});

test('a category with a recurring bill is Fixed, suggested at the bill\'s monthly amount', () => {
  for (const d of ['2026-07-29', '2026-08-31', '2026-09-29'])
    tx('chk', d, 1555.4, 'RENT', { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT', merchant: 'Landlord' });
  // a 2-weekly autoship: $63.64 × 26 / 12 ≈ $138 a month
  const pets = { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_PET_SUPPLIES', merchant: 'Chewy' };
  for (const d of ['2026-08-04', '2026-08-18', '2026-09-01', '2026-09-15', '2026-09-29']) tx('card', d, 63.64, 'CHEWY', pets);
  classify();
  const b = budgetMonth('2026-10', TODAY);
  assert.equal(cat(b, 'Rent').kind, 'fixed');
  assert.equal(cat(b, 'Rent').suggested, 1555);
  assert.equal(cat(b, 'Pets').kind, 'fixed');
  assert.equal(cat(b, 'Pets').suggested, 138);
  assert.equal(cat(b, 'Groceries').kind, 'flexible');
});

test('flexible suggestions average recent months with data, rounded to $5', () => {
  tx('card', '2026-08-05', 100, 'CAFE', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  tx('card', '2026-09-05', 212, 'CAFE', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  classify();
  const b = budgetMonth('2026-10', TODAY);
  assert.deepEqual(b.suggestedFrom, ['2026-09', '2026-08']);
  assert.equal(cat(b, 'Restaurants').suggested, 155); // (100 + 212) / 2 = 156 → 155
});

test('left to budget = budgeted income − budgeted spending and saving; groups roll up', () => {
  db.prepare("INSERT INTO budgets (category, amount) VALUES ('Salary', 7000), ('Rent', 1555), ('Groceries', 400), ('Restaurants', 300)").run();
  const b = budgetMonth('2026-10', TODAY);
  assert.equal(b.totals.income, 7000);
  assert.equal(b.expenses.find((g) => g.group === 'Food').budget, 700);
  assert.equal(b.leftToBudget, 7000 - 1555 - 400 - 300);
});

test('a group budgeted as one amount: its categories only show spending; the group carries the budget', () => {
  tx('card', '2026-10-01', 40, 'SUSHI', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' });
  tx('card', '2026-10-01', 10, 'COFFEE SHOP', { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' });
  classify();
  db.prepare("INSERT INTO budgets (category, amount) VALUES ('Groceries', 300)").run(); // ignored while Food is one amount
  db.prepare("INSERT INTO budget_groups (grp, amount) VALUES ('Food', 600)").run();
  const b = budgetMonth('2026-10', TODAY);
  const food = b.expenses.find((g) => g.group === 'Food');
  assert.equal(food.whole, true);
  assert.equal(food.budget, 600);
  assert.equal(food.actual, 50);
  assert.equal(cat(b, 'Groceries').budget, null);
  assert.equal(b.totals.expenses, 600);
  assert.equal(b.totals.flexible.budget, 600); // one flexible item
});
