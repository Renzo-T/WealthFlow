# Feature check: task briefs

Result of a feature check on Mizo Money (November 2026). The app has enough features; the work is to cut repetition,
fill five real gaps, and make the planner design carry meaning instead of decoration.

Each task is written to be handed to a subagent on its own. Nothing here is implemented yet.

## How to run these

- **Order:** Group A (trim) and Group C (design) are independent of each other. In Group B, every task stands alone.
  The two page merges (Tasks 4 and 5) are approved by the owner. Do Task 6 before Task 5, and Tasks 4 and 5 before
  Tasks 13 and 16.
- **One at a time per file.** Tasks 1, 4, 5, 7 and 13 touch `App.jsx` or `Dashboard.jsx`; tasks 3, 7 and 11-15 append
  to `web/src/styles.css`. Run tasks that share a file one after another, or each in its own worktree and merge.
- **Where CSS goes:** append to the end of `web/src/styles.css` under
  `/* ---------- Feature check: <task name> ---------- */`. Do not edit earlier rules.
- **Do not commit.** Leave changes in the working tree for review.
- **Size:** S = a small model can do it from this brief. M = needs care and tests. L = give it to a stronger model.

## Rules for every task

1. Read `CLAUDE.md`, `PRODUCT.md` and `DESIGN.md` first.
2. Numbers do not change unless the task says so. Estimated or incomplete figures stay marked.
3. Green and red mean money in/out or good/bad only. Vermillion (`--seal`) is the logo only. One typeface.
4. Every dollar figure stays blur-able by Hide amounts (`.amt`, `.tamt`, `.big`, or `<Amt>`).
5. Light and dark both. New colours need a value in `:root` and in both dark blocks.
6. No sideways scrolling at 1280px and 1440px. No phone layout.
7. Keep it generic: no real names, employers or account numbers (use Acme Corp, Alex Rivera, mask 3456).
8. A new endpoint or page action gets a test in `tests/api.test.js`; new logic gets a test that fails without it.
9. Check: `npm test` passes; `npx vite build web --outDir ../../_tmpbuild` succeeds (then delete `_tmpbuild`); with the
   app running, `npm run check:ui` passes and you have looked at light and dark screenshots of the pages you touched.
10. Report: files changed, what you verified, anything you could not verify.

---

# Group A: trim what repeats

## Task 1: A shorter default dashboard (S)

**Files:** `web/src/Dashboard.jsx`, `web/src/layout.js`, `tests/layout.test.js`.

The dashboard shows 16 panels and several repeat the three lead sheets. New default: the three lead panels plus
`insight`, `networth`, `recent`, `cashflow`, `watchlist`, `goals`. Hidden by default (still listed under Customize):
`allocation`, `investments`, `upcoming`, `safe`, `top`, `frequent`, `projection`.

- Add `hidden: true` to those entries in `PANELS`; `defaultLayout()` puts them in `hidden`.
- `mergeLayout()` must not change a layout the user already saved: a saved layout keeps showing what it shows. Only
  people with no saved layout, or who press "Reset to default", get the shorter board.
- A panel that is new to a saved layout and has `hidden: true` starts hidden.

**Done when:** tests cover the default, a saved layout staying untouched, and a new hidden-by-default panel; the
default board is about two screens tall at 1440×900.

## Task 2: Transactions summary keeps only what helps (S)

**File:** `web/src/Transactions.jsx` (the `txsummary` panel, around line 430).

Remove "Largest income", "Average expense", "First" and "Last". Keep the count, total income, total spending, largest
expense and Download CSV. Do not change the API.

**Done when:** the panel is shorter and nothing else on the page moved.

## Task 3: "Needs you" stops holding an empty third (S)

**Files:** `web/src/Glance.jsx`, `web/src/styles.css`.

When `todo` is empty, the Needs you section should not take a full column. Render the "Nothing to sort. You're all
caught up." line as a slim row above the other two sections (class `gcaught`), and let Coming up and Budget share the
sheet's width (Coming up may then show up to 7 items, same height as Budget's four groups). When `todo` has items, the
three-column layout stays exactly as it is.

**Done when:** both states are checked in light and dark; the dashboard `usePacked` layout has no gaps.

## Task 4: Accounts joins Net worth (L, approved)

**Files:** `web/src/App.jsx`, `web/src/NetWorth.jsx`, `web/src/Accounts.jsx`, `web/src/Connect.jsx`,
`web/src/NavIcon.jsx`, `server/` only if a route must return more.

Both pages list every account with its balance. Make one page, "Accounts & net worth" (nav label "Net worth", id
`networth`): the net worth chart and summary on top, then accounts grouped by type as now, with each bank's connection
status, "Connect a bank" and reconnect links brought over from Accounts. Remove `accounts` from `NAV`; `#/accounts`
must redirect to `#/networth` (the top bar chip, Settings and the setup checklist link to it).

**Done when:** everything Accounts could do is reachable on the merged page, old links land there, and
`npm run check:ui` passes with its page list updated.

## Task 5: Forecast joins Goals as "Plan" (L, approved)

**Files:** `web/src/App.jsx`, `web/src/Goals.jsx`, `web/src/Forecast.jsx`, `web/src/NavIcon.jsx`.

One page "Plan" (id `plan`) with two parts: Goals as now, then the forecast below it. `#/goals` and `#/forecast`
redirect to `#/plan`. Do Task 6 first, so the forecast that moves is the improved one.

**Done when:** as Task 4.

---

# Group B: fill the gaps

## Task 6: A forecast you can trust (M)

**Files:** `web/src/projection.js`, `web/src/Forecast.jsx`, `web/src/Projection.jsx`, a new `tests/projection.test.js`.

Today one growth rate is applied to everything and inflation is ignored, so 30-year figures read far too large.

- Add an **Inflation (%)** assumption, default 3, saved with the others. Add a **Today's dollars / Future dollars**
  toggle, default today's dollars: each value is divided by `(1 + inflation/100) ** year`.
- Add an optional **Target** amount. When set, draw it as a horizontal rule on the chart and add a table column
  "Reaches target" with the year each scenario crosses it, or "not within N years".
- Scenario colours come from `SERIES` in `web/src/format.js` (theme variables), not the hard-coded hex in
  `SCENARIOS`; optimistic must not be green.
- Replace the footnote with what is now true (taxes still ignored; which dollars the figures are in).
- `project()` and the new deflation and target-crossing helpers get unit tests.

**Done when:** tests pass, the default view is in today's dollars and says so beside the figures, and the dashboard's
Net worth projection panel still renders.

## Task 7: Find anything from the keyboard (M)

**Files:** a new `web/src/Jump.jsx`, `web/src/App.jsx`, `web/src/styles.css`.

- `Ctrl+K` or `/` (when focus is not in a field) opens a small centred dialog: a text box and a list.
- Empty: the pages from `NAV`. Typing filters pages and, after 2 characters, searches transactions through the existing
  `GET /api/transactions?search=…&limit=6` (check the real parameter name in `server/routes/data.js`).
- Enter on a page goes there; on a transaction goes to `#/transactions?search=<text>` (use whatever query the
  Transactions page already reads from the hash; add one only if none exists).
- Arrow keys move, Escape closes, focus returns to where it was. Use `<dialog>` with `showModal()`; visible focus;
  amounts in the results carry `.amt`.
- `g` then a letter is not needed. Keep it to this one dialog.

**Done when:** it works by keyboard alone in light and dark, and `check:ui` still passes.

## Task 8: Tell me when it matters (L)

**Files:** a new `server/notify.js`, `server/sync.js` (one call after `classify()`), `server/routes/system.js`,
`web/src/Settings.jsx`, a new `tests/notify.test.js`, `tests/api.test.js`.

The app starts at sign-in and syncs every 6 hours, but can only speak when its window is open.

- `notices(now)` is a pure function over the database returning at most three notices: a bank that needs signing in
  again; a bill of $200 or more due tomorrow (threshold in meta `notify_bill_min`); free to spend below zero.
- Each notice has a stable key; a key already sent (table `notified`, key + date) is never sent twice.
- Delivery is a thin, separate function: Windows only (like `server/startup.js`), a toast through PowerShell with no
  compiled add-ons and no new dependency. If that cannot be done reliably, stop and report options instead of adding a
  package.
- **Notice text never contains a dollar amount or account number** (it shows on a lock screen): "A large bill is due
  tomorrow", not the figure.
- Off by default. Settings › App gets "Tell me when something needs me" with the three kinds as checkboxes
  (`GET/PUT /api/settings/notify`). Never runs in tests (`WEALTHFLOW_DB=':memory:'`).

**Done when:** `notices()` is tested for each kind and for not repeating; the setting round-trips through the API;
delivery was tried by hand on Windows and the report says what happened.

## Task 9: Card debt and what it costs (M)

**Files:** `server/sync.js`, `server/db.js`, `server/summary.js` or a new `server/debt.js`, `server/routes/data.js`,
`web/src/NetWorth.jsx`, tests.

Card statements are already fetched from Plaid Liabilities, but interest is not kept. Plaid's credit liability has
`aprs` (type, percentage, balance subject to it); confirm the shape in Plaid's documentation before coding.

- Store the purchase APR per card (new columns via the `PRAGMA table_info` pattern in `db.js`).
- On the Net worth page's Credit cards section, for a card carrying a balance past its statement due date, show the
  APR and "about $X a month in interest" (balance × APR / 12), marked `est`. A card paid in full shows nothing extra.
- No payoff planner. This is one honest line per card.

**Done when:** a sync test stores the APR from a stubbed response, an API test returns it, and banks that send no
APR show no line (not "0%").

## Task 10: Close the month (L)

**Files:** a new `web/src/CloseMonth.jsx`, `web/src/Budget.jsx` (entry point), `server/routes/plan.js`, tests.

The longer sit-down has no path. From the 1st to the 10th, the Budget page for last month shows "Close out
<month>". It opens a four-step sheet using endpoints that already exist:

1. **Sort:** what is still in the sorting queues (`/api/todo`), with links. Zero items ticks the step.
2. **How it went:** budget against actual by group for that month, over-budget groups first.
3. **Carry on or change:** for each group over or under by more than 15%, offer "Keep" or "Set next month to <the
   3-month average>" (uses the existing budget save).
4. **Done:** records `closed_month` in meta (`POST /api/budget/close`), after which the prompt disappears.

Steps are a checklist in the planner style (ruled rows, `Check` icon), not a modal wizard: one sheet, all four
visible, done ones ticked.

**Done when:** the API test covers closing and the prompt going away; skipping it changes nothing.

---

# Group C: design that means something

## Task 11: The highlighter marks what needs you (S)

**Files:** `web/src/styles.css`, `web/src/Glance.jsx`, `DESIGN.md`.

The yellow marker swipe sits under every page title, so it means nothing. Remove it from `.top h1` (the rule near
line 1098; keep the double rule under the header). Use `--hi` in exactly two places: behind the "Needs you" heading
when there is something to sort, and behind the top bar's "N banks need attention" chip. Update the `--hi` line in
DESIGN.md to say "attention only".

**Done when:** a dashboard with nothing to sort has no yellow on it; one with items has one swipe.

## Task 12: Ink and pencil (M)

**Files:** `web/src/ui.jsx`, `web/src/styles.css`, then each place that marks an estimate (`grep -n "est" web/src`):
`Glance.jsx`, `BillsCalendar.jsx`, `Upcoming.jsx`, `Bills.jsx`, `Budget.jsx` suggestions, `Reports.jsx` partial
months, `Investments.jsx`, `NetWorth.jsx`.

Make "known versus estimated" one visual rule. Add `<Est>` to `ui.jsx`: wraps a figure, renders it in `--muted` with
a dashed underline and a `title` saying why (prop `why`). Replace the scattered `<sup className="est">est</sup>`,
italics and faded cells with it. Charts already dash estimated lines; leave them. Add the rule to DESIGN.md.

**Done when:** every estimated figure on every page uses `<Est>`, none lost its marking, and Hide amounts still blurs
them.

## Task 13: Planner tabs in the rail (S)

**Files:** `web/src/App.jsx`, `web/src/styles.css`.

Run after Tasks 4 and 5. Group `NAV` under four small rail headings (class `navgroup`, uppercase, `--rail-ink` at
reduced opacity), with Dashboard alone above them: **Spending** (Transactions, Budget, Bills) · **Looking back**
(Money flow, Reports, Trips) · **What you own** (Net worth, Investments) · **Plan** (Plan). With one page under it,
"Plan" needs no heading: show the Plan item after a divider. Settings sits alone at the bottom of the rail. The
headings hide when the rail collapses to icons (the rule near line 238), where a thin divider takes their place.

**Done when:** all 11 items fit without the rail scrolling at 1440×900 and 1280×720.

## Task 14: The month strip on Bills and Budget (M)

**Files:** `web/src/MonthSpread.jsx`, `web/src/Bills.jsx`, `web/src/Budget.jsx`, `web/src/styles.css`.

The dashboard's month strip (days across, ink dots for spending, stamps for bills) is the app's signature and appears
once. Give `MonthSpread` a `compact` prop (no legend, no footer line, about 70px tall) and a `month` prop, and put it
under the page header on Bills (current month) and Budget (the month being viewed, following its arrows). On Bills it
replaces nothing; `BillsCalendar` stays.

**Done when:** the strip follows Budget's month arrows, and both pages pass `check:ui`.

## Task 15: Net worth trace clears the figure (S)

**Files:** `web/src/styles.css` (`.stand.lead > .herotrace`, near line 1104), `web/src/Cards.jsx` only if needed.

The 30-day trace runs behind the net worth figure and the "vs. 30 days ago" line. Keep it to the right 45% of the cell
and fade its left edge with a `mask-image` gradient so it never sits under text, at 1280px and 1440px.

**Done when:** light and dark screenshots show no line crossing any text in the cell.

## Task 16: Housekeeping (S)

**Files:** `PRODUCT.md`.

"There is no logo yet" is out of date: the seal is the logo. Rewrite that line under Brand Commitments. After Tasks
4 and 5, update the page list under Capabilities and Constraints (Accounts is part of Net worth; Goals and Forecast
are one page, Plan), and the same list in `CLAUDE.md` or `README.md` wherever pages are named.

---

# Models, effort and prompts

Recommendations, not rules: if a task comes back wrong twice, move it up one model rather than re-prompting.

| Task | Model | Effort | Why |
|---|---|---|---|
| 1 Shorter default dashboard | Sonnet | medium | Small, but saved layouts must not change: needs careful tests |
| 2 Transactions summary | Haiku | low | Delete four lines |
| 3 Empty "Needs you" | Sonnet | low | Two layout states to check by eye |
| 4 Accounts joins Net worth | Opus | high | Moves features between pages; easy to lose one |
| 5 Forecast joins Goals | Sonnet | high | Mostly moving; redirects and page checks |
| 6 Forecast you can trust | Sonnet | high | Money maths with unit tests |
| 7 Keyboard search | Sonnet | medium | One self-contained component |
| 8 Notifications | Opus | high | New table, privacy rule, Windows delivery that may not be possible |
| 9 Card interest | Sonnet | high | Must read Plaid's documentation first |
| 10 Close the month | Opus | high | New flow across budget, sorting and settings |
| 11 Highlighter | Haiku | low | One rule removed, two added |
| 12 Ink and pencil | Sonnet | medium | Many files, same small change; must miss none |
| 13 Planner tabs | Haiku | medium | Markup and CSS |
| 14 Month strip | Sonnet | medium | Reuses a component in two pages |
| 15 Hero trace | Haiku | low | CSS only |
| 16 Housekeeping | Haiku | low | Text edits |

## The prompt every task starts with

Paste this, with the task number filled in, then add the task's own lines from below.

```text
You are working in the Mizo Money repository. Read CLAUDE.md, then docs/feature-check-tasks.md.
Do Task <N> from that file and nothing else. Follow "Rules for every task" in the same file.
Do not commit, do not push, and do not touch files the task does not name unless you must; if you must, say why.
If the brief is wrong about the code (a file, line or name that is not there), follow the code and tell me.
Finish with: files changed, checks you ran with their results, and anything you could not verify.
```

## What to add for each task

**Task 1**
```text
Before changing anything, read tests/layout.test.js and web/src/layout.js. The risk is changing a layout someone
already saved: write the test for "a saved layout is untouched" first and watch it pass before and after.
```

**Task 2**
```text
Only the txsummary panel in web/src/Transactions.jsx. Leave the API and every other part of the page alone.
```

**Task 3**
```text
Check both states by eye: the demo data (npm run demo -- <new folder>) has nothing to sort; to see the other state,
pass a made-up todo item in the browser only, and do not leave test data in the code.
```

**Task 4**
```text
Start by listing everything the Accounts page lets a person do (read web/src/Accounts.jsx, Connect.jsx and
AccountOptions.jsx) and show me that list in your report with where each one now lives. Search the whole repo for
"#/accounts" and "accounts" page ids (App.jsx, Settings.jsx, the setup steps on the server, scripts/ that list pages
for check:ui) and update each. Old #/accounts links must land on #/networth.
```
Follow-up if something is missing:
```text
On the merged page I can no longer <do X>. Restore it without bringing the Accounts page back.
```

**Task 5**
```text
Task 6 is already done; move the forecast as it is now. Search the repo for "#/goals" and "#/forecast" and for the
page lists used by check:ui and the setup steps, and update each. Both old links must land on #/plan.
```

**Task 6**
```text
Write tests/projection.test.js first, with hand-worked numbers: for example 100,000 at 7% for 10 years with no
contribution, in future dollars and in today's dollars at 3% inflation, and the year a target is crossed.
web/src/projection.js imports React's useState; keep the maths in functions the test can import without a browser
(split the file if you need to).
```

**Task 7**
```text
Find the transaction search parameter in server/routes/data.js and how web/src/Transactions.jsx reads filters from
the address before writing any code, and tell me what you found. Do not add a library. Test with the keyboard only.
```

**Task 8**
```text
Work in two parts and report after the first. Part 1: notices(), the "notified" table, the setting and its API, all
tested; no delivery yet. Part 2: delivery on Windows without a new dependency. If you cannot make a toast appear
reliably from the background process, stop and give me the options with their trade-offs instead of adding a package.
Notice text must never contain an amount, a balance or an account number.
```
Follow-up after Part 1:
```text
Part 1 looks right. Go on to Part 2.
```

**Task 9**
```text
First read Plaid's Liabilities documentation for the credit "aprs" field and quote the shape you will rely on. Then
look at how server/sync.js stores statements now and how tests/sync.test.js stubs Plaid. A bank that sends no APR
must show nothing, never "0%". The interest figure is an estimate and must be marked as one.
```

**Task 10**
```text
Before building, write me a half-page plan: which existing endpoints each of the four steps uses, the one new
endpoint, and where "closed" is stored. Wait for my reply. The sheet is a checklist on one page, not a pop-up wizard.
```
Follow-up:
```text
Plan approved. Build it.
```

**Task 11**
```text
CSS and one class in Glance.jsx. Show me light and dark screenshots of a dashboard with nothing to sort (no yellow
anywhere) and with something to sort (one swipe).
```

**Task 12**
```text
First list every place an estimate is marked today (search web/src for "est", "estimate", "partial", "≈") and show
me the list. Then add <Est> and convert them one file at a time. Do not change which figures count as estimated.
```

**Task 13**
```text
Tasks 4 and 5 are done, so the menu has 11 items. Check the collapsed (icons only) rail as well as the full one.
```

**Task 14**
```text
Read web/src/MonthSpread.jsx and server/spread.js first. The compact strip must use the same data and the same dot
scale as the dashboard's. On Budget it follows the month arrows.
```

**Task 15**
```text
CSS only if you can. Take screenshots at 1280 and 1440 wide in light and dark and confirm no line crosses any text.
```

**Task 16**
```text
Text only. Do not change anything in PRODUCT.md beyond the two lines the task names.
```

---

# Group D: the words (Step 3 of the five-step prompt)

Step 3 is written for a shop's marketing page. Its rules apply to the app; its content list does not. There are no
services, prices, reviews, booking line or address here, and none may be invented (PRODUCT.md: no testimonials or
public claims). An audit found the wording already free of em dashes in sentences, hype words and exclamation marks.
What is missing is a written voice, and the page subtitles run long.

## Task 17: Write the voice down (S)

**Files:** `DESIGN.md` (new "Voice and wording" section), `PRODUCT.md` (tagline line under Brand Commitments).

Record the voice the app already uses, so later tasks have rules to follow:

- Plain, dry, a little understated. It talks to "you" and calls itself "Mizo Money", never "we".
- Sentence case everywhere. No em dashes in sentences (a lone "—" for "no value" in a table cell is a data mark and
  stays). No exclamation marks. Real minus sign for negative amounts.
- Say what is true and checkable: "Updated 2 min ago", "3 months of history", never "smart", "powerful", "seamless",
  "insights", "journey", "experience".
- A subtitle never restates its title. An empty state says what will appear and the one thing to do.
- Estimates are named as estimates, with the reason on hover.
- Tagline: replace "Your money. In focus." with the line already used in `web/index.html`: "Your personal finance
  dashboard, running on this computer." Mark it decided.

**Done when:** DESIGN.md has the section with one good and one bad example per rule, taken from the app's real text.

## Task 18: One-line page subtitles (S)

**Files:** every `PageHeader` in `web/src/*.jsx`; `tests/` or `scripts/check-ui.mjs` only if they match on this text.

Do Task 17 first. Each page subtitle becomes one sentence of at most 14 words that tells you something the title does
not. How-to hints ("Click a row for details", "Hover a band for the amount") move out of the subtitle: drop them if
the control is obvious, otherwise put them beside the control as a `small muted` line. Starting points, to improve on:

| Page | Now (shortened) | Aim |
|---|---|---|
| Transactions | "Search, filter, and fix categories. Transfers between… Click a row…" | "Transfers between your own accounts show as one row." |
| Budget | "Plan each month by category. Amounts apply to every month unless…" | "Amounts repeat every month unless you set one for a single month." |
| Bills | "Recurring bills, autopays and income: found in… Your edits always win." | "Found in your transactions, statements and Plaid. Your edits always win." |
| Money flow | two long sentences per view | "Where money came from and where it went. Your own transfers are left out." |
| Trips | "What you spent away from home… left out of month-to-month comparisons." | "Spending away from home, left out of month-to-month comparisons." |
| Reports | "Spending month by month, what you pay for on repeat, and how the year went." | keep |
| Investments | "Holdings across your linked brokerage, retirement and HSA accounts." | "What you hold, across brokerage, retirement and HSA accounts." |
| Accounts & net worth | three clauses and a how-to | "Every account by type, plus anything Plaid can't see, like a house or a loan." |
| Plan | two sentences | "Savings goals, and where your net worth is heading." |
| Settings | "Connections and backups for this copy of Mizo Money." | keep |

No facts change: every aim line must still be true of what the page does. If one is not, write a true one.

**Done when:** no subtitle wraps to a second line at 1280px wide, and `npm run check:ui` passes.

## Task 19: Empty states and notes read in one voice (M)

**Files:** every `EmptyState`, `.note`, `.explain`, `foot` paragraph and `title=` tooltip sentence in `web/src/*.jsx`.

Do Task 17 first. Read every one against the voice rules and fix only what breaks them. List the ones you changed,
before and after, in your report. Do not shorten explanations of how a number was worked out: those are the product
("every number earns trust"). Do not touch labels, category names or anything the server returns.

**Done when:** the report shows each change, and Hide amounts still blurs any amounts inside changed text.

## Models and prompts for Group D

| Task | Model | Effort |
|---|---|---|
| 17 Voice written down | Sonnet | medium |
| 18 Page subtitles | Haiku | medium |
| 19 Empty states and notes | Sonnet | medium |

Start each with "The prompt every task starts with" above, then add:

**Task 17**
```text
Collect 20 real lines from web/src (subtitles, empty states, notes, tooltips) before writing, and build the rules
from what the app already does well. Quote real lines as the examples. Do not change any code.
```

**Task 18**
```text
Read the "Voice and wording" section of DESIGN.md first. Check each new subtitle against what the page really does;
if my suggested line is not true, write a true one and tell me. Show me a before and after table.
```

**Task 19**
```text
Read the "Voice and wording" section of DESIGN.md first. Change as little as possible: most lines are already right.
Never remove an explanation of where a number comes from. Show me a before and after list.
```
