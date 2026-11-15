---
name: Mizo Money
description: A personal finance dashboard kept like a cloth-bound Japanese stationery planner.
colors:
  cover-indigo: "#1e2a47"
  cover-fold: "#2b3b63"
  cover-ink: "#c5ccdd"
  indigo-ink: "#2d4a93"
  indigo-wash: "#e8ecf5"
  page-paper: "#f2f0e9"
  dot-grid: "#cdcec3"
  sheet: "#fffefc"
  sheet-tint: "#f8f6f0"
  highlighter: "#ffe27a"
  rule: "#e1e3df"
  rule-strong: "#c8ccd2"
  ink: "#1b2030"
  ink-muted: "#555c6e"
  pencil: "#475066"
  ink-dot: "#26355c"
  seal-vermillion: "#d9482e"
  seal-ink: "#fff6f2"
  money-in: "#24724f"
  money-out: "#b4382a"
  caution-amber: "#9a6410"
  warn-wash: "#f7efde"
  alert-wash: "#f9ebe8"
  series-1: "#3554a8"
  series-2: "#b5700e"
  series-3: "#00909a"
  series-4: "#9a3fa8"
  series-rest: "#8a90a0"
  night-cover-indigo: "#1a2440"
  night-cover-fold: "#283a66"
  night-cover-ink: "#aab4cc"
  night-button: "#3c58a8"
  night-indigo-ink: "#9db2ea"
  night-indigo-wash: "#222a40"
  night-paper: "#11141c"
  night-dot-grid: "#232937"
  night-sheet: "#181c27"
  night-sheet-tint: "#1d2230"
  night-highlighter: "#5a4c12"
  night-rule: "#282e3d"
  night-rule-strong: "#3a4255"
  night-ink: "#e7e9ef"
  night-ink-muted: "#a0a7b8"
  night-pencil: "#a3abbd"
  night-ink-dot: "#a9b9e6"
  night-seal-vermillion: "#e0533d"
  night-money-in: "#5cc193"
  night-money-out: "#ee806e"
  night-caution-amber: "#e0a84a"
  night-series-1: "#6a86d4"
  night-series-2: "#c4852a"
  night-series-3: "#109e9b"
  night-series-4: "#a266cf"
typography:
  display:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "3.7rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  headline:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.028em"
  standing-figure:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  figure:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.95rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  small:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 800
    lineHeight: 1.45
    letterSpacing: "0.12em"
  column-head:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 800
    lineHeight: 1.45
    letterSpacing: "0.1em"
rounded:
  stamp: "4px"
  sheet: "6px"
  pill: "99px"
  round: "50%"
spacing:
  hairline: "1px"
  row: "0.42rem"
  tight: "0.75rem"
  gap: "1rem"
  sheet-x: "1.3rem"
  sheet-y: "1.15rem"
  page-x: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.cover-indigo}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 0.95rem"
  button-primary-hover:
    backgroundColor: "{colors.cover-fold}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 0.95rem"
  icon-button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sheet}"
    size: "34px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 0.75rem"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "1.15rem 1.3rem"
  nav-item:
    backgroundColor: "{colors.cover-indigo}"
    textColor: "{colors.cover-ink}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 0.65rem"
  nav-item-active:
    backgroundColor: "{colors.cover-fold}"
    textColor: "#ffffff"
  tag:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.45rem"
  stamp-due:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.pencil}"
    rounded: "{rounded.stamp}"
    size: "17px"
  stamp-paid:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.stamp}"
    size: "17px"
  seal:
    backgroundColor: "{colors.seal-vermillion}"
    textColor: "{colors.seal-ink}"
    rounded: "{rounded.round}"
    size: "30px"
---

# Design System: Mizo Money

## Overview

**Creative North Star: "The Planner Page"**

Money is kept the way a careful person keeps a Japanese stationery planner: a cloth-bound indigo cover down the left, calm ruled pages with a faint dot grid and a little paper grain, ink-dark figures, and the month always in view. The page is the instrument. Hierarchy comes from size, weight and hairline rules first; the planner's materials (woven cover cloth, sheets resting on the page with a soft paper shadow, a highlighter swipe behind what needs you) add depth and texture without competing with meaning, so the few things that carry colour (money in, money out, something that needs you) are read at once.

Density is that of a well-used planner, not a spreadsheet: content sits on white sheets with ruled rows and fixed columns, figures align on equal-width digits, and every page opens under a double header rule. Arrival is quiet but alive: sheets settle onto the page, meters fill and charts draw in once, and the month spread inks in on the dashboard; nothing loops. Light and dark are equals: dark is the same planner at night, with its own validated steps (the indigo cover stays), never an inversion.

The world refuses the category default of a white card grid with a blue accent, glossy gradient area charts and floating, blurry cards. It also refuses the bank-app look, playfulness, spreadsheet density and hiding detail.

**Key Characteristics:**
- A woven indigo cover rail with a stitched edge holds the seal and the navigation; the page beside it is warm paper with a 22px dot grid and a fine grain.
- One family (Atkinson Hyperlegible Next, chosen for legibility at small sizes) at four weights carries every level; figures are tabular everywhere.
- Hairline rules separate; a soft paper shadow lets sheets rest on the page; 6px corners on every sheet and control.
- Tracked uppercase labels name panels and figures; they are the titles, never a line above one.
- The month spread: one wet-ink dot per day on a fixed size ramp, bills and paydays hand-stamped (slightly askew) on their dates.
- Net worth sits on the cover cloth, the largest figure in the app, with a faint 30-day trace behind it.
- Estimated, partial and future data are always marked, one way: ink for known figures, pencil for estimated ones (see Ink and pencil under Components).

## Colors

An ink-and-indigo planner palette on warm paper: nearly all of every screen is neutral, indigo marks the cover and interaction, and meaning colours are spent only on meaning.

### Primary
- **Cover Indigo** (cover-indigo; night: night-cover-indigo): the sidebar rail, the net worth cell of the standing strip, and the primary button fill in light mode. The cloth binding of the planner: on the rail, the net worth cell and primary buttons it carries a fine woven texture (two 1px repeating line patterns, 3px apart) over a gentle top-lit gradient.
- **Cover Fold** (cover-fold): the active navigation item and the primary button's hover; a lighter fold of the same cloth.
- **Indigo Ink** (indigo-ink): links, focus rings, the selected tab, the today marker in the spread, paid stamps, and budget meters. The pen colour of interaction.
- **Indigo Wash** (indigo-wash): selected-row and today tint, tag and chip fills, empty-state icon wells.
- **Highlighter** (highlighter; night: night-highlighter): attention only. A marker swipe behind the "Needs you" heading while something waits to be sorted, and behind the top bar's "banks need attention" chip (from 60% to 90% of the line height), and nowhere else. Text keeps well over 4.5:1 on it in both themes.

### Secondary
- **Seal Vermillion** (seal-vermillion, on seal-ink): the round "M" hanko logo and nothing else. It never marks meaning.

### Tertiary (meaning only)
- **Money In Green** (money-in): income, money received, under budget, done.
- **Money Out Red** (money-out): overspent, money out where it is a warning, errors, alerts.
- **Caution Amber** (caution-amber, with warn-wash): things that fix themselves or run ahead of pace; never a problem for the user to act on.
- **Chart Series** (series-1 to series-4, then series-rest grey): four hues checked for colour-blind separation in each theme, with night steps of their own. A fifth series is grey.

### Neutral
- **Page Paper** (page-paper) with **Dot Grid** (dot-grid): the warm page behind the sheets, dotted every 22px, with a fine noise grain over it (dark warm specks at about 9% in light, pale blue specks at about 5% at night).
- **Sheet** (sheet) and **Sheet Tint** (sheet-tint): the warm white sheets content sits on; the tint marks weekends in the spread, day and group rows in tables, hover rows.
- **Rule** (rule) and **Strong Rule** (rule-strong): hairlines between rows and sections; the strong rule outlines inputs and buttons.
- **Ink** (ink): all text and figures, and the page header's double rule.
- **Muted Ink** (ink-muted): secondary text, labels on figures, column heads.
- **Pencil** (pencil): dashed stamps for bills still due, input hover borders.
- **Ink Dot** (ink-dot): the spending dots in the month spread, each with a small top-left highlight and a soft shadow, like wet ink.

### Named Rules
**The Meaning-Only Rule.** Green and red mean money in/out or good/bad, nothing else. Category icons take their group's chart hue (series-1 to series-4) on a 15% well of the same hue with a faint inner ring; neutral groups are muted grey, and only income and saving are green. Red is never a category colour. The label beside an icon carries identity; the hue is a secondary cue.

**The Highlighter Rule.** The highlighter marks attention only: what needs you. It is not a page-title marker, nor an accent for figures, rows or callouts. Nothing waiting, nothing marked.

**The Seal Rule.** Vermillion is the logo. If it appears anywhere but the seal, it is a mistake.

**The Four-Hue Rule.** Charts use series-1 to series-4 in order; anything beyond four is grey. The tint is a secondary cue; a label always carries identity.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with Segoe UI, system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible Next
**Label Font:** Atkinson Hyperlegible Next

**Character:** One Japanese gothic family, chosen for its equal-width figures, carries every level by size and weight alone (400, 500, 700, 800; Latin subsets only). It reads like a planner's printed ruling: plain, even, a little formal.

### Hierarchy
- **Display** (800, 3.7rem, 1.1, -0.035em; 2.9rem below 1100px): the lead figure only, net worth in the standing strip, white on the cover cloth with a 2px dark text shadow.
- **Headline** (800, 2.6rem, 1.1, -0.028em): the page title, which on the dashboard is the date. Plain ink, no marker.
- **Standing figure** (800, 2.2rem, 1.1): free to spend and spent this month in the standing strip; Budget's "left to budget" figure is 2.6rem.
- **Figure** (800, 1.95rem, 1.1): other headline figures (panel totals, summary cards).
- **Title** (600, 1.05rem): budget group headers, trip names, totals rows.
- **Body** (400, 1rem, 1.45): rows, descriptions, controls.
- **Small** (400, 0.8rem): row details, footnotes, dates, deltas.
- **Label** (800, 0.74rem, 0.12em, uppercase): panel titles and figure labels.
- **Column head** (800, 0.7rem, 0.1em, uppercase, muted): table headers.

### Named Rules
**The One Family Rule.** Never add a second typeface. Hierarchy is size and weight.

**The Equal Figures Rule.** All numbers are tabular (`font-variant-numeric: tabular-nums` on body), so columns of money align without effort.

**The Label Is the Title Rule.** A tracked uppercase label names the panel or figure it sits on. It is never a decorative line above a separate heading.

## Layout

A fixed 220px cover rail on the left (64px, icons only, below 1100px; it never disappears) and a main page padded 1.5rem 2.5rem 3.5rem. Every page opens with a header whose bottom is a double rule: 2px ink, then a 1px ink line at 30% opacity 6px below it, and 1.5rem to the content; actions sit at its right, aligned to the rule.

The dashboard runs lead sheets full width (the standing strip, the month spread, the Needs you / Coming up / Budget sheet), then a packed board of panels: a three-column grid with 8px auto rows so each panel takes the height its content needs, never stretched to a neighbour. At 1440px and wider a 340px side column appears and the board beside it uses two wider columns. Other pages pair a main column with a 280-320px side sheet that drops below at 1099px.

Rhythm: 1rem between sheets; 1.15rem by 1.3rem inside them; list rows of about 0.42-0.6rem separated by hairlines. Desktop-first: narrow windows collapse the rail and stack columns; there is no phone layout.

**The Fixed Columns Rule.** Lists and tables are ruled rows with fixed columns; names truncate to one line with the full name on hover rather than reflowing the grid. In the transactions table a long group prefix ("Savings & investments ›") drops above its category menu rather than pushing the amount column out of the sheet.

## Elevation & Depth

Paper on a desk. Sheets keep their 1px rule border and rest on the page with a soft, low paper shadow: a tight contact shadow plus a long, faint one pulled in under the sheet so it never reads as a floating card. Inside a sheet, separation is still hairlines only. The cover rail casts a shadow onto the page. Things that float above the page (tooltips) keep the stronger floating shadow.

### Shadow Vocabulary
- **Paper** (`--paper-shadow`: `0 1px 0 rgba(27,32,48,.03), 0 1px 2px rgba(27,32,48,.06), 0 12px 28px -16px rgba(27,32,48,.28)`; night: an inset 3% white top edge, `0 1px 2px` black at .4 and `0 14px 30px -16px` black at .75): every sheet (cards, the standing strip, insight rows, the budget strip, explainers, Budget's left-to-budget card). A sheet inside a sheet has none.
- **Paper lifted** (`--paper-shadow-up`): goal, trip and watchlist cards on hover, with a 2px rise (0.3s).
- **Floating card** (`--shadow`: `0 2px 6px rgba(27,32,48,.06), 0 14px 34px rgba(27,32,48,.12)`; night uses black at .3/.45): hover tooltips and chart tips only.
- **Cover rail** (`6px 0 22px -8px rgba(12,17,34,.55)`): the rail onto the page.
- **Pressed cloth** (primary buttons): an inset 16% white top edge, a 2px contact shadow and a short soft drop; hover lifts 1px, pressed drops 1px with no shadow.
- **Control**: buttons `0 1px 1px rgba(27,32,48,.05)`; inputs and selects an inset `0 1px 2px` at .05 and, on focus, a 3px indigo-ink ring at 18% alongside the outline.
- **Selected segment** (`box-shadow: 0 1px 2px rgba(27,32,48,.12)`): the active option in a range/segmented control.

### Named Rules
**The Hairline Rule.** Inside a sheet, separate with a 1px rule, never a shadow. Only whole sheets carry the paper shadow, and it stays low and soft: if a sheet looks like it floats, the shadow is wrong.

## Shapes

Quietly squared stationery. Sheets, buttons, inputs, icon buttons and tooltips share a 6px corner; stamps are 4px squares; tags, pills and chips are fully round; the seal, dots and category icons are circles. Borders are 1px hairlines; the page header is a double rule (2px ink, then 1px at 30%); the month spread's top edge is a 1px ink rule. Meters (budget bars and group meters) are 7px tall and fully rounded. The rail's right edge is stitched: a 1.5px dashed line in white at 17%, 5px in from the edge. Dashed outlines mean "not yet": future days, bills still due, budget suggestions.

## Components

### Buttons
Plain controls in the world's ink.
- **Shape:** 6px corners.
- **Primary:** pressed cloth: the cover texture over a gradient from cover indigo lightened 16% down to cover indigo (night: night-button, a lighter indigo so it reads on dark sheets), white 700 text, 0.5rem 0.95rem, with the pressed-cloth shadow.
- **Hover / Focus:** primary moves to the cover fold and lifts 1px; secondary's border darkens from strong rule to ink. Focus is a 2px indigo-ink outline offset 2px, keyboard only. Pressed buttons drop 1px.
- **Secondary:** sheet fill, strong-rule border, 500 ink text.
- **Icon button:** 34px square, muted icon, rule border; on/active uses the indigo wash.

### Chips and Tags
- **Style:** fully round pills at 0.68-0.8rem. Informational tags use indigo wash with indigo ink; meaning tags use a 14-15% mix of green or red over the sheet with the full colour as text.
- **Notice chip:** a 6px ink dot (amber for a problem that fixes itself, indigo for news) before the text, in a warn-wash or indigo-wash pill.

### Cards / Containers (sheets)
- **Corner Style:** 6px.
- **Background:** sheet on page paper.
- **Shadow Strategy:** the paper shadow; none for a sheet inside a sheet (see Elevation).
- **Border:** 1px rule.
- **Internal Padding:** 1.15rem 1.3rem; panel header (label title left, links or controls right) 0.75rem above content.
- **Ruled sheets:** the standing strip and the glance sheet split one sheet into sections with vertical hairlines instead of separate cards.

### Inputs / Fields
- **Style:** sheet fill, strong-rule 1px border, 6px corners, 0.5rem 0.75rem; standard selects, checkboxes and tabs (accent-color indigo).
- **Hover / Focus:** border moves to pencil; focus is the indigo outline plus a 3px indigo ring at 18%. In-place editors (category menus, nicknames, trip names) stay flat.
- **Suggested value:** dashed border, transparent fill, italic muted placeholder with "≈".
- **Ink and pencil (`<Est>`, `.est-fig`):** a known figure is ink; an estimated, partial or future one is wrapped in `<Est why="…">`, which renders it in Muted Ink with a 1px dashed underline and a `title` saying why (words only, no amounts). Put it inside an element Hide amounts blurs (`.amt`, `.tamt`, `<Amt>`). No "est" superscripts, italics or faded cells on figures. Charts keep their own dashed lines and fades.

### Navigation
- **Style:** the woven indigo cover rail (cloth over a gradient from a lighter fold at the top to cover indigo by 38%, and 18% darker at the foot), its stitched right edge and its shadow onto the page; seal and white 800 wordmark at the top; items 0.95rem in cover ink with 18px line icons.
- **States:** hover is a 6% white wash and white text, and the icon slides 2px right; active is a soft fold (cover fold lightened 14% at the top down to cover fold, with an inset white top edge and a small shadow) with white 700 text. Focus outline is white on the rail.
- **Narrow windows:** 64px rail, seal and icons only.

### Standing Strip (signature)
One ruled sheet in three sections (1.5fr / 1fr / 1fr), each padded 1.35rem 1.5rem 1.4rem. Net worth sits on the cover cloth (a 135° gradient from the cover fold to cover indigo, darkening at the far corner) in white at display size; its labels are cover ink, and green and red step lighter there (#8fe0b8, #ffa896) so deltas keep 4.5:1 on the indigo. Behind it, a faint white line traces the last 31 days of net worth (2px at 50%; at least 4% of net worth tall so a wobble isn't exaggerated; dashed if any day is estimated; faded where it passes behind the figure; drawn in left to right once). Free to spend and spent this month follow at standing-figure size. Each has a tracked label above, a small muted line or delta below, and a hover breakdown behind the figure. Each figure remembers its value from the last visit (this browser, at least 2 hours ago): when it has changed, the number counts to its new value once (1.1s exponential ease-out) and a note under it reads "+$412 since Fri" (green/red for net worth and free to spend, ink for spending).

### Month Spread (signature)
The month across the full width, one column per day under a 1px ink top rule and vertical hairlines. Each past day carries one wet-ink dot sized on a fixed eight-step ramp (0, 5, 8, 11, 15, 19, 24, 30px) shared by every month; days ahead carry an 8px dashed circle. Bills and paydays are 17px square stamps with the payee's initial (or a count): dashed pencil while due, solid indigo on wash once paid (with a 1px pressed edge), green for money in. Stamps in day columns rest hand-pressed at a slight angle (-5°, every third column 4°, every 4n+1 column -2°); legend stamps stay straight. Hovering a day scales its dot and stamps to 1.12 and straightens the stamps (0.3s). Weekends take the sheet tint; today takes the indigo wash with a 2px indigo top edge. On load, dots ink in (0.6s, 18ms stagger by date) and stamps press in just after.

### Motion
Every movement uses one curve, `--ease: cubic-bezier(.16, 1, .3, 1)`, plays once on arrival, and respects reduced motion. No page transitions, springs, loops or celebration.
- **Sheets settle:** the page header (0.5s) and each sheet (0.55s) rise 8px and fade in; on the dashboard they stagger by cell order (60, 120, 170, then 220ms), and goal, trip, card and budget columns by position (60, 120, 170ms). Sheets inside sheets don't move. Only opacity and transform animate, never size, so the packed dashboard never reflows.
- **Attention swipe:** the highlighter draws behind the "Needs you" heading left to right (0.9s), only when something waits to be sorted.
- **Meters fill** from the left (0.9s).
- **Charts draw in:** the net worth line, wash and end point reveal left to right (1.3s) on arrival and again when the range changes, never on hover; cash flow bars rise from the baseline (0.8s, 45ms apart); allocation segments sweep round (0.9s); the projection band and lines reveal left to right; the hero trace draws in (1.4s).
- **Already in place:** the month spread's ink-in, the standing strip's since-last-visit count, Money flow's streams drawing in (1.1s) with a 0.22s hover focus, and the month replay drawing the month through once.
- **Small transitions:** row hover backgrounds and segmented controls (0.15s), lifting cards (0.3s), the rail icon nudge (0.25s), the seal straightening (0.5s).

### Charts
Lines are 2.75px with round joins and caps (net worth) or 2.5px (projection, replay); estimated runs stay dashed and lighter. Two fills are allowed, both quiet and both marking real ranges, never gloss:
- **Net worth wash:** under real (not estimated) runs only, a pencil hatch of 1px 45° indigo-ink lines 6px apart, fading out toward the baseline; estimated runs get no wash, so estimated still reads as estimated (a day without a sync leaves a narrow gap). The last point is ringed (5px sheet-coloured dot, 2.5px indigo stroke) over a 12px indigo halo at 16% that grows in once.
- **Projection band:** the range between the conservative and optimistic lines, indigo ink at 9%, behind the lines.
- **Allocation ring:** 18px thick, drawn at 164px with a soft drop shadow under it; the centre total is 16px.

### Month Replay (Money flow)
The cash in everyday accounts at the end of each day, as one stepped indigo line (2.5px) across the month's day columns (weekends tinted, today washed), stepping at each day's centre where its stamps sit (the month spread's stamps: green for money in, indigo for bills paid from these accounts, dashed while expected). Days ahead are dashed and add only scheduled paydays and bills. The four biggest steps are named on the line; the lowest point is ringed. A readout above counts the day's cash, its named paydays and bills, and the rest. Replay draws the month through once (3.2s, ease-out) with the readout counting along; it plays on arrival, respects reduced motion, and hover reads out any day.

### Glance Sheet
Under the spread: Needs you, Coming up, Budget as three ruled sections of one sheet; rows separated by hairlines, a drawn check and a muted line when there is nothing to do.

### Seal
A 30px vermillion circle with an inner hairline ring and a drawn "M" in seal ink, like a hanko, with a small drop shadow. It rests pressed at -7°; hovering the logo straightens it and scales it to 1.06 (0.5s). Logo only.

## Do's and Don'ts

### Do:
- **Do** rest every sheet on the page with a 1px rule, 6px corners and the paper shadow; keep sheets inside sheets flat.
- **Do** use Atkinson Hyperlegible Next for everything, with tabular figures.
- **Do** name panels with the tracked uppercase label (0.74rem, 800, 0.12em) as their title.
- **Do** mark estimated, partial or future figures with `<Est>` (muted, dashed underline, a reason on hover); in charts, dashed lines and outlines, faded partial months, no wash under estimated runs.
- **Do** keep motion to one arrival: settle, fill or draw in once with `--ease`, animating opacity and transform only.
- **Do** give every dollar figure an amount class (`.amt`, `.tamt`, `.big`, or a covered table cell) so Hide amounts blurs it.
- **Do** draw icons as 1.8px-stroke line SVGs in currentColor, matching the navigation set.
- **Do** design light and dark together; dark keeps the indigo cover rail and uses its own validated steps.
- **Do** put the detail behind a figure in a hover card (dotted underline) rather than hiding it.

### Don't:
- **Don't** use green or red for anything but money in/out or good/bad.
- **Don't** use vermillion anywhere but the seal.
- **Don't** float sheets on big blurry shadows, add glossy gradients to charts, or fill a chart area with anything but the net worth hatch or the projection band.
- **Don't** use the highlighter for anything but attention: the "Needs you" heading and the banks chip.
- **Don't** add a second typeface or a system display face.
- **Don't** put a small line of label text above a heading as a kicker or eyebrow.
- **Don't** use text glyphs (×, ‹, ›, ●, ↻) as icons; draw them.
- **Don't** use more than four chart hues; the rest are grey.
- **Don't** design a phone layout; narrow windows collapse the rail and stack columns.

## Voice and wording

The app talks like a dry, careful clerk who has checked the numbers. Plain and a little understated; it says what is
true and how it was worked out, and stops there. Copy is part of the design: the rules below apply to every subtitle,
empty state, note, tooltip and button label the app shows. Labels, category names and anything the server returns are
not rewritten to fit these rules.

### Rules

1. **Talk to "you", and call the app "Mizo Money".** Never "we" or "our".
   - Good: "Mizo Money started tracking" (`web/src/NetWorth.jsx`, the tooltip on investment history).
   - Bad: "We can't work out investment values backwards." (not in the app; the app says "Investment values can't be worked out backwards").
2. **Sentence case everywhere.** Titles and buttons included, except proper nouns and the tracked uppercase labels, which CSS sets.
   - Good: "Keep an eye on a shop or category" (`web/src/Insights.jsx`).
   - Bad: "Keep An Eye On A Shop Or Category".
3. **No em dashes in sentences.** A lone "—" in a table cell is a data mark for "no value" and stays. Use a comma, a colon or a full stop.
   - Good: "Recurring bills, autopays and income: found in your transactions, from Plaid, from card statements, or added by you." (`web/src/Bills.jsx`).
   - Bad: "Recurring bills, autopays and income — found in your transactions."
   - Data mark, allowed: `<span className="muted">—</span>` for a missing cost basis (`web/src/Investments.jsx`).
4. **No exclamation marks.** Nothing is celebrated; a finished step is ticked, not announced.
   - Good: "Nothing to compare yet" (`web/src/Insights.jsx`).
   - Bad: "All caught up!"
5. **Real minus sign for negative amounts.** Use "−" (U+2212), never a hyphen, and never "(…)".
   - Good: `` `${g.pace >= 0 ? '+' : '−'}${usd(Math.abs(g.pace))}` `` (`web/src/Goals.jsx`, the change per month in a tooltip).
   - Good: `` `${d.gain >= 0 ? '+' : '−'}${usd(Math.abs(d.gain))}` `` (`web/src/Insights.jsx`, unrealized gain).
   - Bad: a hyphen-minus in a money figure, such as "-$1,240".
6. **Say what is true and checkable.** Name the thing you can see: a date, a count, a range, a source. Avoid praise and
   vague claims.
   - Good: "Banks share very different amounts of history (some two years, some about 90 days)" (`web/src/Settings.jsx`).
   - Good: "Starts on the 5th of the month" (`web/src/Insights.jsx`).
   - Bad: "Smart insights that power your savings journey." Never use "smart", "powerful", "seamless", "insights",
     "journey" or "experience" in new copy. (The app has none of them in `web/src` today; the one file name `Insights.jsx` is internal.)
7. **A subtitle never restates its title, and it is one sentence.** It adds what the page shows that the title does not.
   - Good: "Holdings across your linked brokerage, retirement and HSA accounts." (`web/src/Investments.jsx`, title "Investments").
   - Bad: "Investments: your investments, in one place." Two sentences, or a how-to, belong beside the control instead.
8. **An empty state says what will appear and the one thing to do.**
   - Good: "Spending by group shows here as transactions come in." (`web/src/Categories.jsx`, title "No spending yet").
   - Good: "Streaming, apps and memberships show up here once they've charged a couple of times." (`web/src/Reports.jsx`).
   - Good with action: "Set a target, optionally tied to an account, and watch it fill up." with the button "Add a goal" (`web/src/Goals.jsx`).
   - Bad: "Nothing here yet! Get started by adding your first item."
9. **Estimates are named as estimates, with the reason on hover.** The reason says why, in words, and no amounts appear in it.
   - Good: "Investment values can't be worked out backwards, so history starts when Mizo Money started tracking" (`web/src/NetWorth.jsx`).
   - Good: "Starts on the 5th of the month" on a figure that is not yet known (`web/src/Insights.jsx`).
   - Bad: "Estimated." on its own, with no reason.
10. **Say what the number is made of, and do not shorten it.** An explanation of how a figure was worked out is the product
    ("every number earns trust"), so it stays, even when long.
    - Good: "Same days of last month, everyday spending only: recurring bills are left out, and banks without history for last month aren't compared." (`web/src/Insights.jsx`).
11. **Notes say what happens next, in one or two plain sentences.**
    - Good: "Already spent, so set aside to pay off. Card payments aren't counted again as bills." (`web/src/Insights.jsx`).
    - Good: "This card's last statement is paid. The next bill appears when the next statement is issued; …" (`web/src/Bills.jsx`).
12. **Contractions are fine; hedging is not.** Use "aren't", "doesn't", "can't" and "you're" as a clerk would. Do not write "may", "might" or "could" about a figure the app has. If it is unknown, say so.
    - Good: "Your 401(k) provider doesn't report cost basis" (`web/src/Investments.jsx`).
    - Bad: "Cost basis might possibly not be available."

### Where the app is already right

- Short, specific subtitles: "Track savings targets by hand, or link a goal to an account and it follows the balance." (`web/src/Goals.jsx`, as a starting point; see Task 18 for the page subtitles that still run long).
- Empty states that name the next step: "Connect a bank to see its accounts here." (`web/src/NetWorth.jsx`).
- A plain greeting on the dashboard: "Here's where you stand." (`web/src/App.jsx`).
- No hype words in `web/src`: a search found none of "smart", "powerful", "seamless", "journey", "experience", and no exclamation marks in JSX text. Plural "we" was checked only as "we can", "we will", "we have" and "we've".

### Examples used above, with the file each comes from

| Line | File |
|---|---|
| "Here's where you stand." | `web/src/App.jsx` |
| "Holdings across your linked brokerage, retirement and HSA accounts." | `web/src/Investments.jsx` |
| "Spending by group shows here as transactions come in." | `web/src/Categories.jsx` |
| "From the 5th, shops you visit more often than last month show up here." | `web/src/Insights.jsx` |
| "Already spent, so set aside to pay off. Card payments aren't counted again as bills." | `web/src/Insights.jsx` |
| "Set a target, optionally tied to an account, and watch it fill up." | `web/src/Goals.jsx` |
| "Streaming, apps and memberships show up here once they've charged a couple of times." | `web/src/Reports.jsx` |
| "Investment values can't be worked out backwards, so history starts when Mizo Money started tracking" | `web/src/NetWorth.jsx` |
