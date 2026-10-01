import db from './db.js';

// Two levels. Budgets, the dashboard and Money flow use the group; transactions show the subcategory.
// Savings & investments and Debt repayment are budgetable but aren't spending. Income and Transfer aren't budgeted.
export const GROUPS = {
  Housing: ['Rent', 'Mortgage', 'Home'],
  Utilities: ['Utilities', 'Phone & internet'],
  Food: ['Groceries', 'Restaurants', 'Coffee', 'Alcohol & bars'],
  // Car: repairs, parking and tolls. Rideshare & transit: Uber/Lyft, taxis, buses, trains.
  Transportation: ['Gas', 'Car', 'Rideshare & transit'],
  Insurance: ['Insurance'],
  Healthcare: ['Health'],
  // Shopping includes electronics and books; Entertainment includes streaming, movies, music and games.
  'Personal & fun': ['Shopping', 'Clothing', 'Entertainment', 'Fitness', 'Personal care'],
  // Its own group: large and lumpy, and usually saved for separately, so it would swamp Personal & fun.
  // Travel (the subcategory) is everything else on a trip: booking sites, rental cars, tours.
  Travel: ['Flights', 'Hotels', 'Travel'],
  Misc: ['Pets', 'Services', 'Gifts & donations', 'Education', 'Childcare', 'Taxes', 'Government', 'Fees', 'Payment apps', 'Cash back', 'Other'],
  'Savings & investments': ['Investments', 'Savings'],
  'Debt repayment': ['Loan payment'],
  Income: ['Income', 'Salary', 'Dividends', 'Interest'],
  // Sweep: cash moving between an account's cash and its own money-market fund or partner bank. Not a real
  // movement of your money, so the transactions list hides it by default.
  Transfer: ['Transfer', 'Sweep'],
};
// Categories merged into others (Oct 2026). Old names in your choices, rules, budgets and watchlist are moved over
// once (migrateCategories) and are also mapped wherever they still turn up.
export const RENAMED = {
  Electronics: 'Shopping', Books: 'Shopping', 'Streaming & media': 'Entertainment', Games: 'Entertainment',
  'Rideshare & taxis': 'Rideshare & transit', 'Public transit': 'Rideshare & transit', Transportation: 'Rideshare & transit',
  'Parking & tolls': 'Car', 'Rental cars': 'Travel', Donations: 'Gifts & donations', Gifts: 'Gifts & donations',
};
const rename = (c) => (c == null ? c : RENAMED[c] ?? c);
// Rarely needed: offered in category menus only once something is in them (they still exist and can be chosen
// from the Budget page or by a rule).
const RARE = new Set(['Mortgage', 'Education', 'Childcare', 'Taxes', 'Government', 'Loan payment']);
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, subs]) => subs.map((s) => [s, g])));
export const groupOf = (sub) => GROUP_OF[sub] ?? 'Misc';
export const CATEGORIES = Object.values(GROUPS).flat();
// Split: an original transaction whose parts carry the categories (so it isn't counted itself).
export const NOT_SPENDING = ['Income', 'Transfer', 'Savings & investments', 'Debt repayment', 'Split'];
export const SPEND_SQL = `COALESCE(grp,'Misc') NOT IN (${NOT_SPENDING.map((g) => `'${g}'`).join(',')})`;
export const BUDGET_GROUPS = Object.keys(GROUPS).filter((g) => g !== 'Income' && g !== 'Transfer');

// Plaid's personal_finance_category → subcategory. Detailed wins; the primary is the fallback.
const DETAILED = {
  FOOD_AND_DRINK_GROCERIES: 'Groceries', FOOD_AND_DRINK_RESTAURANT: 'Restaurants', FOOD_AND_DRINK_FAST_FOOD: 'Restaurants',
  FOOD_AND_DRINK_COFFEE: 'Coffee', FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Alcohol & bars',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Clothing', GENERAL_MERCHANDISE_ELECTRONICS: 'Electronics',
  GENERAL_MERCHANDISE_PET_SUPPLIES: 'Pets', GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: 'Gifts',
  GENERAL_MERCHANDISE_PHARMACIES_AND_SUPPLEMENTS: 'Health', GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'Books',
  TRANSPORTATION_GAS: 'Gas', TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Rideshare & taxis', TRANSPORTATION_PARKING: 'Parking & tolls',
  TRANSPORTATION_TOLLS: 'Parking & tolls', TRANSPORTATION_PUBLIC_TRANSIT: 'Public transit',
  TRAVEL_FLIGHTS: 'Flights', TRAVEL_LODGING: 'Hotels', TRAVEL_RENTAL_CARS: 'Rental cars',
  RENT_AND_UTILITIES_RENT: 'Rent', RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Phone & internet', RENT_AND_UTILITIES_TELEPHONE: 'Phone & internet',
  ENTERTAINMENT_TV_AND_MOVIES: 'Streaming & media', ENTERTAINMENT_MUSIC_AND_AUDIO: 'Streaming & media', ENTERTAINMENT_VIDEO_GAMES: 'Games',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'Fitness',
  GENERAL_SERVICES_INSURANCE: 'Insurance', GENERAL_SERVICES_EDUCATION: 'Education', GENERAL_SERVICES_CHILDCARE: 'Childcare',
  GENERAL_SERVICES_AUTOMOTIVE: 'Car', GOVERNMENT_AND_NON_PROFIT_DONATIONS: 'Donations', GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: 'Taxes',
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Transfer', LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Mortgage',
  TRANSFER_OUT_SAVINGS: 'Savings',
  INCOME_SALARY: 'Salary', INCOME_DIVIDENDS: 'Dividends', INCOME_INTEREST_EARNED: 'Interest',
};
const PRIMARY = {
  INCOME: 'Income', TRANSFER_IN: 'Transfer', TRANSFER_OUT: 'Transfer', LOAN_PAYMENTS: 'Loan payment', BANK_FEES: 'Fees',
  ENTERTAINMENT: 'Entertainment', FOOD_AND_DRINK: 'Restaurants', GENERAL_MERCHANDISE: 'Shopping', HOME_IMPROVEMENT: 'Home',
  MEDICAL: 'Health', PERSONAL_CARE: 'Personal care', GENERAL_SERVICES: 'Services', GOVERNMENT_AND_NON_PROFIT: 'Government',
  TRANSPORTATION: 'Transportation', TRAVEL: 'Travel', RENT_AND_UTILITIES: 'Utilities', OTHER: 'Other',
};
// Venmo, Zelle, Cash App: usually splitting costs with people, so spending (or paying you back, which reduces it).
export const friendly = (primary, detailed) =>
  rename(DETAILED[detailed] ?? (detailed?.endsWith('_FROM_APPS') ? 'Payment apps' : null) ?? PRIMARY[primary] ?? 'Other');

// Groups and subcategories for category menus: rare ones only when something already uses them.
export function pickerGroups() {
  const used = new Set(db.prepare('SELECT DISTINCT category FROM transactions UNION SELECT category FROM category_rules UNION SELECT category FROM budgets').all().map((r) => r.category));
  return Object.entries(GROUPS).map(([group, subs]) => ({ group, subs: subs.filter((c) => !RARE.has(c) || used.has(c)) })).filter((g) => g.subs.length);
}

// Move old category names to the merged ones: your one-off choices, rules, budgets (amounts added together),
// bill edits and watchlist items. Safe to run any number of times.
export function migrateCategories() {
  const olds = Object.keys(RENAMED);
  const has = (t) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
  db.transaction(() => {
    for (const [from, to] of Object.entries(RENAMED)) {
      db.prepare('UPDATE transactions SET user_category = ? WHERE user_category = ?').run(to, from);
      db.prepare('UPDATE category_rules SET category = ? WHERE category = ?').run(to, from);
      if (has('bill_settings')) db.prepare('UPDATE bill_settings SET category = ? WHERE category = ?').run(to, from);
      const b = db.prepare('SELECT amount FROM budgets WHERE category = ?').get(from);
      if (b) {
        db.prepare('INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT (category) DO UPDATE SET amount = amount + excluded.amount').run(to, b.amount);
        db.prepare('DELETE FROM budgets WHERE category = ?').run(from);
      }
      if (has('watchlist')) {
        const w = db.prepare("SELECT id FROM watchlist WHERE kind = 'category' AND value = ?").get(from);
        if (w && db.prepare("SELECT 1 FROM watchlist WHERE kind = 'category' AND value = ?").get(to)) db.prepare('DELETE FROM watchlist WHERE id = ?').run(w.id);
        else if (w) db.prepare('UPDATE watchlist SET value = ? WHERE id = ?').run(to, w.id);
      }
    }
  })();
  return olds;
}
migrateCategories();

// Review lists (payments to sort, unmatched transfers) only ask about transactions from 3 months before your
// first bank was connected onward: older history is there for context, but not worth sorting by hand.
export function reviewSince() {
  const first = db.prepare('SELECT MIN(created_at) d FROM items').get()?.d;
  if (!first) return '0000-00-00';
  const d = new Date(`${first.slice(0, 10)}T00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 3);
  return d.toISOString().slice(0, 10);
}

// Where charts and reports start. By default the same 3 months before the first connection: banks give very
// different amounts of history (some 2 years, some 90 days), so totals across banks are only comparable from there.
// Older history stays stored and is still used to spot bills, subscriptions and yearly charges. Off: show everything.
export const historyCapped = () => db.prepare("SELECT value FROM meta WHERE key = 'history_all'").get()?.value !== '1';
export function historyStart() {
  if (!historyCapped()) return null;
  const s = reviewSince();
  return s === '0000-00-00' ? null : s;
}

// Card rewards are a rebate on purchases (the IRS agrees), so they reduce spending rather than count as income.
// Plaid usually files them as transfers, so they're recognized by description.
const CASH_BACK = /cash ?rewards?|cash ?back|rewards? redemption|statement credit/i;

// Sweeps happen at most brokerages and cash-management accounts; only the wording differs. Plaid labels them
// "money into/out of an investment fund" (which it also uses for real investing), so the description must
// also look like a sweep: a sweep phrase or a common money-market fund ticker. Checked only when the
// transaction didn't match another of your accounts.
const SWEEP_WORDS = /CORE ACCOUNT|SWEEP|MONEY MARKET|MONEY FUND|DEPOSIT PROGRAM|BANK DEPOSIT|PURCHASE INTO|REDEMPTION|REINVEST|\b(SPAXX|FDRXX|FZFXX|SPRXX|FZDXX|VMFXX|VMRXX|SWVXX|SNVXX|SNOXX|IIAXX|TTTXX)\b/i;
const SWEEP = (t) => /_INVESTMENT_AND_RETIREMENT_FUNDS$/.test(t.pfc_detailed ?? '') && SWEEP_WORDS.test(t.name ?? '');

// Some brokerages (Merrill) report a fund's cash dividend as "money in from an investment fund", named after
// the fund, the same Plaid label used for money-market sweeps. A fund name that isn't a sweep is a payout.
const FUND_PAYOUT = (t) => t.amount < 0 && t.pfc_detailed === 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS'
  && /\b(ETF|FUND|INDEX|TRUST)\b/i.test(t.name ?? '') && !/REDEMPTION|PURCHASE|REINVEST|SWEEP|CORE ACCOUNT|TRANSFER|SOLD|SALE/i.test(t.name ?? '');

// Descriptions Plaid reliably misreads, checked before its category (first match wins).
// Bilt: rent charged to a card reads "BPS*BILT RENT" (older: "BPS*BILT REWARDS A") and Plaid matches the "BP"
// to the gas station. BiltProtect then pays that charge from your bank ("BILTPROTECT RENT ACH CREDIT"), which
// Plaid calls rental income; it's a card payment, i.e. moving your own money.
const MISREAD = [[/BILTPROTECT/i, 'Transfer'], [/BPS\*BILT|BILT\s*RENT/i, 'Rent']];
const misread = (t) => MISREAD.find(([re]) => re.test(t.name ?? ''))?.[1];

// ---- Payments with people (Venmo, PayPal, Cash App, Zelle) ----
// Plaid guesses their category from the note, and often wrongly ("Denver" → Clothing), so its guess is
// ignored. A short keyword list reads the note instead; anything else stays "Payment apps" for you to sort.
// Venmo-style: `Person Name "the note"` in a payment-app account. Zelle: "Zelle payment to/from NAME ...".
const VENMO_STYLE = /^(.+?) "(.*)"$/s;
const ZELLE = /^Zelle\s+(?:payment|transfer)?\s*(?:to|from)\s+(.+?)(?:\s+(?:Conf#|on \d|ID:).*)?$/i;
export function peerOf(t, institution) {
  const app = PAY_APP.test(institution ?? '');
  // In a payment app, a name with a quoted note is always a payment with a person, even when Plaid recognizes a
  // business mentioned in the note ("Convenience fee - Alamo drafthouse").
  const v = app ? (t.name ?? '').match(VENMO_STYLE) : null;
  if (v) return { person: v[1].trim(), note: v[2], pattern: `${v[1].trim()} "` };
  const z = (t.name ?? '').match(ZELLE);
  if (z) return { person: z[1].trim(), note: '', pattern: z[1].trim() };
  return null;
}
// Note keywords → category. Words match whole words; emoji anywhere. First match wins.
const NOTE_WORDS = [
  [/\b(rent|landlord)\b/i, 'Rent'],
  [/\b(electric|utilities|utility|water bill|internet|wifi)\b|💡/i, 'Utilities'],
  [/\b(groceries|grocery|costco|h-?e-?b|trader joe'?s|whole foods)\b|🛒/i, 'Groceries'],
  [/\b(coffee|latte|boba|tea)\b|☕|🧋/i, 'Coffee'],
  [/\b(beer|beers|drinks?|bar|wine|cocktails?|shots)\b|🍺|🍻|🍷|🍸|🍹|🥂/i, 'Alcohol & bars'],
  [/\b(dinner|lunch|brunch|breakfast|food|sushi|pizza|ramen|pho|tacos?|bbq|burgers?|dumplings?|kbbq|hot ?pot|restaurant|apps|meal|eats?|snacks?)\b|[🍕🍣🍜🍔🌮🥟🍱🍛🍝🍗🥘🍲🥗🍤🥡🍙🍚🥒🍰🍩🍦]/iu, 'Restaurants'],
  [/\b(uber|lyft|taxi|cab|ride|gas money|parking|tolls?)\b|🚕|🚗/i, 'Rideshare & transit'],
  [/\b(flights?|airbnb|hotel|hostel|trip|vacation|cabin|lodging|rental car)\b|✈️|🏨|🏝️|🏕️/i, 'Travel'],
  [/\b(movies?|tickets?|concert|show|theat(er|re)|bowling|karaoke|games?|poker|cinema|drafthouse|museum|festival)\b|🎬|🎟️|🎫|🎤|🎳|🎮/i, 'Entertainment'],
  [/\b(climbing|gym|yoga|bouldering|class|pilates|tennis|pickleball|volleyball|vb|soccer|basketball|ski|lift)\b|🧗|🪨|🏋️|🧘|🎾|🏐|⚽|🏀/i, 'Fitness'],
  [/\b(gift|present|birthday|bday|wedding|donation)\b|🎁|🎂|🎉/i, 'Gifts & donations'],
  [/\b(haircut|hair|nails)\b|💇|💅/i, 'Personal care'],
];
export const noteCategory = (note) => NOTE_WORDS.find(([re]) => re.test(note ?? ''))?.[1] ?? null;

// Only these kinds of transactions can be one side of a transfer (never a purchase at a merchant).
const PAIRABLE = new Set(['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS', 'OTHER', null]);
const PAIR_DAYS = 5;
const PAY_APP = /venmo|paypal|cash ?app/i;
const day = (d) => Date.parse(d + 'T00:00Z') / 864e5;
// Where saved money lives. A matched transfer into one of these (from an everyday account) is a contribution.
const SAVINGS_SUBTYPES = new Set(['savings', 'money market', 'cd', 'hsa']);
const savingsKind = (a) => (!a ? null : a.type === 'investment' ? 'Investments' : SAVINGS_SUBTYPES.has(a.subtype) ? 'Savings' : null);

// Recomputes category, grp and transfer_pair for every transaction. Order of precedence:
// a one-off manual choice, then your rules (newest first), then a matched transfer, then card cash back,
// then fund dividends, then sweeps, then Plaid's category.
export function classify() {
  const rules = db.prepare('SELECT pattern, category FROM category_rules ORDER BY id DESC').all()
    .map((r) => ({ ...r, p: r.pattern.toLowerCase() }));
  const accounts = Object.fromEntries(db.prepare(`SELECT a.id, a.type, a.subtype, a.mask, i.institution FROM accounts a
    LEFT JOIN items i ON i.id = a.item_id`).all().map((a) => [a.id, a]));
  // Accounts identifiable by their number ending (Plaid's mask), for transfers whose other side is missing.
  const byMask = Object.values(accounts).filter((a) => a.mask && a.mask.length >= 4);
  const txns = db.prepare(`SELECT id, account_id, date, name, amount, pending, pfc_primary, pfc_detailed, user_category, counterparty,
    reimburses, split_of, is_split FROM transactions ORDER BY date`).all();
  const ruled = new Map();
  for (const t of txns) { const r = rules.find((x) => t.name?.toLowerCase().includes(x.p)); if (r) ruled.set(t.id, r.category); }

  // Match money leaving one of your accounts with the same amount arriving in another, within a few days.
  const pair = new Map();
  const incoming = new Map(); // cents -> [txn]
  // A rule or manual choice of "Transfer" still pairs, so both sides show as one row.
  const settled = (t) => (t.user_category ?? ruled.get(t.id) ?? 'Transfer') !== 'Transfer';
  // Payments with people are never your own money moving, even when another transfer has the same amount.
  const free = txns.filter((t) => !settled(t) && !CASH_BACK.test(t.name ?? '') && PAIRABLE.has(t.pfc_primary ?? null)
    && !peerOf(t, accounts[t.account_id]?.institution) && !t.split_of && !t.is_split);
  for (const t of free) {
    if (t.amount >= 0) continue;
    const k = Math.round(-t.amount * 100);
    if (!incoming.has(k)) incoming.set(k, []);
    incoming.get(k).push(t);
  }
  const pairCat = new Map(); // id -> category for matched transfers into or out of savings
  for (const t of free) {
    if (t.amount <= 0) continue;
    const best = (incoming.get(Math.round(t.amount * 100)) ?? [])
      .filter((c) => !pair.has(c.id) && c.account_id !== t.account_id && Math.abs(day(c.date) - day(t.date)) <= PAIR_DAYS)
      .sort((a, b) => Math.abs(day(a.date) - day(t.date)) - Math.abs(day(b.date) - day(t.date)))[0];
    if (!best) continue;
    pair.set(t.id, best.id); pair.set(best.id, t.id);
    // Into savings: the outgoing side is a contribution. Out of savings: the incoming side is a withdrawal (negative).
    const into = savingsKind(accounts[best.account_id]), from = savingsKind(accounts[t.account_id]);
    if (into && !from) pairCat.set(t.id, into);
    else if (from && !into) pairCat.set(best.id, from);
  }

  // No matching other side (e.g. it happened before that account's history starts): if the description names
  // one of your accounts by number, like "TRANSFERRED FROM ... Z99-123456-1" for an account ending 3456, link it.
  const named = new Map();
  for (const t of free) {
    if (pair.has(t.id) || !/^TRANSFER_|^LOAN_PAYMENTS$/.test(t.pfc_primary ?? '')) continue;
    if (/_INVESTMENT_AND_RETIREMENT_FUNDS$/.test(t.pfc_detailed ?? '')) continue; // money-market sweeps
    const tokens = (t.name ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter((x) => x.length >= 4);
    const hit = byMask.filter((a) => a.id !== t.account_id && tokens.some((x) => x.endsWith(a.mask.toUpperCase())));
    if (hit.length !== 1) continue; // none, or ambiguous
    named.set(t.id, hit[0].id);
    const other = savingsKind(hit[0]), own = savingsKind(accounts[t.account_id]);
    if (t.amount > 0 && other && !own) pairCat.set(t.id, other); // into savings
    if (t.amount < 0 && other && !own) pairCat.set(t.id, other); // out of savings: a withdrawal (negative)
  }

  // Funding a payment app you've connected: a bank charge from "Venmo" pays for a payment that also appears in
  // the Venmo account (to a friend, with the note). Counting both would double the spending, so when the app
  // side has the same amount within 5 days, the bank side is a transfer to the app account.
  const appAccounts = Object.values(accounts).filter((a) => PAY_APP.test(a.institution ?? '')).map((a) => a.id);
  if (appAccounts.length) {
    const appSide = txns.filter((t) => appAccounts.includes(t.account_id) && t.amount > 0);
    const used = new Set();
    for (const t of txns) {
      if (t.amount <= 0 || appAccounts.includes(t.account_id) || pair.has(t.id) || named.has(t.id) || settled(t)) continue;
      const app = (t.name ?? '').match(PAY_APP)?.[0];
      if (!app) continue;
      const m = appSide.filter((x) => !used.has(x.id) && Math.round(x.amount * 100) === Math.round(t.amount * 100)
        && Math.abs(day(x.date) - day(t.date)) <= PAIR_DAYS && new RegExp(app, 'i').test(accounts[x.account_id].institution ?? ''))
        .sort((a, b) => Math.abs(day(a.date) - day(t.date)) - Math.abs(day(b.date) - day(t.date)))[0];
      if (m) { used.add(m.id); named.set(t.id, m.account_id); }
    }
  }

  // Each category with the reason it was chosen (cat_source).
  const decide = (t) => {
    if (t.is_split) return ['Split', 'split'];
    if (t.user_category) return [rename(t.user_category), 'you'];
    if (ruled.has(t.id)) return [rename(ruled.get(t.id)), 'rule'];
    if (pairCat.has(t.id)) return [pairCat.get(t.id), 'transfer'];
    if (pair.has(t.id) || named.has(t.id)) return ['Transfer', 'transfer'];
    if (t.amount < 0 && CASH_BACK.test(t.name ?? '')) return ['Cash back', 'cash back'];
    if (FUND_PAYOUT(t)) return ['Dividends', 'fund payout'];
    if (SWEEP(t)) return ['Sweep', 'sweep'];
    if (misread(t)) return [misread(t), 'known description'];
    const peer = peerOf(t, accounts[t.account_id]?.institution);
    if (peer) {
      if (t.reimburses) return [null, 'paid back']; // filled in below from the charge it paid back
      const c = noteCategory(peer.note);
      return c ? [c, 'note'] : ['Payment apps', 'person'];
    }
    return [friendly(t.pfc_primary, t.pfc_detailed), 'plaid'];
  };
  const chosen = new Map(txns.map((t) => [t.id, decide(t)]));
  // Paid back: counts in the category of the charge it paid back (a negative amount there reduces it).
  for (const t of txns) {
    const c = chosen.get(t.id);
    if (c[1] === 'paid back') c[0] = chosen.get(t.reimburses)?.[0] ?? 'Payment apps';
  }
  // For a description Plaid misreads, its merchant guess is wrong too ("BPS*BILT RENT" → "BP"), so it's cleared and the
  // bank's description shows instead (syncs restore it; this runs after every sync).
  const upd = db.prepare(`UPDATE transactions SET category = ?, grp = ?, transfer_pair = ?, transfer_account = ?, cat_source = ?,
    merchant = CASE WHEN ? THEN NULL ELSE merchant END WHERE id = ?`);
  db.transaction(() => {
    for (const t of txns) {
      const [category, source] = chosen.get(t.id);
      upd.run(category, category === 'Split' ? 'Split' : groupOf(category), pair.get(t.id) ?? null, named.get(t.id) ?? null, source,
        source === 'known description' ? 1 : 0, t.id);
    }
  })();
}
