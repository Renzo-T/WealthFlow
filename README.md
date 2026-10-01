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

## Get started
You need a free [Plaid](https://dashboard.plaid.com/signup) account (US/Canada). Plaid is the service that connects to
your banks; your data comes straight to your computer. Then pick one:

**Windows, nothing to install:** download `WealthFlow-<version>-win-x64.zip`, unzip it somewhere permanent (e.g.
Documents) and double-click `WealthFlow.cmd`. It opens WealthFlow in your browser. Windows may warn that the file is
from an unknown publisher (it isn't code-signed); choose **More info > Run anyway**. To make the zip yourself from
the code, run `npm run package`.

**Any system, from the code:** install [Node](https://nodejs.org) 22.13 or newer, then:
```
npm install
npm run app
```
and open http://localhost:3000.

On first run WealthFlow asks for your Plaid **client ID** and **secret** (Plaid dashboard > Developers > Keys) and checks
them with Plaid. Then click **Connect a bank**: Plaid's sign-in page opens in a new tab, and WealthFlow picks up the
connection when you finish there.

- **Sandbox** keys work straight away with test banks (`user_good` / `pass_good`, code `1234`).
- **Production** keys connect your real banks. Request Production access in the Plaid dashboard; the free **Trial plan**
  allows 10 bank connections, and removing one doesn't free its slot, so try things in Sandbox first. Sandbox and
  Production have different secrets; switch in **Settings > Plaid keys**.

## Everyday use
- **Settings > App > Install WealthFlow** (Chrome or Edge) gives it its own window, Start-menu entry and taskbar icon.
- **Settings > App > Start WealthFlow when I sign in** (Windows) starts it in the background whenever you sign in, so
  the window opens straight away and your banks keep updating (every 6 hours) with the window closed. That's also what
  builds your day-by-day balance history, which Plaid can't fill in later.
- **Settings > App > Stop WealthFlow** stops the background copy. If WealthFlow isn't running, the installed window
  says so and how to start it.

## Your data
Everything stays on your computer, in WealthFlow's data folder:
- **Download:** `%LOCALAPPDATA%\WealthFlow`, so replacing the app folder with a newer version keeps your data.
- **From the code:** `data/` in the project. `WEALTHFLOW_DATA_DIR` moves it.

It holds the database, daily automatic backups (`backups/`, the last 14), `app.log`, and `config.json` with your Plaid
keys and the key that encrypts your bank connections. **Settings > Backup** downloads a copy of the database; keep a
copy of `config.json` with it, since without that key every bank has to be connected again (using new slots). To
restore, stop WealthFlow, put the backup in place of `wealthflow.db`, and start it again.

**Updating:** stop WealthFlow, then replace the folder with the new download (or `git pull` and `npm install`), and
start it again. If "Start when I sign in" was on and the folder moved, turn it off and on.

**Sharing:** each person needs their own copy with their own Plaid account and keys. Never send someone your data
folder, `config.json` or `.env`: your keys would use your 10 slots and put their bank connections in your database.

## For developers
- `npm start`: the API (port 4000, restarts on changes) and Vite (port 3000, live reload) together. `npm run app` and
  `npm start` both use port 3000, so stop one before starting the other.
- `npm test`: server tests against an in-memory database, including real HTTP requests to the routes.
- `npm run check:ui`: with the app running, loads every page in headless Chrome or Edge (light and dark) and fails on
  errors, failed requests or broken layouts; screenshots go to `ui-shots/`.
- `npm run verify`: everything above plus a production build and a scan that refuses secrets. It runs automatically
  before every commit (`npm install` turns the hook on).
- `npm run package`: the Windows download in `release/` (bundles the official Node from nodejs.org).
- `.env` (see `.env.example`) overrides `config.json`, handy for development. `certs/localhost.pem` and
  `certs/localhost-key.pem` (e.g. from mkcert) make the app use https; only the embedded-Link fallback needs that.
- `CLAUDE.md` describes the architecture, the data flow and the Plaid quirks handled.

## Troubleshooting
- **"WealthFlow isn't running" / the page doesn't load:** start it (`WealthFlow.cmd` or `npm run app`). If it still
  won't start, the end of `app.log` in the data folder says why.
- **"Port 3000 is in use":** another WealthFlow (perhaps the one started at sign-in) or `npm start` is already
  running. Use that one, or stop it first.
- **"Plaid didn't accept those keys":** copy the whole client ID, and the secret for the environment you picked
  (Sandbox and Production secrets differ).
- **"Needs Node 22.13 or newer":** update Node from nodejs.org (or use the download, which brings its own).
- **A bank needs you to sign in again:** click **Reconnect**. Plaid's page opens in a new tab; finish there.
- **"Add holdings" banner:** your bank has investment accounts. Click it once to grant access to holdings.
- **Upcoming bills empty:** recurring items need a few occurrences to be detected; add one yourself on the Bills page.
  For pay, answer "How often are you paid?".
- **A bank's history starts recently:** some banks only share a few weeks or months. Months before every bank's
  history starts are marked partial, and comparisons wait until there's a full month.
