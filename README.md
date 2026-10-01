# WealthFlow

A local, single-user finance dashboard on Plaid's free Trial plan: net worth, spending, budgets, goals, holdings, and a projection. Everything runs on your machine, and your data stays in a local SQLite file.

## What it does
- **Dashboard:** net worth, this month's income and spending, what changed vs last month, upcoming bills and income,
  Free to spend (what's left this month after bills, card balances and a cushion), a watchlist, goals and a projection.
  A Getting started checklist walks a new setup through the steps below. Panels can be reordered or hidden.
- **Transactions:** search and filter, fix categories (once or with a rule), split one into several categories,
  and sort what Plaid can't know: transfers to accounts you haven't connected and payments with people (Venmo, Zelle),
  including money friends send you back for a charge.
- **Budget:** per category or as one amount per group, for every month or a single month; fixed, flexible and
  non-monthly bills; rollover for money that builds up between bills; suggestions from your bills and spending.
- **Bills:** recurring bills and income detected from your transactions, Plaid and card statements, on schedules that
  know weekends and bank holidays. One paycheck is enough: it asks how often you're paid.
- **Trips:** suggested from purchases made in person away from home (another state, more than N miles, or abroad;
  several home bases supported), with bookings made beforehand and settle-ups with friends. Trips stay in your
  budget categories (optional) but are left out of month-to-month comparisons.
- **Money flow, Net worth, Investments, Forecast, Goals:** where money went, every account's balance and trend,
  holdings and allocation, a long-term projection, and savings goals with target dates.

Your data only changes when you change it. WealthFlow only asks you to sort recent transactions (from 3 months before
your first bank connection), since older history tends to have gaps.

## You need
- **Node 22.12 or newer** (22 and 24 both work; Vite 8 needs 22.12+).
- A free Plaid account on the **Trial plan**: dashboard.plaid.com/signup (US/Canada). Real data, up to 10 connections, and removing one does not free its slot.
- **mkcert** (only for real banks, since big banks use OAuth, which requires https).

## Quick start
1. `npm install`
2. `npm run setup` creates `.env` with a fresh `ENCRYPTION_KEY` and, if mkcert is installed, local https certs.
3. Open `.env` and add your Plaid client ID and **Sandbox** secret from Plaid Dashboard > Developers > Keys.
4. `npm start`, then open http://localhost:3000.

Sandbox uses fake banks. Log in with `user_good` / `pass_good` (2FA code `1234`).

## Using it as an app
`npm start` is for working on the code. For everyday use:
1. `npm run app` builds the page (only when it has changed) and runs WealthFlow as one program at the same address,
   https://localhost:3000.
2. **Settings > App > Install WealthFlow** (Chrome or Edge) installs it with its own window, Start-menu entry and
   taskbar icon.
3. **Settings > App > Start WealthFlow when I sign in** (Windows) starts it hidden whenever you sign in, so the window
   opens straight away and your banks keep updating with the window closed. Its output goes to `data/app.log`.
   **Stop WealthFlow** in the same panel shuts down the background copy.

If WealthFlow isn't running, the installed window says so instead of showing a browser error. `npm start` and the app
both use port 3000, so stop one before starting the other.

## Connecting real banks
1. In `.env`: `PLAID_ENV=production`, your **Production** secret (a different secret from Sandbox), and `PLAID_REDIRECT_URI=https://localhost:3000/oauth`.
2. In Plaid Dashboard > Team Settings > API > Allowed redirect URIs, add exactly that URI.
3. Make sure `certs/localhost.pem` exists (`npm run setup` creates it), restart, and open **https**://localhost:3000.
4. Click **Connect a bank**. Use a desktop browser on the same machine.

Test bank logins in Sandbox first, since each real link uses one of your 10 slots.

## Sharing with someone else
Each person runs their own copy with their **own Plaid account, keys, and database**. Send them the code, never your `.env`, `data/`, or `certs/` folders. Using your keys for someone else's banks would use your 10 slots and put their bank tokens in your database.

## Backups
**Settings > Download backup** saves a copy of the database. Bank tokens are encrypted with the key in `.env`, so keep `.env` somewhere safe too. To restore, stop the app, replace `data/wealthflow.db` with the backup, and start again.

## For developers
- `npm test`: server tests against an in-memory database, including real HTTP requests to the routes.
- `npm run check:ui`: with the app running, loads every page in headless Chrome or Edge (light and dark) and fails on
  errors, failed requests or broken layouts; screenshots go to `ui-shots/`.
- `npm run verify`: everything above plus a production build and a scan that refuses secrets. It runs automatically
  before every commit (`npm install` turns the hook on).
- `CLAUDE.md` describes the architecture, the data flow and the Plaid quirks handled.

## Troubleshooting
- **"Setup incomplete" on start:** a value in `.env` is missing or invalid.
- **API won't start, error mentions `NODE_MODULE_VERSION`:** you switched Node versions. Run `npm rebuild better-sqlite3`.
- **Bank return page fails:** the redirect URI must match exactly in `.env`, the Plaid Dashboard, and your address bar, and you must be on https.
- **"Add holdings" banner:** your bank has investment accounts. Click it once to grant access to holdings.
- **Upcoming bills empty:** recurring items need a few occurrences to be detected; add one yourself on the Bills page. For pay, answer "How often are you paid?".
- **A bank's history starts recently:** some banks only share a few weeks or months. Months before every bank's history starts are marked partial, and comparisons wait until there's a full month.
