# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two people: the owner and one friend, each running their own copy with their own banks. They mostly drop in for
quick check-ins a few times a week (what changed, what's due, am I on budget, did anything need sorting), plus an
occasional longer sit-down for budgets, reports and planning. Desktop browser or the installed app window; no phone
layout.

## Product Purpose
Mizo Money is a personal finance dashboard that runs entirely on the user's own computer. It reads bank, card,
brokerage and payment-app data through Plaid and turns it into net worth, spending by budget category, upcoming bills
and income, free-to-spend, trips, reports, investments, goals and a long-term forecast. Success: in a minute or two
the user knows where they stand and what needs their attention, and trusts the numbers.

## Positioning
Local and private by construction: no account, no servers, no analytics; each person uses their own Plaid keys and
their data stays in a file on their machine. It explains its numbers (what's estimated, what's partial, why something
was categorized) rather than presenting a polished black box.

## Operating Context
- Started at sign-in and opened from the Start menu/taskbar as an installed app window, or at https://localhost:3000.
- Data arrives from Plaid every 6 hours; the user sorts what Plaid can't know (transfers to unlinked accounts,
  payments with people), adjusts categories and bills, and sets budgets and goals.
- "Hide amounts" blurs every dollar figure for screen sharing.
- Light and dark themes, following the system unless chosen.

## Capabilities and Constraints
- Pages: Dashboard, Accounts, Transactions, Budget, Bills, Money flow, Trips, Reports, Net worth, Investments,
  Forecast, Goals, Settings. Functionality and data behaviour stay as they are; visual work must not change numbers.
- React + Vite UI (`web/`), Express + node:sqlite API; desktop-first, no phone layout (narrow windows collapse the
  sidebar to icons).
- Estimated or incomplete data is always marked; green/red mean in/out or good/bad only.
- Amounts must stay blur-able by "Hide amounts" (the page check fails on readable amounts).
- Plaid only provides some data (e.g. no price history, no 52-week range), so screens show what's known and say so.

## Brand Commitments
- The name is **Mizo Money** (renamed from WealthFlow; internal identifiers still use the old name).
- There is no logo yet; one is needed (the current mark is a generic rising-chart icon).
- Undecided: tagline (the current "Your money. In focus." is not binding).

## Evidence on Hand
- Real screens of every page, rendered from an invented demo household (`npm run demo`), in `docs/screenshots/`.
- No testimonials, users beyond the two above, or public claims; none should be invented.

## Product Principles
1. Glanceable first: the answer to "where do I stand?" comes before the detail behind it.
2. Every number earns trust: estimated, partial or inferred figures are marked and explainable.
3. Private by default: nothing leaves the machine except requests to Plaid and the update check.
4. Quiet until it matters: problems that need the user (a bank to reconnect, something to sort) stand out; the rest
   stays calm.
