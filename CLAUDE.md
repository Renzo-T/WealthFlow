# Mizo Money

Local, single-user personal finance dashboard on Plaid. Express API on Node's built-in SQLite (`node:sqlite`, wrapped
in `server/db.js` with `transaction()` and `backup()`; no compiled add-ons) in `server/`, and a React + Vite UI in
`web/`. Everything runs on the user's machine. The data folder (`server/config.js` `dataDir`: `data/` from the code,
the user's app-data folder for the download, `WEALTHFLOW_DATA_DIR` overrides) holds `wealthflow.db`, `backups/`,
`app.log` and `config.json` (Plaid keys saved by the first-run screen, and the `ENCRYPTION_KEY` generated on first
start; `.env`/environment variables override it). See README.md for setup.

## Setup and Plaid Link
- First run (no keys): `FirstRun` in `web/src/PlaidSetup.jsx`; `POST /api/link/setup` checks the keys with Plaid
  (creates a link token) before `saveConfig()` and `resetPlaid()` (`server/plaid.js` rebuilds its client lazily).
- Connecting/reconnecting uses **Hosted Link**: the token is created with `hosted_link: {}`, `Connect.jsx` opens
  `hosted_link_url` in a new tab and polls `GET /api/link/status/:token` (`linkTokenGet` → `sessionResult()`); a new
  bank's public token is exchanged there, once. No https or redirect URI needed. Embedded Link (`?hosted=0`, with
  `PLAID_REDIRECT_URI` and `/oauth`) is only a fallback.
- Releases: `npm run release` (`scripts/release.mjs`) bumps the version, tags `vX.Y.Z` and pushes;
  `.github/workflows/release.yml` checks, builds the zip on Windows and publishes a GitHub Release. The update notice
  (`server/updates.js`, `/api/update`) asks GitHub for the latest release of package.json's `repository` at most daily
  (off in Settings › Updates; `WEALTHFLOW_UPDATE_CHECKS=0` in tests) and shows it in the page header and Settings.
- `npm run demo -- <folder>` (`scripts/demo.mjs`): a seeded, invented household in a new data folder, used for the README
  screenshots (`docs/screenshots/`); never put real data in screenshots.
- `npm run package` builds the Windows download (`release/`, gitignored): official Node from nodejs.org
  (checksum-verified), server + runtime deps only (page libraries are devDependencies), the built page, a `PORTABLE`
  marker (→ app-data folder) and `Mizo Money.cmd` (`app.mjs --background --open`).

## Run
- `npm start`: API (`node --watch`, port 4000) and Vite 8 (port 3000, proxies `/api`) together. Node 22.13+ (`node:sqlite`
  without a flag; `server/env-check.js` refuses older).
- The rail is icons only (`.shell.slim`, App.jsx) and opens over the page while hovered or focused (`.shell.railopen`); the page never moves.
- `npm run app`: everyday use. `scripts/app.mjs` builds `web/dist` when sources are newer, then runs the server with
  `WEALTHFLOW_APP=1`: page + API together on 3000 (https with `certs/`). Installable (manifest, icons, `web/public/sw.js`,
  which only shows a built-in "isn't running" page when the server is down; nothing is cached). Settings > App:
  install prompt, "Start when I sign in" (`server/startup.js`, an HKCU Run entry; Windows only), "Let the app window
  start Mizo Money" (a `wealthflow://` link under HKCU\Software\Classes that runs the same hidden command and ignores
  the address; the offline page's Start button opens it, and the page reloads once `/api/app` answers), Stop
  (`/api/app/quit`, app mode only). Vite uses `strictPort`, so `npm start` fails clearly while the app holds 3000.
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
  errors, failed API calls, empty or still-loading pages, sideways scrolling, or a box off the dot grid (grid.js's
  `offGrid`; `--width 1280`, `--pages dashboard,bills`, `--journal plum`); screenshots go to `ui-shots/`
  (gitignored). Run it after UI changes. A page that throws shows an error card (`PageBoundary`) instead of blanking the app.

- `npm run verify`: secrets scan (with `--staged`), tests, a production build, and `check:ui` when the app is running.
  It's the git pre-commit hook (`.githooks/`, enabled by `npm install` via `prepare`); don't bypass it.

## Never commit
`.env` (Plaid keys + `ENCRYPTION_KEY`), `certs/`, `data/` (database, backups, `config.json` with keys), `release/`.
All are gitignored. Bank access tokens in the DB are AES-GCM encrypted with `ENCRYPTION_KEY` (`server/crypto.js`).

## Data flow
1. **Sync** (`server/sync.js`): `syncAll()` runs on startup (if none in the last hour), every 6 h, and from the Refresh
   button; one at a time. Per bank: transactions (`/transactions/sync` cursor), accounts + daily balance snapshot,
   consent check (`/item/get`), holdings, card statements (Liabilities), Plaid recurring streams. Then `classify()`.
   The first sync each day also writes `backups/auto-YYYY-MM-DD.db` in the data folder (`server/backup.js`, keeps 14).
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
   - "Spent" totals (standing strip, month spread total, budget totals) all use `spendingBetween()`: a refund reduces
     only its own group, never below zero; what's left out is returned as `refunds` and named in the UI.
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
   Adding a bill starts from a past payment (`scheduleFromPayment`, `POST /bills/from-payment`, also "Repeats" on a
   transaction and the paycheck prompt): your rule on that series in `bill_settings`, so it shows with one payment
   (`detect(today, pinned)`) and a pattern found later is the same bill. Typed-in (manual) bills are for money outside
   connected accounts; when detection finds one anyway, the detected bill takes over (under your name) and the manual
   one gets `same_as` and is left out of every total.
4. **Budget** (`server/budget.js`): one monthly amount per subcategory (`budgets`), rolled up by group; actuals are
   signed (refunds reduce spending); "fixed" = the category has a recurring bill ("nonmonthly" when all its bills
   come every few months or yearly); suggestions come from bills (converted to a monthly amount) or the average
   of recent months. `budget_overrides` holds an amount for one month only (item = category or `group:<name>`);
   `budget_rollover` categories carry unspent money forward from `since` (overspending reduces it).
5. **Comparisons and watchlist** (`server/watch.js`): this month so far vs the same days of last month, only
   across banks whose history reaches last month, never before the 5th, no % on small bases; "what changed" and
   "frequent spending" leave recurring bills out (bills post on different days each month). Watchlist = a
   category or merchant with average, year to date, this month, target and straight-line projection.
6. **Trips** (`server/trips.js`, `server/geo.js`; shown as the Trips tab of Reports, `#/trips` redirects to
   `#/reports?tab=trips`): home bases (set on the Trips tab, or inferred from where most
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
   Assets and debts you add (`server/assets.js`) have a value history (`manual_asset_values`: value from a date on, ''
   = from the start), so a new value never backdates; a transfer can be counted toward one (`tx_id`), which takes it
   out of What moved's "moved to accounts not tracked". `manual_assets.value` is kept as today's value.

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
- The visual system is **DESIGN.md** (the "Planner Page" world: indigo cover rail, ruled paper, one typeface Atkinson Hyperlegible Next
  with equal-width figures, vermillion seal as the logo only) with tokens in `.impeccable/design.json`; PRODUCT.md holds
  product truth and `.impeccable/surfaces/` the dashboard's direction contract. Read DESIGN.md before UI work.
- Building blocks in `web/src/ui.jsx`: `Panel` (card + header), `PageHeader`, `Amt` (amount that "Hide amounts"
  blurs), `Seal` (logo), drawn icons (`Trend`, `Chevron`, `Check`, `Close`, `Repeat`; never text glyphs as icons).
  Prefer classes over inline styles; inline styles are for data-driven colours only.
- Journals (Settings › Journal): colour presets in `web/src/journals.js` (the only place cover/paper/ink/highlighter/tape
  colours are defined, checked by `tests/journals.test.js`), applied as `data-journal` on <html> by `journal.js`;
  decoration (tape, doodles, pen underlines) follows DESIGN.md's decoration budget and can be switched off
  (`data-decoration="off"`).
- Money flow: the Sankey (`Flow.jsx`) plus the month replay (`MonthReplay.jsx` + `monthReplay()` in `server/spread.js`): cash in
  everyday accounts day by day, paydays and bills that moved it, days ahead from scheduled items only.
- Panels are pencil lines on the paper (an outline over a 35% wash, `--sheet`), never white sheets with shadows; only
  things that float (dialogs, tips, menus) are solid.
- Grid unit: everything sits on the page's dot grid (`--u`; DESIGN.md › Grid Unit): 22px, stepped by window width (20px
  below 1280, 24px from 1920, 26px from 2400; the root font size follows it), content capped at 64 units and centred. Widths are whole units in CSS
  (`round(down, …, var(--u))`, gaps of U); `web/src/grid.js` (`startGrid`, from App.jsx) rounds the heights of panels,
  ruled sections and top-level blocks up to whole units. List and table rows are 2U. Don't animate a panel's position.
- Dashboard: `lead` panels (where you stand; "This month": the calendar `MonthSpread.jsx` + `server/spread.js` with
  Needs you / Coming up beside it and Budget under it, `Glance.jsx`; it replaced the `month` and `glance` panels, folded
  together for saved layouts by `was` in `PANELS`) run full width; where you stand (`LOOSE` in `Dashboard.jsx`) sits on
  the paper with no panel, the rest share one ledger; the rest pack into unit rows (`usePacked`). Bills uses the same
  calendar full width, stamps-only, with each day's bills and paydays written in the day (click a day to list it under the calendar).
  The header's sub-line is a since-last-visit digest (`Digest` in `Cards.jsx`, `GET /api/since?from=`). Free to spend
  is the only "how much can I spend" number; Budget's lead figure is "Not yet assigned", a planning number.
- Money (`web/src/format.js`): cents (`usd2`) for individual transactions and bills, whole dollars (`usd`) for totals,
  `usdCompact(v, 1)` on chart axes with round ticks from `niceTicks()`, real minus sign via `signed`.
- Colours: theme tokens in `styles.css` `:root` (light + dark). Chart series `SERIES` are theme variables `--s1..--s4`,
  validated for colour-blind separation against each theme's own surface; anything beyond four is grey. Green/red mean in/out or good/bad only.
- Charts measure their width (`useWidth`) so text stays the same size; Sankeys are capped at 1000px.
- Estimated or incomplete data is always marked (dashed net worth history, partial months, "est" amounts).
