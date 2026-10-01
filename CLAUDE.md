# WealthFlow

Local, single-user personal finance dashboard on Plaid. Express + better-sqlite3 API (`server/`, port 4000) and a
React + Vite UI (`web/`, port 3000, proxies `/api`). Everything runs on the user's machine; data lives in
`data/wealthflow.db`. See README.md for setup.

## Run
- `npm start`: API (`node --watch`) and Vite 8 together. Node 22.12+ (Vite 8's minimum; better-sqlite3 v12 supports 22 and 24).
- `npm test`: node:test suites in `tests/` against an in-memory database (`WEALTHFLOW_DB=':memory:'`, set by
  `tests/helpers.js`), so they never touch `data/`. They cover categorization (transfer pairing, rules, sweeps,
  dividends, cash back) and bills (holidays, schedule rules, detection, card statements, your edits). When fixing a
  bug in that logic, add a test that fails without the fix. `tests/api.test.js` sends real HTTP requests to the
  routes (data, plan, system, trips) the way the pages do; add one there for any new endpoint or page action.
- Keep it generic: no logic tuned to one person's data, and no real names, employers or account numbers in code,
  comments or tests (use stand-ins like Acme Corp, Alex Rivera, mask 3456).
- Also check UI changes with `npx vite build web --outDir ../../_tmpbuild` (then delete it) and by calling the API
  with curl. UI checks: headless Edge screenshots (`msedge --headless=new --ignore-certificate-errors
  --screenshot=… https://localhost:3000/#/page`; `--blink-settings=preferredColorScheme=0` for dark mode).
- Vite's file watcher on Windows sometimes misses edits made by scripts; `touch` the edited files if the browser
  serves stale code.
- `npm run check:ui` (with the app running) loads every page in headless Chrome/Edge in light and dark mode and fails on
  errors, failed API calls, empty or still-loading pages, or sideways scrolling; screenshots go to `ui-shots/`
  (gitignored). Run it after UI changes. A page that throws shows an error card (`PageBoundary`) instead of blanking the app.

- `npm run verify`: secrets scan (with `--staged`), tests, a production build, and `check:ui` when the app is running.
  It's the git pre-commit hook (`.githooks/`, enabled by `npm install` via `prepare`); don't bypass it.

## Never commit
`.env` (Plaid keys + `ENCRYPTION_KEY`), `certs/`, `data/` (database and backups). All are gitignored. Bank access
tokens in the DB are AES-GCM encrypted with `ENCRYPTION_KEY` (`server/crypto.js`).

## Data flow
1. **Sync** (`server/sync.js`): `syncAll()` runs on startup (if none in the last hour), every 6 h, and from the Refresh
   button; one at a time. Per bank: transactions (`/transactions/sync` cursor), accounts + daily balance snapshot,
   consent check (`/item/get`), holdings, card statements (Liabilities), Plaid recurring streams. Then `classify()`.
   The first sync each day also writes `data/backups/auto-YYYY-MM-DD.db` (`server/backup.js`, keeps 14).
2. **Categorize** (`server/categories.js`, `classify()` recomputes every transaction). Two levels: budget **groups**
   (`GROUPS`) and subcategories; `transactions.category` is the subcategory, `grp` its group. Precedence:
   one-off user choice > user rules (`category_rules`, newest first) > matched transfer > card cash back >
   fund dividend > sweep > known misreads (`MISREAD`, e.g. Bilt rent read as BP gas) > payments with people >
   Plaid's category (`friendly()`). The reason is stored in `cat_source` (shown in the transaction details, with
   Plaid's `pfc_confidence`).
   - Merged categories (`RENAMED`) are migrated once (`migrateCategories`) and mapped wherever they still turn up;
     `RARE` ones appear in menus (`pickerGroups`) only once something uses them.
   - **Payments with people** (`peerOf`: `Name "note"` in a payment-app account, or Zelle): Plaid's guess is
     ignored; `noteCategory` reads the note, otherwise "Payment apps" and the sorting panel on Transactions
     (`/review/people`). `reimburses` links money a friend sent you to the charge it paid back, which gives it that
     charge's category. Payments with people never pair as transfers.
   - **Transfers** are paired across your accounts (same amount, opposite sign, ≤5 days) into `transfer_pair`;
     unpaired ones naming an account by its number (mask) get `transfer_account`. Into savings/investments = a
     contribution (Savings & investments group).
   - Not spending: Income, Transfer, Savings & investments, Debt repayment, Split (`NOT_SPENDING`, `SPEND_SQL`).
   - **Splits**: each part is a transaction row (`split_of` = the original's id, your category); the original gets
     `is_split` and category/group "Split", so totals count the parts. Raw per-account sums (balance history, bill
     detection, transfer pairing) must skip `split_of IS NOT NULL` rows; the transactions list shows originals with
     `parts` (`@parts` in `TX_WHERE`), totals and CSV use the parts.
3. **Bills** (`server/recurring.js`, `bills()`): detected series + Plaid streams + card statements + manual, with
   user edits from `bill_settings` always winning. Schedules are rules (`dom`, `eom`, `bday`, `lastbday`, `weeks`,
   `months`, `due`) that know weekends and US bank holidays. Paid card statements are `unscheduled` (hidden from
   Upcoming) unless the user pays from the running balance. `freeToSpend()`: cash in everyday accounts + income still
   coming this month (from tomorrow) − bills still due this month − card balances (card-payment bills aren't counted
   again) − a cushion (meta `safe_cushion`). A single paycheck with no pattern is offered via `paycheckCandidates()`.
   `seriesKey()` decides which series a transaction belongs to; the transactions list uses it for the ↻ marker.
4. **Budget** (`server/budget.js`): one monthly amount per subcategory (`budgets`), rolled up by group; actuals are
   signed (refunds reduce spending); "fixed" = the category has a recurring bill ("nonmonthly" when all its bills
   come every few months or yearly); suggestions come from bills (converted to a monthly amount) or the average
   of recent months. `budget_overrides` holds an amount for one month only (item = category or `group:<name>`);
   `budget_rollover` categories carry unspent money forward from `since` (overspending reduces it).
5. **Comparisons and watchlist** (`server/watch.js`): this month so far vs the same days of last month, only
   across banks whose history reaches last month, never before the 5th, no % on small bases; "what changed" and
   "frequent spending" leave recurring bills out (bills post on different days each month). Watchlist = a
   category or merchant with average, year to date, this month, target and straight-line projection.
6. **Trips** (`server/trips.js`, `server/geo.js`): home bases (set on the Trips page, or inferred from where most
   in-person spending happens; bills are placed at company HQs, so they're ignored), an "away" setting (distance,
   default 100 miles, from Plaid's coordinates or the bundled US city table; another state; abroad only), trips
   suggested from runs of in-person purchases away, and `assignTrips()` writing `transactions.trip_id` (a
   `trip_override` you chose wins). Confirmed trips are left out of the comparisons in `watch.js`. `refreshTrips()`
   runs after each sync; `assignTrips()` after every `classify()` in the routes. Only in-person purchases have a
   place: online ones carry the company's address.
7. **Reports** (`server/reports.js`; charts and reports start at `historyStart()`, 3 months before the first connection unless turned off in Settings): month-by-month spending and income by group/category (months before every bank's
   history starts are marked partial and left out of averages), subscriptions (recurring bills outside essentials, with
   price changes), and the year in review (income and savings only when the year is fully covered).
8. **Insights** (`server/insights.js`): cash flow, top spending, allocation (`holdingKind`), money flow (`flow`,
   `accountFlow`), coverage (which bank's history starts last; months before it are "partial").
   `accountHistory()` (`server/summary.js`) gives per-account daily balances; net worth history sums it.

## Plaid quirks we've hit
- New connections fill in slowly; `/transactions/refresh` and `/investments/refresh` fetch immediately.
- Fidelity: Checking history started weeks later than other accounts. Money-market sweeps (SPAXX) are labelled
  `*_INVESTMENT_AND_RETIREMENT_FUNDS`, the same label as real investing (hence the `Sweep` rule).
- Merrill sent 8 identical pending copies of one dividend (deduped in sync); its ETF dividends arrive as
  "transfer in from fund" (hence `FUND_PAYOUT`).
- Bank of America Liabilities: no statement issue date; a paid statement shows minimum payment 0.
- Consent can lag right after Link approval: `/link/granted` records it immediately; syncs only ever confirm.
- Venmo "Standard transfer" = cashing out to a bank; person-to-person payments carry the note as the name.
- With Venmo connected, a bank charge named "Venmo" funds a payment that also appears in the Venmo account;
  `classify()` turns the bank side into a transfer so the spending isn't counted twice.

## UI conventions
- Building blocks in `web/src/ui.jsx`: `Panel` (card + header), `PageHeader`, `Amt` (amount that "Hide amounts"
  blurs). Prefer classes over inline styles; inline styles are for data-driven colours only.
- Money (`web/src/format.js`): cents (`usd2`) for individual transactions and bills, whole dollars (`usd`) for totals,
  `usdCompact` on chart axes, real minus sign via `signed`.
- Colours: theme tokens in `styles.css` `:root` (light + dark). Chart series `SERIES` (4 hues) were checked for
  colour-blind separation in both themes; anything beyond four is grey. Green/red mean in/out or good/bad only.
- Charts measure their width (`useWidth`) so text stays the same size; Sankeys are capped at 1000px.
- Estimated or incomplete data is always marked (dashed net worth history, partial months, "est" amounts).
