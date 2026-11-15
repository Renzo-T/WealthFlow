# Richer planner: task briefs

Goal: Mizo Money keeps its "Planner Page" identity (DESIGN.md) but gains colour, depth and texture, motion, and
showpiece charts and figures. Chosen direction: **richer planner** (not a new visual world, not polish only).

Each task below is written to be handed to a subagent on its own. Nothing here is implemented yet.

## How to run these

- **Order:** Task 1 first (it adds the tokens the others use). Tasks 2-9 are independent of each other but all append
  to `web/src/styles.css`, so run them **one at a time** in the same checkout (or each in its own worktree and merge).
  Task 10 last.
- **Where CSS goes:** append to the end of `web/src/styles.css`, each task under its own comment heading
  (`/* ---------- Richer planner: <task name> ---------- */`). Later rules win, so do not edit or delete earlier rules.
- **Do not commit.** Leave changes in the working tree for review.

## Rules for every task

1. Read `CLAUDE.md` and `DESIGN.md` first. Function, data, copy and numbers do not change; this is visual only.
2. Green and red mean money in/out or good/bad only. Vermillion (`--seal`) is the logo only.
3. One typeface (Atkinson Hyperlegible Next). No new fonts, no gradient text, no emoji or text glyphs as icons.
4. Every dollar figure must stay blur-able by Hide amounts (keep `.amt`, `.tamt`, `.big` classes on figures).
5. Light and dark both: any new colour needs a value in `:root`, in
   `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and in `:root[data-theme="dark"]`.
6. Motion plays once on arrival, uses `cubic-bezier(.16, 1, .3, 1)` (`var(--ease)` after Task 1), and never loops.
   The existing `prefers-reduced-motion` rule in styles.css already shortens every animation; do not remove it.
7. No sideways page scrolling at 1280px and 1440px wide. No phone layout.
8. No real names, employers or account numbers anywhere.
9. Check your work: `npx vite build web --outDir ../../_tmpbuild` must succeed (then delete `_tmpbuild`), and
   `npm test` must pass. If the app is running (`https://localhost:3000`), take headless Edge screenshots of the pages
   you touched in light and dark (commands in CLAUDE.md) and look at them before reporting.
10. Report: files changed, what you verified, anything you could not verify.

---

## Task 1: Tokens (foundation)

**File:** `web/src/styles.css` only.

Append a new layer that redefines and adds tokens. Light values go in `:root`; repeat the dark values in both dark
blocks (see rule 5).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f2f0e9` | `#11141c` (unchanged) | warmer page paper |
| `--card` | `#fffefc` | `#181c27` (unchanged) | warm white sheets |
| `--dot` | `#cdcec3` | `#232937` | dot grid, slightly stronger |
| `--surface-2` | `#f8f6f0` | `#1d2230` (unchanged) | tinted rows |
| `--hi` | `#ffe27a` | `#5a4c12` | highlighter, page titles only |
| `--paper-shadow` | `0 1px 0 rgba(27,32,48,.03), 0 1px 2px rgba(27,32,48,.06), 0 12px 28px -16px rgba(27,32,48,.28)` | `0 1px 0 rgba(255,255,255,.03) inset, 0 1px 2px rgba(0,0,0,.4), 0 14px 30px -16px rgba(0,0,0,.75)` | sheets resting on the page |
| `--paper-shadow-up` | `0 1px 0 rgba(27,32,48,.03), 0 2px 4px rgba(27,32,48,.07), 0 20px 36px -16px rgba(27,32,48,.34)` | `0 1px 0 rgba(255,255,255,.04) inset, 0 2px 4px rgba(0,0,0,.45), 0 22px 38px -16px rgba(0,0,0,.85)` | a sheet lifted on hover |
| `--cloth` | `repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)` | same | woven texture laid over indigo |
| `--grain` | an inline SVG `feTurbulence` noise (`baseFrequency .85`, 2 octaves, `stitchTiles`), 180px tile, dark warm specks at about 9% alpha | same noise, pale blue specks at about 5% alpha | paper grain |
| `--ease` | `cubic-bezier(.16, 1, .3, 1)` | same | all motion |

`--grain` is a `url("data:image/svg+xml,...")` value; percent-encode `<`, `>`, `#` and `%`.

**Done when:** the build passes and the app looks the same except slightly warmer paper (nothing uses the new tokens
yet).

---

## Task 2: The cover rail and the seal

**File:** `web/src/styles.css` only. Selectors: `.side`, `.side .nav`, `.navicon`, `.seal`, `.wordmark`, `.logo`.

- **Cloth:** `.side` background becomes `var(--cloth)` over a top-to-bottom gradient: a mix of `--rail-2` and `--rail`
  at the top, `--rail` by 38%, `--rail` mixed 18% with black at the bottom.
- **Depth:** the rail casts a shadow onto the page (`box-shadow: 6px 0 22px -8px rgba(12,17,34,.55)`, `z-index: 4`).
- **Stitched edge:** `.side::after`, absolutely positioned full height, 5px from the right edge,
  `border-right: 1.5px dashed rgba(255,255,255,.17)`, `pointer-events: none`. Must still look right at the 64px rail
  (window narrower than 1100px) and must not cover the nav buttons.
- **Active item:** a soft fold: gradient from `--rail-2` mixed 14% with white down to `--rail-2`, plus
  `inset 0 1px 0 rgba(255,255,255,.14), 0 1px 3px rgba(0,0,0,.3)`.
- **Hover:** the icon slides 2px right (`.25s var(--ease)`).
- **Seal:** small drop shadow, resting rotation `-7deg`; on `.logo:hover` it straightens and scales to 1.06 (`.5s`).
  Use the `rotate` and `scale` properties, not `transform`.

**Done when:** rail checked at 1440px and 1000px wide in light and dark; white focus outline on nav items still shows.

---

## Task 3: Paper and sheets (depth and texture)

**File:** `web/src/styles.css` only.

- `.main` background: `var(--grain)` on top of the existing 22px dot grid on `var(--bg)`.
- Sheets get the paper shadow: `.card, .standing, .insight, .bstrip, .explain { box-shadow: var(--paper-shadow); }`.
  A card inside a card gets no shadow (`.card .card, .card .explain { box-shadow: none; }`).
- Cards you can open lift on hover: `.goalgrid > .card`, `.tripgrid > .card`, `.watch`: `translateY(-2px)` and
  `var(--paper-shadow-up)`, `.3s var(--ease)`. `.watch` needs `background: var(--card)`.
- Tooltips (`.hovtip`, `.tip`) keep the stronger `var(--shadow)`.
- Buttons: `.btn, .iconbtn` get `0 1px 1px rgba(27,32,48,.05)`. `.btn.primary` becomes pressed cloth:
  `var(--cloth)` over a gradient from `--btn` mixed 16% with white down to `--btn`, with
  `inset 0 1px 0 rgba(255,255,255,.16), 0 1px 2px rgba(15,20,40,.3), 0 6px 14px -8px rgba(15,20,40,.55)`; on hover it
  uses `--btn-hover` and lifts 1px; pressed drops 1px with no shadow.
- Text inputs and selects: `inset 0 1px 2px rgba(27,32,48,.05)`; on focus add a 3px ring of `--blue` at 18%.
  Exclude checkboxes, radios and range inputs, and the in-place editors `.catsel`, `.nick`, `.tripname-in`.

**Done when:** Dashboard, Transactions, Budget, Goals and Settings checked in both themes; sticky table headers on
Transactions and the sticky summary card still stick; no shadow is clipped or doubled.

---

## Task 4: Page header

**File:** `web/src/styles.css` only. Selectors: `h1`, `.top`, `.sub`.

- Title grows to `2.6rem`, tracking `-.028em`.
- **Marker swipe:** `h1 { display: inline; padding: 0 .12em; margin-left: -.12em; box-decoration-break: clone; }`
  with a background `linear-gradient(transparent 60%, var(--hi) 60%, var(--hi) 90%, transparent 90%)`. On arrival the
  swipe draws left to right once (animate `background-size` from `0% 100%` to `100% 100%`, `.9s var(--ease)`).
- **Double rule:** `.top` bottom border 2px ink, plus `.top::after` drawing a 1px ink line at 30% opacity 6px below
  it (`.top` needs `position: relative`); bottom margin `1.5rem`.
- `.sub` top margin `.5rem`.
- Titles outside a page header keep no swipe: `.firstrun h1, .pageerror h1 { display: block; background: none; }`.

**Done when:** checked on Dashboard (the date), Budget (title with long description and month controls on the right)
and Transactions in both themes; a title that wraps to two lines keeps the swipe on both lines; title text contrast
over the highlighter is at least 4.5:1 in both themes.

---

## Task 5: The standing strip (hero)

**Files:** `web/src/Cards.jsx`, `web/src/styles.css`.

Net worth becomes the largest, richest thing on the dashboard: it sits on the cover cloth.

- **CSS**, `.stand.lead`: white text on `var(--cloth)` over
  `linear-gradient(135deg, var(--rail-2) 0%, var(--rail) 62%, <--rail mixed 14% black> 100%)`,
  `inset 0 1px 0 rgba(255,255,255,.1)`. Re-scope the tokens inside it so existing children recolour themselves:
  `--muted: var(--rail-ink); --green: #8fe0b8; --red: #ffa896;`. Label uses `--rail-ink`. Figure `3.7rem`,
  tracking `-.035em`, `text-shadow: 0 2px 0 rgba(0,0,0,.18)` (2.9rem below 1100px). Focus outline white.
  `.standing { overflow: hidden; }`, `.stand.lead + .stand { border-left: 0; }`, padding `1.35rem 1.5rem 1.4rem` on
  every `.stand`, and the other two figures grow to `2.2rem`.
- **Trace (JSX):** in `Cards.jsx` add a small `Trace` component rendered inside `.stand.lead`: the last 31 entries of
  `s.history` (`{ date, value, est }`) as one line in an SVG (`className="herotrace"`, `viewBox="0 0 300 100"`,
  `preserveAspectRatio="none"`, `aria-hidden`, `vector-effect: non-scaling-stroke` on the path). Render nothing with
  fewer than 8 points. The vertical scale must span at least 4% of net worth (same rule as `NetWorthChart.jsx`) so a
  tiny wobble is not exaggerated. If any point in the window is estimated, the line is dashed (the "estimated data is
  always marked" rule).
- **Trace (CSS):** absolutely positioned at the right and bottom of the lead cell, 58% wide and 78% tall, behind the
  text (`z-index: 0`, the cell's other children `position: relative; z-index: 1`), white stroke 2px at 50% opacity,
  `pointer-events: none`, drawn in left to right once with a `clip-path: inset(0 100% 0 0)` to `inset(0)` animation
  (1.4s).
- Also on Budget: `.leftcard` gets `var(--paper-shadow)` and its figure grows to `2.6rem`.

Keep the existing `Counter`, `Since`, `Delta` and hover tips exactly as they are.

**Done when:** the green/red delta text on the indigo cell has at least 4.5:1 contrast; Hide amounts still blurs all
three figures; hover tips still open; checked in both themes at 1440px and 1000px.

---

## Task 6: Month spread ink and stamps

**File:** `web/src/styles.css` only. Selectors under `.sdays`, `.sday`, `.sink`, `.stamp`.

- **Wet ink:** past-day dots (`.sink i:not(.fut)`) get a soft highlight:
  `radial-gradient(circle at 34% 28%, <--ink-dot mixed 28% white> 0%, var(--ink-dot) 58%)` and a 1px/2px shadow of
  `--ink-dot` at 35%. Dot sizes (the fixed ramp) must not change.
- **Hand-pressed stamps:** stamps in day columns rest slightly rotated (`rotate: -5deg`; every 3rd column `4deg`;
  every `4n+1` column `-2deg`). Use the `rotate` property so the existing `stamp` entrance animation (which animates
  `transform`) still works. Legend stamps stay straight.
- **Hover a day:** its dot and stamps scale to 1.12 and stamps straighten (`.3s var(--ease)`).
- Paid stamps get `0 1px 0` of `--blue` at 25%.

**Done when:** the dashboard spread checked in both themes; the existing ink-in entrance still plays; the hover card on
a day still opens.

---

## Task 7: Category colour and meters

**Files:** `web/src/CategoryIcon.jsx`, `web/src/styles.css`.

- **Icons take their group's hue.** In `CategoryIcon.jsx` the `ink()` helper currently forces every icon to indigo
  except income. Change it so the icon uses the colour already listed for its group in `GROUP` (the four chart hues
  `--s1..--s4`, grey for neutral groups, green only for Income and Savings). Raise the well tint from 12 to 15 and
  update the comment above `ink`. Do not add new hues and do not use red.
- **CSS:** `.caticon` gets `box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 16%, transparent)`.
- **Meters:** `.bar` and `.gbud .meter` become 7px tall and fully rounded (`overflow: hidden`), inner fill rounded.

**Done when:** Transactions, Budget and the dashboard's Top spending checked in both themes; each icon is still
readable on its well (3:1 or better); `npm test` passes.

---

## Task 8: Arrival motion

**File:** `web/src/styles.css` only.

Add keyframes `settle` (`from { opacity: 0; transform: translateY(8px); }`) and `fill`
(`from { transform: scaleX(0); }`).

- Sheets settle once when a page opens: `.main > .top` (.5s) and `.card, .standing, .insight, .bstrip` (.55s),
  `var(--ease)`, `both`. Cards inside cards do not animate.
- Stagger on the dashboard by cell order: `.dlead .dcell:nth-child(2)` and `.dmain .dcell:nth-child(1)` children 60ms;
  third lead and second board cell 120ms; third board and first side-column cell 170ms; everything after 220ms.
  Same idea for `.goalgrid`, `.tripgrid`, `.cards` and `.bcol` children (60 / 120 / 170ms, capped).
- Bars fill once from the left: `.bar i, .meter i, .bbar i, .wmbar i, .setupbar i, .sharebar i` with
  `transform-origin: left center; animation: fill .9s var(--ease) both`.
- Small transitions: `.ranges button`, `.txrow td, .arow, .acctrow, .trow, .grow` background `.15s`; `.linkbtn:hover`
  turns `--blue`.

Careful: an earlier rule sets `animation: none` on `.dash > div, .main > section, .main > .card, .flowchart, .chart`;
your rules come later and win for cards, but leave `.chart` and `.flowchart` alone (Task 9 owns charts). The dashboard
packs panels by measured height (`usePacked` in `Dashboard.jsx`); only animate `opacity` and `transform`, never height
or margin.

**Done when:** every page opened once in both themes with nothing left invisible or half-moved; `npm run check:ui`
passes with the app running (it fails on empty or still-loading pages).

---

## Task 9: Showpiece charts

**Files:** `web/src/NetWorthChart.jsx`, `web/src/CashFlow.jsx`, `web/src/AssetAllocation.jsx`,
`web/src/Projection.jsx`, `web/src/styles.css`. Data, scales, axes, hover behaviour and copy stay as they are.

- **Net worth chart (`NetWorthChart.jsx`):**
  - Under the line, a pencil-hatched wash: an SVG `<pattern>` of 45-degree 1px lines in `--blue` (about 6px apart),
    filling the area between the line and the baseline, faded out toward the bottom with a `<mask>` using a vertical
    white-to-black gradient. Give `<defs>` ids a unique prefix (`nw-`). Only under real data; leave the area under
    estimated (dashed) runs empty so estimated still reads as estimated.
  - Line: 2.75px, round joins and caps (estimated runs keep their dashes and lower opacity).
  - The last point is ringed: a 5px circle filled `--card` with a 2.5px `--blue` stroke, over a 12px halo of `--blue`
    at 16% that grows in once.
  - Wrap line, wash and end point in a `<g className="draw" key={range}>` so the chart draws in left to right
    (clip-path reveal, 1.3s) on arrival and again when the range changes. Hovering must not replay it.
- **Cash flow (`CashFlow.jsx`):** each bar gets `className="cf-bar"` and `style={{ '--i': i }}`; bars rise from the
  baseline once (`transform-box: fill-box; transform-origin: center bottom`, `scaleY(0)` to 1, .8s, 45ms stagger).
  Partial months stay faded.
- **Asset allocation (`AssetAllocation.jsx`):** ring 18px thick, drawn at 164px, soft drop shadow under it; each
  segment gets `className="seg"` and sweeps in once (`@keyframes sweep { from { stroke-dasharray: 0 400; } }`).
  The centre total grows to 16px and keeps being blurred by Hide amounts.
- **Projection (`Projection.jsx`):** the `band` path between the conservative and optimistic lines is already computed
  but never drawn. Draw it first (behind the lines) with `className="band"` (`fill: var(--blue); opacity: .09`), and
  wrap band and lines in a `draw` group.

**Done when:** all four charts checked on the dashboard in both themes; hover read-outs still work; Hide amounts
still blurs chart text; `npm run check:ui` passes.

---

## Task 10: Finish (run last)

**Files:** `DESIGN.md`, `docs/screenshots/`, plus fixes anywhere the checks fail.

1. `npm test`, then with the app running `npm run check:ui`; fix whatever fails.
2. Run the design detector once:
   `"C:/Users/renzo/.claude/plugins/cache/impeccable/impeccable/4.5.2/skills/impeccable/scripts/impeccable" detect --json web/src/styles.css web/src/Cards.jsx web/src/NetWorthChart.jsx web/src/CashFlow.jsx web/src/AssetAllocation.jsx web/src/Projection.jsx web/src/CategoryIcon.jsx`
   and fix real findings.
3. Look at every page's screenshot in `ui-shots/` in light and dark. Fix overlaps, clipped shadows, unreadable text.
4. Update `DESIGN.md` so it matches what shipped. Rules that changed:
   - Elevation: sheets now carry a soft paper shadow (was "flat, hairlines only").
   - Charts: a hatched wash under the net worth line and a projection band are allowed (was "no area fills").
   - Colour: category icons take their group's chart hue (was "inked in indigo"); a highlighter (`--hi`) exists for
     page titles only; page paper and sheet colours changed.
   - Motion: sheets settle, bars fill and charts draw in once (was "one authored moment").
   - Components: the standing strip's net worth cell sits on cover cloth with a 30-day trace; the rail is woven with
     a stitched edge; the seal rests at an angle.
5. Refresh the README screenshots from the demo household only (`npm run demo -- <folder>`; never real data).

**Done when:** `npm run verify` passes and DESIGN.md describes the app as it now looks.
