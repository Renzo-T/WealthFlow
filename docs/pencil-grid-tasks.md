# Pencil borders, month calendar, dot-grid snapping: plan

Goal: every panel in the app becomes a pencil-grey border on the page's paper (with a faint wash of the sheet colour
behind it) instead of a white sheet with a shadow; the month becomes a Sunday-to-Saturday calendar; and every box edge,
section rule, list row and calendar line falls on the page's 22px dot grid. Desktop only: this app is never used on a
phone.

Reference mock (invented figures, Indigo journal): `docs/mocks/pencil-grid.html` (open it in a browser; its script
holds a working version of the snapping). Published copy: https://claude.ai/artifact/KNQWXjX8tfkcsP8bPwVZkG

## Context: what's already in the working tree (uncommitted)

The five journals (`web/src/journals.js`, `journal.js`, Settings › Journal), net worth written on the paper with a
highlighted label (`LOOSE` in `Dashboard.jsx`, `.standing` rules near "Where you stand: figures written on the
paper" in `styles.css`), and the rail that folds to icons (`.shell.slim`, App.jsx). Build on top of them; don't undo
them. Don't commit unless the user asks (then branch first if on main, and let the pre-commit `npm run verify` run).

## Rules for every task

1. Read `CLAUDE.md` and `DESIGN.md` first. Data, copy and numbers don't change; this is layout and look only.
2. Theme tokens only: any new colour needs a light value on `:root` and a dark value in both dark blocks (and, if it
   differs per journal, in `web/src/journals.js`). Check every journal in light and dark (`?journal=plum` previews one
   without saving it: put it before the `#`).
3. Keep it generic: no real names or amounts in code, tests, docs or screenshots you share.
4. Append new CSS under its own comment heading at the end of `styles.css`; delete earlier rules you replace rather
   than stacking overrides when the old rule is clearly superseded.
5. Verify as CLAUDE.md says (tests, `npx vite build web --outDir ../../_tmpbuild` then delete it, `npm run check:ui`
   with the app running, headless screenshots light + dark). `npm run build` updates the running app (app mode serves
   `web/dist`).

## Task 1: Panels become pencil borders

- Every sheet (`.card`, `.ledger`, `.cards.ruled`, `.insight`, `.bstrip`, `.explain`, Budget's left-to-budget card, goal /
  trip / watchlist cards, Settings sections) loses its white fill, its `--paper-shadow` and its hover lift. New look:
  `background: color-mix(in srgb, var(--card) 35%, transparent)`, `border: 1px solid var(--line-strong)`, a small
  radius (3px in the mock). Put the fill in one token (e.g. `--sheet`) so it's tuned in one place.
- Rules inside panels (section rules, list row rules, table rules, the month's day lines) move from `--line` to
  `--line-strong` so they still read on the paper; `--line` alone is too faint once the dots show through.
- Stay solid (opaque `--card`, keep their shadow): dialogs (`.dlg`), hover tips (`.hovtip`), menus/popovers, the
  toast, the bulk-select bar, the first-run screen's panels. Sticky table heads (`.sticky-head .t thead th`) need an
  opaque background that looks like the panel: `color-mix(in srgb, var(--card) 35%, var(--bg))`.
- Remove the arrival animation (`settle`) from sheets: a box that moves can't be measured for snapping (Task 3).
- Drop the washi tape on page titles (`.main .top h1::before`, in the "Journals: decoration" section). It's one rule
  for every page. Keep the tape on the month name and on goal/trip cards, and the doodle after the title.
- `.standing` (where you stand) stays loose on the paper with no border.
- Done when: no top-level white sheets or paper shadows remain on any page in any journal, light and dark; tooltips and
  dialogs are still solid; check:ui passes.

## Task 2: The month as a calendar

- `MonthSpread.jsx` renders a 7-column calendar: a header row (Sun…Sat), then a row per week; days before the 1st
  and after the last day are hatched blanks. Each day cell is 3×3 grid units (66px square): the day number top-left,
  the spending dot centred (same `SIZES` scale, max 30px fits), the out/in stamps (`Stamp`, small) in the bottom-right
  corner, today with the soft fill and a 2px accent line on top, future days with lighter numbers. Hover tips and
  `onPick` (Bills: click a day, `aria-pressed`) keep working; keep the legend and the month arrows.
  Keep `export const SIZES` (Reports imports it). `dots={false}` (Bills) stays stamps-only.
- Dashboard: merge the `month` and `glance` lead panels into one panel, "This month" (keep id `month`):
  - left: the calendar (its section is 7×3 + 2 = 23 units wide);
  - right: Needs you (when there is something; the highlighter swipe stays) above Coming up;
  - below, full width: Budget (the rows in two columns);
  - Glance's budget note ("Budgeted groups only…") stays with Budget.
  Keep `insight` (What changed) as its own lead panel under it. Below 1100px wide the right column drops under the
  calendar.
- Saved layouts: `mergeLayout` already drops unknown ids, but add an explicit rename so `glance` folds into `month`:
  the merged panel is hidden only if both were hidden, and keeps the earlier of the two positions. Add the cases to
  `tests/layout.test.js` (fails without the change). Update the panel's name in Customize.
- Bills page: the same calendar, beside or above its day list as fits; clicking a day still lists that day's bills.
- Remove the old one-row spread CSS (`.sdays`, `.sday` column rules, `.sday.weekend`) once nothing uses it, and the
  dashboard skeleton's spread placeholder if it draws the old strip.
- Done when: dashboard and Bills show the calendar with real stamps and dots, hover tips and month arrows work, Bills
  day picking works, layout tests pass.

## Task 3: Snap to the dot grid

Unit `U = 22px` (`--u`). The page's ruling is the grid.

- **Origin.** Each journal's ruling (`RULING` in `journals.js`) must put its marks at exact multiples of U from the
  `.main` padding box's corner: dots at `-11px -11px` offset (now they sit at 11 + 22k), square grid already at 22k,
  ruled lines at 21px → move to 22k. `.main` padding becomes whole units (2U left/top; right takes the remainder).
  Remove the old non-unit `.main` paddings (1.5rem 2.5rem etc., and the 1099px/860px variants).
- **Widths (CSS).** The content box's width is rounded down to whole units:
  `width: round(down, 100%, var(--u))` (Chromium supports `round()`; the app runs in Chrome/Edge). Column splits use
  whole units with the last column taking the rest, so every edge lands on a column of dots, e.g. two columns:
  `round(down, calc((100% - var(--u)) / 2), var(--u)) minmax(0, 1fr)` with `gap: var(--u)`; main + side column:
  `minmax(0, 1fr) calc(14 * var(--u))`. Gaps between boxes are U. Apply to: the dashboard board (3 columns, and the
  wide layout's side column), `.grid2`, `.nwtop`, `.budgetgrid`, `.goalsgrid`, ruled strips of figures, the ledger halves,
  and each page's main + side layouts.
- **Heights (JS).** One hook in `App.jsx` (or `web/src/grid.js`, used by App) rounds box heights up to whole units:
  - What it snaps: every panel (Task 1's set), every direct section of a `.ledger`, and every top-level block of the
    page (direct children of the page's content wrapper: headers, notes, alerts, tab bars too), so the next box starts
    on a dot row. Vertical gaps between blocks become U (replace `.mt` 1rem / `.mt-lg` with U and 2U).
  - How: in one `requestAnimationFrame` pass, clear each element's `min-height`, read its natural height, set
    `min-height` to `ceil(h / U) * U`, innermost elements first. Remember the last natural height per element and skip
    unchanged ones, so a `ResizeObserver` (on `.main` and on the snapped elements) doesn't loop. A `MutationObserver`
    on the page content re-runs it when pages or data change (batch to one pass per frame).
  - Rules drawn as borders add pixels: use `box-sizing: border-box` on snapped boxes, or draw rules as inset
    box-shadows (the mock does this), so a section's rule never pushes the next one off the grid.
- **Dashboard packing.** `usePacked` (Dashboard.jsx) moves from 8px rows / 16px gaps to U rows with no row gap: a
  cell spans `ceil(h / U) + 1` rows and its panel fills all but the last row, so there is one empty row of dots
  between panels. Keep the "neighbours end on the same line" pass.
- **Rows inside panels.** List and table rows are 2U (44px) tall with their rule on the row's top edge: Coming up,
  Needs you, Recent transactions, Budget rows (dashboard and Budget page), watchlist rows, the Transactions and Bills
  tables (header row 2U too). Panel heads are 1U tall with 1U below them; section padding is U.
- **Charts** inside panels: height in whole units; gridlines needn't be on dots.
- **Narrow windows.** Support down to the width where the rail is icons only (about 1000px). Remove phone-only rules
  you touch rather than adapting them.
- Done when: the alignment check (Task 4) passes on every page at 1280 and 1440 wide, light and dark, and pages still
  reflow correctly when data loads (no gaps left over, no overlap, no jitter while hovering).

## Task 4: Checks and docs

- `scripts/check-ui.mjs`: add an alignment check. On each page after it settles, for every snapped element (same
  selectors as Task 3) compare its left/top/right/bottom with `.main`'s padding-box corner: each must be within 1px of
  a multiple of 22. Report the first few offenders per page (selector, edge, offset). Fail the run if any.
- `tests/layout.test.js`: the `glance` → `month` cases (Task 2).
- DESIGN.md: panels are pencil borders on the paper with a faint wash, not sheets with shadows (update the Paper /
  elevation section, The One Sheet Rule, components); a new "Grid unit" section (22px, origin, widths, heights, rows
  2U); the month calendar replaces the month spread description; the title tape is gone from the decoration list.
  Refresh `.impeccable/design.json` to match. CLAUDE.md: the Dashboard bullet (merged "This month" panel, calendar)
  and a line on the grid unit and the snapping hook.

## Review notes (risks found while checking this plan against the code)

- `mergeLayout` (`web/src/layout.js`) silently drops unknown ids, so without an explicit rename someone who hid
  "Needs you, coming up, budget" but kept "Month spread" would get the merged panel visible, and vice versa. Hence
  the rename rule in Task 2.
- Hover tips are `position: fixed`, so panels can clip their content (`overflow: clip` on `.ledger` stays fine).
- The sticky table head currently uses `var(--card)`; with see-through panels it would look like a different surface
  unless it uses the mixed colour in Task 1.
- Snapping adds up to 21px of empty space at the bottom of a box. Accept it; don't shrink content to avoid it.
- Night dots are very faint in some journals (e.g. Indigo dark `dot: #191e23`); the grid still works but is barely
  visible. Don't change dot colours in this work unless the user asks.
- Panels that animate their height (expanding rows, "show more") will re-snap after the change; make sure the
  observer doesn't fight a CSS transition (snap on `transitionend` or skip elements mid-transition).
- Reports imports `SIZES` from MonthSpread.jsx; keep that export.
- The first-run screen (`PlaidSetup.jsx`) and the offline page (`web/public/sw.js`) are outside `.main`; leave them.

## Order

Task 1 → Task 2 → Task 3 → Task 4, one at a time (they all touch `styles.css`). After each task: tests, build, a
screenshot pass in light and dark; after Task 3, the full check:ui including the new alignment check.
