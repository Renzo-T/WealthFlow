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
  dot-grid: "#d9d9d0"
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
  night-dot-grid: "#191e23"
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
    fontSize: "1.6rem"
    fontWeight: 700
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
  panel: "3px"
  sheet: "6px"
  pill: "99px"
  round: "50%"
spacing:
  unit: "22px"
  hairline: "1px"
  row: "0.42rem"
  tight: "0.75rem"
  gap: "1rem"
  sheet-x: "22px"
  sheet-y: "22px"
  page-x: "44px"
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
    backgroundColor: "color-mix(in srgb, {colors.sheet} 35%, transparent)"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "22px"
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
    backgroundColor: "transparent"
    textColor: "{colors.pencil}"
    rounded: "{rounded.stamp}"
    size: "17px"
  stamp-paid:
    backgroundColor: "{colors.indigo-ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.stamp}"
    size: "17px"
  stamp-received:
    backgroundColor: "{colors.money-in}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.round}"
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

Money is kept the way a careful person keeps a Japanese stationery planner: a cloth-bound indigo cover down the left, calm ruled pages with a faint dot grid and a little paper grain, ink-dark figures, and the month always in view. The page is the instrument. Hierarchy comes from size, weight and hairline rules first; the planner's materials (woven cover cloth, panels ruled on the page in pencil over its dot grid, a highlighter swipe behind what needs you) add depth and texture without competing with meaning, so the few things that carry colour (money in, money out, something that needs you) are read at once.

Density is that of a well-used planner, not a spreadsheet: content sits in pencil-ruled panels drawn on the page's dot grid, every edge, rule and row on a line of dots, with ruled rows and fixed columns; figures align on equal-width digits, and every page opens under a double header rule. Arrival is quiet but alive: meters fill and charts draw in once, and the month calendar inks in on the dashboard; panels themselves never move, and nothing loops. Light and dark are equals: dark is the same planner at night, with its own validated steps (the indigo cover stays), never an inversion.

The world refuses the category default of a white card grid with a blue accent, glossy gradient area charts and floating, blurry cards. It also refuses the bank-app look, decoration that competes with meaning, spreadsheet density and hiding detail. The planner's objects are welcome, each for one meaning, and a little decoration is allowed beside them under a budget (see The Decoration Budget under Components).

**Key Characteristics:**
- A woven indigo cover rail with a stitched edge holds the seal and the navigation; the page beside it is warm paper with a 22px dot grid and a fine grain.
- One family (Atkinson Hyperlegible Next, chosen for legibility at small sizes) at four weights carries every level; figures are tabular everywhere.
- Panels are pencil-grey borders drawn on the paper with a faint wash of the sheet colour, not white sheets with shadows; hairline rules divide them; 3px corners on panels, 6px on controls.
- The dot grid is the layout grid: one unit is 22px, and every panel edge, section rule, list row and calendar line falls on a row or column of dots (see Grid Unit under Layout).
- Content that belongs together is one ruled panel, divided by hairlines, not a row of neighbouring boxes.
- Tracked uppercase labels name panels and figures; they are the titles, never a line above one.
- The month as a wall calendar, Sunday to Saturday: each day's spending written in it and underlined with a highlighter stroke whose length follows one fixed scale, bills and paydays inked as stamps (slightly askew) in the day's corner.
- Net worth is written straight on the page with no panel around it, its label marked with the highlighter: the largest figure in the app and the one thing without a box, so the eye lands there first.
- Planner objects (stamps, the ribbon, the highlighter, margin notes) each mark one true thing about the data and appear nowhere else.
- Estimated, partial and future data are always marked, one way: ink for known figures, pencil for estimated ones (see Ink and pencil under Components).
- Five journals (cover, paper, ink accent, highlighter and washi tapes) are chosen in Settings, and a little decoration (washi tape, a margin doodle, a pen underline) is allowed under a strict budget and can be switched off.

## Colors

An ink-and-indigo planner palette on warm paper: nearly all of every screen is neutral, indigo marks the cover and interaction, and meaning colours are spent only on meaning.

### Primary
- **Cover Indigo** (cover-indigo; night: night-cover-indigo): the sidebar rail and the primary button fill in light mode. The cloth binding of the planner: on the rail and primary buttons it carries a fine woven texture (two 1px repeating line patterns, 3px apart) over a gentle top-lit gradient.
- **Cover Fold** (cover-fold): the active navigation item and the primary button's hover; a lighter fold of the same cloth.
- **Indigo Ink** (indigo-ink): links, focus rings, the selected tab, today's edge in the month calendar, the ink of paid stamps, and budget meters. The pen colour of interaction.
- **Indigo Wash** (indigo-wash): selected-row and today tint, tag and chip fills, empty-state icon wells.
- **Highlighter** (highlighter; night: night-highlighter): two forms, never confused. The swipe is attention only: a marker swipe behind the "Needs you" heading while something waits to be sorted, and behind the page header's "banks need attention" chip (from 60% to 90% of the line height), and nowhere else. The swipe has uneven ends (an SVG mask), ends a touch darker where the marker pooled, is tilted about -1° and is multiply-blended in daylight; its colour comes from the journal. Text keeps well over 4.5:1 on it in both themes. The stroke is a short 6px underline under a day's spending figure in the month calendar, its length on the spending ramp (see Month Calendar); nothing else uses it.

### Secondary
- **Seal Vermillion** (seal-vermillion, on seal-ink): the round "M" hanko logo and nothing else. It never marks meaning.

### Tertiary (meaning only)
- **Money In Green** (money-in): income, money received, under budget, done.
- **Money Out Red** (money-out): overspent, money out where it is a warning, errors, alerts.
- **Caution Amber** (caution-amber, with warn-wash): things that fix themselves or run ahead of pace; never a problem for the user to act on.
- **Chart Series** (series-1 to series-4, then series-rest grey): four hues checked for colour-blind separation in each theme, with night steps of their own. A fifth series is grey.

### Neutral
- **Page Paper** (page-paper) with **Dot Grid** (dot-grid): the warm page, ruled every 22px (dots, a square grid or lines, by journal), with a fine noise grain over it (dark warm specks at about 9% in light, pale blue specks at about 5% at night). The ruling shows through the panels' faint wash, and it is the layout grid: everything lines up with it (see Grid Unit). It never shows as the gaps of a card grid inside one subject (see The One Sheet Rule).
- **Sheet** (sheet) and **Sheet Tint** (sheet-tint): the sheet colour is washed at 35% behind every panel (`--sheet`, derived from the journal's sheet colour in both themes; `--sheet-head` is the same look made opaque, for sticky table heads), and stays solid behind things that float (dialogs, hover tips, menus) and controls; the tint marks day and group rows in tables and hover rows.
- **Rule** (rule) and **Strong Rule** (rule-strong): on the page every rule is the strong one (`.main` maps rule to rule-strong), since the faint rule disappears once the dots show through: panel lines, section rules, row rules, the calendar's lines. Outside the page (dialogs, tips) the faint rule stays.
- **Ink** (ink): all text and figures, and the page header's double rule.
- **Muted Ink** (ink-muted): secondary text, labels on figures, column heads.
- **Pencil** (pencil): the dashed boxes of bills still due, input hover borders, margin notes.
- **Ink Dot** (ink-dot): the spending dots in Reports' year at a glance, each with a small top-left highlight and a soft shadow, like wet ink.

### Journals
Five journal presets, picked in Settings › Journal and remembered per browser like the theme. The colour names above and in the front-matter are the Indigo journal's values.
- **Indigo** (default): today's colours, yellow highlighter, dot grid.
- **Plum:** aubergine cloth, cream paper, pink highlighter, dot grid.
- **Charcoal:** black cover, bright white grid paper, orange highlighter.
- **Saddle:** tan leather, kraft-tinted paper, apricot highlighter, dot grid.
- **Slate:** blue-grey cloth, cool white ruled-line paper, lavender highlighter.

Each journal sets its cover (rail, fold, rail ink, primary button), its paper (page, sheet, tint and ruling: dot grid, square grid or ruled lines), its ink accent (links, meters, paid stamps, tags), its highlighter, three washi tapes, a doodle, and its own night steps, including the colour the cover's fold is lifted toward at night (`--cloth-lift`). Fixed in every journal: ink and muted text, green and red, amber, chart series 1 to 4, and the vermillion seal. No cover is red (it would clash with money out and the seal) or green (money in).

The single source of the journal tokens is `web/src/journals.js`, which `journal.js` injects after `styles.css` as `:root[data-journal]` blocks. `tests/journals.test.js` checks every journal's contrast in both themes: text at 4.5:1 on paper, sheet, tint, highlighter and cover; white on cover, fold and buttons; the cover's green and red.

### Named Rules
**The Meaning-Only Rule.** Green and red mean money in/out or good/bad, nothing else. Category icons take their group's chart hue (series-1 to series-4) on a 15% well of the same hue with a faint inner ring; neutral groups are muted grey, and only income and saving are green. Red is never a category colour. The label beside an icon carries identity; the hue is a secondary cue.

**The Highlighter Rule.** The highlighter swipe (behind a heading or chip) marks attention only: what needs you. Nothing waiting, nothing marked. Its one other use is the calendar's spending stroke, a short underline under a day's figure whose length is the amount; it is never a page-title marker, nor an accent for other figures, rows or callouts.

**The Seal Rule.** Vermillion is the logo. If it appears anywhere but the seal, it is a mistake.

**The Four-Hue Rule.** Charts use series-1 to series-4 in order; anything beyond four is grey. The tint is a secondary cue; a label always carries identity.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with Segoe UI, system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible Next
**Label Font:** Atkinson Hyperlegible Next

**Character:** One family, Atkinson Hyperlegible Next, chosen for legibility at small sizes and its equal-width figures, carries every level by size and weight alone (400, 500, 700, 800; Latin subsets only). It reads like a planner's printed ruling: plain, even, a little formal.

### Hierarchy
- **Display** (800, 3.7rem, 1.1, -0.035em; 2.9rem below 1100px): the lead figure only: net worth, 3.6rem in ink on the page itself (3.1rem below 1100px), under its highlighted label.
- **Headline** (800, 2.6rem, 1.1, -0.028em): the page title, which on the dashboard is the date. Plain ink, no marker.
- **Standing figure** (800, 2.2rem, 1.1): free to spend and spent this month in the standing strip; Budget's "not yet assigned" figure is 2.6rem.
- **Figure** (700, 1.6rem, 1.1): secondary figures (`.big`: summary cards, goal amounts, panel totals). 800 is kept for each page's lead figure only (standing strip, Budget's not yet assigned, the Money flow total), so they never compete.
- **Row label** (500): table row labels, such as Reports' category rows; never bold.
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

A fixed 220px cover rail on the left (64px, icons only, below 1100px; it never disappears) and a main page padded one grid unit at the top, two at the left and three at the foot (the right takes whatever makes the page a whole number of units wide). Every page opens with a three-unit header (a two-unit title over a one-unit line) whose bottom is a double rule: 2px ink, then a 1px ink line at 30% opacity 6px below it, drawn just under the header in the unit before the content. The title row carries the page's own actions at its right, then the app's tools: the update and "banks need attention" chips, what a Refresh just found, the theme toggle and Hide amounts (`HeaderTools` in `ui.jsx`, set by App.jsx). There is no row above the title.

The dashboard's page header is the date over a since-last-visit digest ("Since Sun: 7 new transactions, 2 bills paid. Acme Corp pays Fri.", from `GET /api/since`; the plain greeting on a first visit or a visit earlier the same day), with Customize dashboard (and, while customizing, its controls) at the header's right. It opens with where you stand written on the page (net worth, then free to spend and spent this month, separated by space and one hairline, no panel), then runs lead panels full width (This month: the calendar with Needs you and Coming up beside it and Budget under both; then the "what changed" line), then a packed board of the panels you keep (net worth chart, recent transactions, cash flow, watchlist, goals (active ones only; when all are reached, one line pointing to Plan), and the optional ones under Customize; an empty watchlist is one muted line over its chips; no Upcoming, Free to spend or projection panel: Coming up continues in Bills, the standing strip's hover gives the free-to-spend breakdown, and the projection lives on Plan). The board is a three-column grid of one-unit rows with no row gap: each panel spans the whole units its content needs plus one empty row of dots under it, never stretched to a neighbour (neighbours that start on the same line within four rows of each other's height end on the same line). At 1440px and wider a 15-unit (330px) side column appears and the board beside it uses two wider columns. Other pages pair a main column with a 14-unit (308px) side panel that drops below at 1099px.

### Grid Unit
The page's ruling is the layout grid. One unit (U, `--u`) is the dot spacing: 22px, stepped by window width so the page looks the same at any size: 20px below 1280px, 24px from 1920px, 26px from 2400px. Always a whole number of pixels, so dots and 1px lines stay crisp and edges stay on the grid. The root font size follows it (`calc(var(--u) * 16 / 22)`), so type, spacing, rows and calendar days grow and shrink together; hairlines stay 1px and the rail stays 64px.
- **Width cap.** The content is at most 64 units wide, centred in the window with a whole-unit margin, so it still starts on a dot; the paper fills the window either side.
- **Origin.** The ruling's marks sit at whole units from `.main`'s padding-box corner: dots centred on each crossing, square-grid and ruled lines on each unit's top and left edge (`RULING` in `web/src/journals.js`). The page's content starts one unit down and two units in.
- **Widths (CSS).** The content box is a whole number of units wide (the right padding takes the remainder, with `mod()`). Columns split it in whole units with the last one taking the rest (`round(down, …, var(--u))`), and every gap between boxes is one unit, so each edge lands on a column of dots: the board, `.grid2`, `.nwtop`, `.budgetgrid`, `.goalsgrid`, goal and trip grids, ruled strips (N − 1 equal unit columns, the last takes the rest) and ledger halves.
- **Heights (JS).** `web/src/grid.js` (started by App.jsx) rounds heights up to whole units: every panel, every section of a ruled panel, and every top-level block of the page (header, notes, tab bars included) gets a `min-height` of whole units, innermost first, one layout per depth level, re-run on resize and on content changes (a ResizeObserver and a MutationObserver, at most once a frame; a pass that writes the same heights changes nothing, so they settle). A box may end with up to 21px of empty space; content is never shrunk to avoid it, and panels keep only half a unit of padding at the foot, so on average the space under the content matches the unit above it. Blocks follow one another one unit apart. A subgrid (goal cards) grows through `--snap-pad` added to its bottom padding instead. A panel inside another panel's body isn't snapped.
- **Rules take no room.** A panel's pencil line is an outline drawn just inside its edge; rows and calendar lines are inset shadows; a section's rule is its own top border, inside its height.
- **Rows.** List and table rows are two units (44px) with their rule on the row's top edge, the list closed by one at its foot: Needs you, Coming up, Recent transactions, budget rows, the Transactions and Bills tables (head row included). Investments' holdings rows and the dashboard's watchlist and goal rows are three units (two lines each: figures or a name over its account, then the bar). The Bills calendar's columns share the panel's whole units, the extra ones going to the weekdays, so it runs edge to edge. A row whose content needs more (a wrapped account name; a bill's paid line and amount mode) grows; the panel still ends on the grid. Panel heads are one unit tall with one unit under them; panel and section padding is one unit.
- **Narrow windows.** Down to about 1000px: side columns stack and the board uses two columns. The dashboard's calendar stacks above Coming up only when its own panel is narrower than about 800px; stacked, its days stretch to fill the panel in whole units.
- `npm run check:ui` checks it: every snapped box's edges within 1px of a grid line, on every page, light and dark; `--sizes 1024x768,1366x768,1440x900,1920x1080,2560x1440` runs it at each window size.

**The One Sheet Rule.** Neighbouring panels that belong together are one panel, ruled into sections with hairlines (vertical between figures side by side, full-width horizontal between stacked sections), the way a planner rules a page. Separate panels are for separate subjects: the dashboard's board of panels, goal and trip cards, Money flow's two views, Bills' calendar and its table, Net worth's lead band, chart, what moved, banks and other assets, Investments' allocation and holdings. Two forms, in `styles.css` under "Ruled sheets":
- **Ruled strip** (`.cards.ruled`): a row of figure sections in one panel, equal whole-unit columns, a vertical hairline between them (two columns with a horizontal rule in narrow windows). Plan's totals, Investments' totals, Reports' subscription and year figures, and the totals for Transactions' current filters (with Download CSV in the last section).
- **Ledger** (`.ledger`): panels stacked into one, each becoming a flat section under a full-width hairline. The dashboard's lead panels (This month and the "what changed" line) are one ledger, with where you stand above it on the paper, split back into separate panels while you customize it; Reports' Subscriptions (figures over the list) and Year in review (figures over "Where it went" and "Highlights", in halves so the rules line up); Transactions (the totals strip over the table); Net worth's account groups (cash, cards, investments, loans); Budget's side column (summary, options, suggestions); and Settings, one section per setting. A ledger clips with `overflow: clip`, not `hidden`, so a sticky table head inside it still sticks to the window. A section inside a section is a band: Plan's forecast runs settings, your average (on the sheet tint) and the projection as ruled bands of one panel.

Rhythm: one unit (22px) between panels and inside them; list rows two units, separated by hairlines. Desktop-first: narrow windows collapse the rail and stack columns; there is no phone layout.

**The Fixed Columns Rule.** Lists and tables are ruled rows with fixed columns; names truncate to one line with the full name on hover rather than reflowing the grid. In the transactions table a long group prefix ("Savings & investments ›") drops above its category menu rather than pushing the amount column out of the sheet.

## Elevation & Depth

Pencil on paper. Panels are drawn on the page, not laid on it: a 1px strong-rule line (an outline drawn just inside the edge, so it takes no room and sits over a tinted row or a sticky head) around a faint 35% wash of the sheet colour, through which the ruling shows. No shadow, no hover lift, no arrival motion. Inside a panel, separation is hairlines only. The cover rail casts a shadow onto the page. Things that float above the page (dialogs, hover tips, menus, the toast, the bulk-edit bar) stay solid with their floating shadow; the first-run screen's panels, outside the page, keep a solid sheet with the paper shadow.

### Shadow Vocabulary
- **Paper** (`--paper-shadow`: `0 1px 0 rgba(27,32,48,.03), 0 1px 2px rgba(27,32,48,.06), 0 12px 28px -16px rgba(27,32,48,.28)`; night: an inset 3% white top edge, `0 1px 2px` black at .4 and `0 14px 30px -16px` black at .75): the first-run screen's panels and the empty-state drawings only. Panels on the page have none.
- **Floating card** (`--shadow`: `0 2px 6px rgba(27,32,48,.06), 0 14px 34px rgba(27,32,48,.12)`; night uses black at .3/.45): hover tooltips, chart tips and dialogs.
- **Cover rail** (`6px 0 22px -8px rgba(12,17,34,.55)`): the rail onto the page.
- **Pressed cloth** (primary buttons): an inset 16% white top edge, a 2px contact shadow and a short soft drop; hover lifts 1px, pressed drops 1px with no shadow.
- **Control**: buttons `0 1px 1px rgba(27,32,48,.05)`; inputs and selects an inset `0 1px 2px` at .05 and, on focus, a 3px indigo-ink ring at 18% alongside the outline.
- **Selected segment** (`box-shadow: 0 1px 2px rgba(27,32,48,.12)`): the active option in a range/segmented control.

### Named Rules
**The Hairline Rule.** Inside a panel, separate with a 1px rule, never a shadow. Panels on the page carry no shadow at all: if a panel needs one to stand out, it is on the wrong background.

**The Pencil Rule.** A panel is a pencil line around a faint wash, never a white sheet with a shadow; the ruling shows through it. Anything solid on the page is a control or something that floats (a dialog, a tip, a menu).

## Shapes

Quietly squared stationery. Panels have a 3px corner; buttons, inputs, icon buttons, dialogs and tooltips share a 6px corner; bill stamps are squares with a corner 16% of their size (about 3px), money-in stamps are round, so the shape says which way the money went without its colour; tags, pills and chips are fully round; the seal, dots and category icons are circles. Borders are 1px hairlines; the page header is a double rule (2px ink, then 1px at 30%); the month calendar's top edge is a 1.5px ink rule. Meters (budget bars and group meters) are 7px tall and fully rounded. The rail's right edge is stitched: a 1.5px dashed line in white at 17%, 5px in from the edge. Dashed outlines mean "not yet": future days, bills still due, budget suggestions. Inked stamps have slightly uneven edges (a small fractal-noise displacement, about 1.2px, and ink density mottled between 88% and 100%, three seeds so neighbours differ); the hand-drawn marks listed under Planner Details are the only other roughened things on the page.

## Components

### Buttons
Plain controls in the world's ink.
- **Shape:** 6px corners.
- **Primary:** pressed cloth: the cover texture over a gradient from cover indigo lightened 16% down to cover indigo (night: night-button, a lighter indigo so it reads on dark sheets), white 700 text, 0.5rem 0.95rem, with the pressed-cloth shadow.
- **Hover / Focus:** primary moves to the cover fold and lifts 1px; secondary's border darkens from strong rule to ink. Focus is a 2px indigo-ink outline offset 2px, keyboard only. Pressed buttons drop 1px.
- **Secondary:** solid sheet fill, strong-rule border, 500 ink text.
- **Icon button:** 34px square, muted icon, rule border; on/active uses the indigo wash.

### Chips and Tags
- **Style:** fully round pills at 0.68-0.8rem. Informational tags use indigo wash with indigo ink; meaning tags use a 14-15% mix of green or red over the sheet with the full colour as text.
- **Notice chip:** a 6px ink dot (amber for a problem that fixes itself, indigo for news) before the text, in a warn-wash or indigo-wash pill.

### Panels (cards / containers)
- **Corner Style:** 3px.
- **Background:** the sheet colour washed at 35% over the page paper (`--sheet`), so the ruling shows through; a panel inside a panel adds no second wash.
- **Shadow Strategy:** none (see Elevation).
- **Border:** a 1px strong-rule pencil line, drawn as an outline just inside the edge (`outline-offset: -1px`), so it takes no room and the panel's edges stay on the grid; goal, trip and watch cards darken it to pencil on hover.
- **Internal Padding:** one unit (22px), half a unit at the foot (the grid's rounding adds the rest); the panel head (label title left, links or controls right) is one unit tall with one unit under it. Ruled tables (Transactions, Bills) run edge to edge, the head row on the panel's top edge, a unit in from each side; the head row is see-through like the panel, and takes the panel's colour, opaque (`--sheet-head`), only while it is stuck to the top of the window (`.stuck`, set by App.jsx on scroll).
- **Ruled panels:** This month, ruled strips and ledgers split one panel into sections with hairlines instead of separate boxes (see The One Sheet Rule under Layout).

### Inputs / Fields
- **Style:** sheet fill, strong-rule 1px border, 6px corners, 0.5rem 0.75rem; standard selects, checkboxes and tabs (accent-color indigo).
- **Hover / Focus:** border moves to pencil; focus is the indigo outline plus a 3px indigo ring at 18%. In-place editors (category menus, nicknames, trip names) stay flat.
- **Suggested value:** dashed border, transparent fill, italic muted placeholder with "≈".
- **Ink and pencil (`<Est>`, `.est-fig`):** a known figure is ink; an estimated, partial or future one is wrapped in `<Est why="…">`, which renders it in Muted Ink with a 1px dashed underline and a `title` saying why (words only, no amounts). Put it inside an element Hide amounts blurs (`.amt`, `.tamt`, `<Amt>`). No "est" superscripts, italics or faded cells on figures. Charts keep their own dashed lines and fades.

### Navigation
- **Style:** the woven indigo cover rail (cloth over a gradient from a lighter fold at the top to cover indigo by 38%, and 18% darker at the foot), its stitched right edge and its shadow onto the page; seal and white 800 wordmark at the top (no dot or other mark after it; the vermillion seal is the only logo mark); items 0.95rem in cover ink with 18px line icons.
- **Icons only, open on hover:** the rail rests at 64px of icons (group headings drawn as stitches). Hovering it (after a 120ms pause, so a passing pointer doesn't flash it) or tabbing into it opens it to 220px over the page with a soft shadow; the page underneath never moves, so the grid snapping never reflows. Moving the pointer off it (or tabbing out) closes it; choosing a page keeps it open while the pointer is still on it.
- **States:** hover is a 6% white wash and white text, and the icon slides 2px right; active is a soft fold (cover fold lightened 14% at the top down to cover fold, with an inset white top edge and a small shadow) with white 700 text. Focus outline is white on the rail.
- **Active tab:** the active item is a divider tab standing out of the planner. Its fold (cloth over a light-to-fold gradient) is square on the right and continues into a fold-coloured end that crosses the stitched edge and overhangs the page by about 5px with a small rounded end; the stitch is covered where it passes. It is drawn outside the item (absolute, no layout change), so the page and the item's text never move. The rail therefore doesn't clip its overflow, except in windows shorter than 760px where it scrolls and the tab is cut at the rail's edge. The collapsed rail does the same around the icon.
- **Sync status:** at the rail's foot, one quiet line above the stitch and Settings: the refresh icon and "Synced 14 min ago" (0.8rem, rail ink), one button that checks Plaid now; while a sync runs the text reads "Checking for new data…" and only the icon spins. Its title explains how often Mizo Money checks. What a Refresh found ("3 new transactions", "Up to date…", banks needing attention) appears for a few seconds on the page header's title row, beside the update and "banks need attention" chips, the theme toggle and Hide amounts.
- **Narrow windows:** 64px rail, seal and icons only (the sync line shrinks to its icon, the time in its title); the active tab crosses the edge the same way.
- **Groups:** every rail group starts with the stitch (the same dashed line as above Plan and Settings), its heading under it; in the narrow rail the heading is the stitch itself.

### Planner Details (rule)
**The Decoration Budget.** Planner objects that mark something (stamps, wet-ink dots, the highlighter, the ribbon, margin notes, date blocks, pencil figures, the double rule, the cover cloth and the seal) keep their table and their one-meaning rule. A planner object appears only when it marks something true about the data, always means the same thing, and appears nowhere else. The test is one sentence: "this marks …". The Seal, Highlighter and Stamps rules are this rule applied to one object each.

Next to them, decoration is allowed, under a budget:
- It never imitates a meaning object: no stamp shapes, no green or red, no vermillion, and no highlighter swipe behind anything that doesn't need you.
- At most one decorative accent per sheet, and none inside tables, charts or figure areas.
- It never covers a figure or text you need to read (tape may sit behind a short label, like the month label), and never moves layout: absolutely positioned or pseudo-elements only, so the packed dashboard never reflows.
- It is quieter at night (tape at lower opacity and darker).
- It can be turned off: Settings › Journal › "Show washi tape and margin doodles" sets `data-decoration="off"` on `<html>`.

**Decoration in use** (the complete list; nothing else):
- **Washi tape:** behind the month calendar's month label (tape 1, the bullet-journal monthly header) and across the top edge of goal and trip cards (tapes 1 to 3 in turn). Page titles carry none. Translucent, multiply-blended in daylight, with jagged torn ends and a small fixed tilt per position.
- **Margin doodle:** one per page, a small pencil sketch right after the page title (so it never meets the header's actions); each journal has its own (star, moon, paper plane, sprig, cloud).
- **Pen underline:** a short hand-drawn line in the ink colour at about 50%, under dashboard board panel titles only.

The objects in use, and the one thing each marks:

| Object | Marks |
|---|---|
| Inked stamp | A dated fact that has happened: paid, received, reached, confirmed. |
| Dashed pencil box or outline | Not yet: a bill still due, money expected, a day ahead, a suggestion. |
| Wet-ink dot | A day's spending, sized by the amount (Reports' year at a glance). |
| Highlighter stroke under a figure | How much was spent that day in the month calendar: its length on the fixed spending ramp. |
| Highlighter | Something needs you. |
| Today's edge | Today: a 2px indigo-ink line across the top of today's day in the calendar, over the indigo wash. |
| Margin note | How a figure was worked out. |
| Date block | A day in the log. |
| Migrated arrow (>) | Money carried forward into the next month (a budget that rolls over). |
| Pencil figure (`<Est>`) | An estimated, partial or future figure. |
| Double rule | The top of a page. |
| Cover cloth | The binding: navigation, the lead figure and the main action. |
| Seal | The logo. |

The migrated arrow replaces the Repeat icon on Budget's rollover tag (`Migrate` in `ui.jsx`).

A new object needs a new row here before it is built, with a meaning no other row has. Two objects never share a meaning, and one object never takes a second.

**Materials are not objects.** The cloth weave, the paper grain, the dot grid, the panels' pencil lines, the uneven ink edges and the resting tilt of a stamp say what a thing is made of. They mark nothing and don't need to. They stay quiet (never the busiest thing on screen), they are the same everywhere, and they never vary to signal anything about one item.

**Hand-drawn marks are a material too.** The page header's double rule is drawn as two slightly wandering pen lines. The dashed "still due" stamps are hand-drawn pencil boxes and circles: strokes overshoot the corners and circles don't quite close, seeded per stamp so each keeps its shape (`web/src/hand.js`). The check icon is drawn by hand. Never roughened: figures, ink dots, meters, bars and chart lines.

**Refused:** handwriting fonts (The One Family Rule stands), binder rings, punched holes, paper clips, torn edges on panels, stickers and stains. Tape and doodles are no longer refused; they live under The Decoration Budget. Anything else from a stationery shop gets the budget's test.

### Standing Strip (signature)
One ruled sheet in three sections (1.5fr / 1fr / 1fr), each padded 1.35rem 1.5rem 1.4rem. Net worth sits on the cover cloth (a 135° gradient from the cover fold to cover indigo, darkening at the far corner; at night the fold at the top is lifted gently toward the journal's `--cloth-lift` (80% fold at the corner, 92% by the middle, so the green and red notes keep 4.5:1; the label there is rail ink mixed 40% with white) and a 1px white-at-10% inner edge keeps the cloth from merging with the page) in white at display size; its labels are cover ink, and green and red step lighter there (#8fe0b8, #ffa896) so deltas keep 4.5:1 on the indigo. The figure has no text shadow and nothing drawn behind it. Free to spend and spent this month follow at standing-figure size. Each has a tracked label above, a hover breakdown behind the figure, and **exactly one note** below it, so no two deltas ever contradict: net worth says what changed since your last visit ("−$1,584 since Sun", green/red; the 30-day change when nothing moved since then); free to spend gives a daily allowance ("$479 a day for the next 13 days": free to spend ÷ days left including today; "Nothing left to spend this month" at zero or below); spent compares flexible spending with an even budget pace ("$502 ahead of an even pace" in red, "$120 under an even pace" in ink) over "of $3,255 budgeted". Free to spend is the app's only "how much can I spend" number. Each figure remembers its value from the last visit (this browser, at least 2 hours ago): when it has changed, the number counts to its new value once (1.1s exponential ease-out).

### Month Calendar (signature)
The month as a wall calendar (`MonthSpread.jsx`), Sunday to Saturday under a 1.5px ink rule: a one-unit row of weekday heads, then a row per week. Each day is 3 × 2 units (66 × 44px), so every line of the calendar is a row or column of dots; its lines are strong-rule inset shadows. Days before the 1st and after the last day are hatched blanks (a 135° strong-rule hatch at 45%). The day number sits top-left (future days lighter). Each past day with spending shows its total as a whole-dollar figure (11.5px, 700, ink, `.amt` so Hide amounts blurs it) at the bottom left, about 10px up, and under it, on its own line, a highlighter stroke (6px tall, 4px from the bottom and left, `--hi` with `--hi-blend`, uneven 2px 5px 3px 4px corners, rotated -1.2°). The stroke's length follows the same fixed ramp as the spending steps in `server/spread.js` (`RAMP`, steps 1 to 7) for every month: 10px at the first step, the day's width less 8px at the top, so a big day looks the same in any month; it stays visible when amounts are hidden, and draws in once, left to right (0.6s, 18ms stagger by date). Days ahead show nothing there. Bills and paydays are 15px ink stamps (`Stamp.jsx`; 14px in the legend) in the day's top-right corner, beside the number, so they never meet the stroke. Once it has happened, a stamp is solid ink, indigo for a bill and green for money in, with the category's drawn line icon (the same icon as its category well; a card for card payments) knocked out in sheet colour, and slightly uneven ink edges. Bills are square, money in is round. While still due, it is an empty dashed pencil box (green dashed circle for money expected in), waiting for its stamp. A day with several items shows their count instead of an icon. The hover names each one beside a small stamp with the payee's initial. Inked stamps rest hand-pressed at a slight angle by column (-5°, every third 4°, every 4n+1 -2°); due boxes and legend stamps stay straight. Hovering a day scales its stamps to 1.12 and straightens them (0.3s); the hover tip lists what was spent and each bill or payday. Today takes the indigo wash with a 2px indigo-ink edge across its top. The head carries the month name on its tape, the "past"/"ahead" and "Bills still due" chips, and the month arrows; the legend ("Spent that day" with a short stroke swatch, then the three stamps) runs right under the calendar, in the next unit. On load, strokes draw in and stamps press in just after; while the month loads the same grid is drawn empty, so nothing moves.

On the dashboard it is the left section (23 units: 7 × 3 plus padding) of the **This month** panel (see This Month Panel). On Bills it runs the full width of its panel (days at least 3 units wide, wider when there's room, and 4 tall), with no figures or strokes: each day lists its bills and paydays in the day itself, like a wall calendar, one short line each (a small paid or due stamp, the payee cut to fit, the whole-dollar amount, green for money in; paid ones muted), up to three lines, or two and "+N more" when there are more. Clicking a day (`aria-pressed`) lists it in full in a section under the calendar; clicking it again or "Whole month" goes back. There is no separate list of the month's bills beside it: the table below has them all.

### Stamps (rule)
A stamp means **a dated fact that has happened** (paid, received), or, as a dashed pencil box, a dated one still to come. Use it only for that: never for categories, labels or statuses that can change (those use the category well, a tag or text). One shared component (`Stamp.jsx`) everywhere. Places it appears: the month calendar and replay; the Coming up rows on the dashboard and the bill lines in Bills' calendar days (a stamp at the start of each, square for a bill, round for money in); and the Bills page, where a bill whose latest charge has posted shows a 13px inked stamp with its date ("Paid Nov 1", "Received Nov 1") under the amount. A stamp can also read (`TextStamp` in `Stamp.jsx`): a small inked box, 3px corners, the word and date in sheet colour on a crisp layer over the ink. Two uses: a reached goal ("Reached Oct 2026", green, resting at -2°; "Reached" alone when the month can't be known) and a confirmed trip's dates (indigo, straight) on its card.

### Motion
Every movement uses one curve, `--ease: cubic-bezier(.16, 1, .3, 1)`, plays once on arrival, and respects reduced motion. No page transitions, springs or celebration.
- **The rule:** movement is opacity and transform. Lines and marks may draw in once with `clip-path` or `stroke-dasharray`, and the attention highlighter may grow `background-size` once. Nothing animates layout (width, height, top, left, margin), so the packed dashboard never reflows. Colour and shadow may fade (0.15s) on hover and state change; that isn't movement.
- **Two things may loop,** only while work is running, and both stop when it ends: the refresh icon while a sync runs (it spins) and the loading shimmer on placeholders.
- **The header settles:** the page header rises 8px and fades in (0.5s). Panels don't move: a box that moves can't be measured for the grid.
- **Attention swipe:** the highlighter draws behind the "Needs you" heading left to right (0.9s), only when something waits to be sorted.
- **Meters fill** from the left (0.9s).
- **Charts draw in:** the net worth line, wash and end point reveal left to right (1.3s) on arrival and again when the range changes, never on hover; cash flow bars rise from the baseline (0.8s, 45ms apart); allocation segments sweep round (0.9s); the projection band and lines reveal left to right; the hero trace draws in (1.4s).
- **Already in place:** the month calendar's strokes drawing in, the standing strip's since-last-visit count, Money flow's streams morphing between periods (0.48s, ease-out: each stream grows, shrinks or slides to its new size; new ones grow from nothing, gone ones shrink away; no draw-in on arrival) with a 0.22s hover focus, and the month replay drawing the month through when you press Replay.
- **Small transitions:** row hover backgrounds and segmented controls (0.15s), a card's pencil line darkening on hover (0.15s), the rail icon nudge (0.25s). Nothing scales or rotates on hover; the seal keeps its resting tilt.

### Charts
Lines are 2.75px with round joins and caps (net worth) or 2.5px (projection, replay); estimated runs stay dashed and lighter. Two fills are allowed, both quiet and both marking real ranges, never gloss:
- **Net worth wash:** under real (not estimated) runs only, a pencil hatch of 1px 45° indigo-ink lines 6px apart, fading out toward the baseline; estimated runs get no wash, so estimated still reads as estimated (a day without a sync leaves a narrow gap). The last point is ringed (5px sheet-coloured dot, 2.5px indigo stroke) over a 12px indigo halo at 16% that grows in once.
- **Projection band:** the range between the conservative and optimistic lines, indigo ink at 9%, behind the lines. A range is one hue: the expected line is solid indigo, the optimistic and conservative edges thin dashed indigo, each labelled at its right end with rate and value ("Expected 7% · $628.3K"); no legend, and colour never tells scenarios apart.
- **Axes:** ticks are round values from `niceTicks()` (`format.js`: 1, 2, 2.5 or 5 × 10ⁿ, the domain snapped to the outer ticks), labelled with `usdCompact(v, 1)`, never the range divided evenly. Cash flow bars sit at 72% opacity at night.
- **Allocation ring:** 18px thick, drawn at 164px with a soft drop shadow under it; the centre total is 16px.
- **Month by month (Reports):** no filled cells. Each month's figure carries a short 3px bar under it in ink dot at 28%, as long as its share of the row's largest month (not the highlighter, which is kept for what needs you); the section rows (Spending, Saving & debt) are plain tracked labels in ink on the row rule.

### Month Replay (Money flow)
The cash in everyday accounts at the end of each day, as one stepped indigo line (2.5px) across the month's day columns (weekends tinted, today washed), stepping at each day's centre where its stamps sit (the month calendar's stamps, up to 15px: round green for money in, square indigo for bills paid from these accounts, each with its category icon knocked out, an empty dashed box while expected). Days ahead are dashed and add only scheduled paydays and bills. Days with a big move to savings or investments (at least 6% of the chart's height) get a square indigo stamp with a down-into-tray mark knocked out in sheet colour. The legend shows the same stamps as the calendar's. The four biggest steps are labelled with the day's signed net change in ink (green only when the day's net is money in), naming an item only when it is most of the step; the lowest point is ringed. A readout above counts the day's cash and its parts, in order: paydays, bills, moved to savings or investments, moved in from your other accounts, everyday spending, and other changes, which together add up to the step. Replay draws the month through (3.2s, ease-out) with the readout counting along. It plays only when pressed: the month arrives drawn, so the readout shows today straight away. It respects reduced motion, and hover reads out any day.

### Year at a Glance (Reports › Year in review)
Twelve small month calendars in one section of the year's ledger (six across, four below 1250px): Sunday-first weeks under a label and the month's spending, a 1px ink rule under each head, weekends tinted, today ringed in indigo ink. Each passed day carries one ink dot on the month calendar's eight-step ramp, shrunk to 62% so it fits; a passed day with nothing spent shows a 3px strong-rule point, days ahead nothing; no stamps. A month missing history from a bank has its dots faded and its total in pencil (`<Est>`). Each month is a button that opens Month by month reaching that month, with its column marked (indigo wash and top edge on the head, indigo hairlines down the cells so their own shading stays).

### Margin Notes
Explanations under figures ("48% of November has passed…", the `p.small.foot` notes on every page, `.mnote` elsewhere) are set like printed footnotes: a narrow column (40ch) at the panel's right margin, 0.76rem in Pencil (`--pencil`, a token of its own in light and both dark blocks), under a short 2.5rem pencil rule at 45%.

A **margin note explains this figure, not the chart.** Notes that say how a specific number was worked out stay on the page. "How to read this chart" text (the dot scale, what dashed means) lives in the legend's hover, because someone who checks in a few times a week shouldn't read the same paragraph every visit.

### Date Blocks (Transactions)
The table reads as a daily log: a left margin column holds each day's date block, the day number (1.15rem, 800) with the weekday beside it as a tracked label on one line, so a one-row day is one row tall; the day's net (green only for money in) sits under them only when the day has two or more rows, otherwise it is in the block's hover title; the block spans that day's rows and sticking under the table head while the day scrolls. A month heading (tracked label over a 1px ink rule) runs across when the month changes. The category column reads as plain text (muted group prefix, then the category); its menu (a native select laid over the text) shows a border and drawn chevron only on row hover or keyboard focus. Filters are one compact bar in a pencil panel: search taking the free width, small selects, and Show sweeps as a pill toggle.

### Bills Table
Full width, under the month calendar (no ink dots; each day's bills and paydays are also in its hover). Two groups in one ruled table: Bills, then Money in, each under its own column heads. The whole row is the control: click (or Enter) opens the editor beneath it, which also holds the rarer actions (Not a bill, Delete, Reset to detected), so rows carry no link stack. The schedule column shows the short rule ("27th monthly · business day") with the full sentence on hover; nothing in a row wraps past two lines. The line under a name gives the source only when it isn't "Detected" ("Card statement", "From Plaid", "Added by you"), so a detected bill just says "from Rewards Visa". A detected bill that matches one you added (same account, direction and schedule, next date within 3 days) is dimmed, left out of every total, and says so in one line with two choices: use this one instead, or they're different.

### Lead Band (Net worth)
The Net worth page opens with a full-width band of cover cloth (the standing strip's net worth cell on its own, `.standing.solo`): "Net worth today" at display size with the 30-day change under it, and at its right "You own" and "You owe" (figure size, white, tracked cover-ink labels), the two halves the Summary sheet breaks down. "What moved" calls income minus spending "Earned minus spent".

### Budget Page
"Not yet assigned" (budgeted income minus budgeted spending and saving) leads the page at 2.6rem 800 in its own panel above the table; it is a planning number, red as "Over assigned" when below zero. Remaining is plain text: ink, red with a real minus only when over, a muted "—" with no budget, muted "met" for saving at or above its budget; no pills. Totals are two rows, Total spending and Total saving (saving above plan reads "+$900 extra", never as over). Groups with no budget and no spending collapse into one muted "Not budgeted: …" line with Show. The side summary has separate Spending and Saving meters.

### Goals, Investments, Trips
Reached goals leave the card grid for a "Reached" ruled shelf on Plan (name, target, the Reached stamp, the ··· menu). Investments hides a figure or allocation half that has only one value (no "Retirement & HSA 0%", no "Taxable 100%"); holdings are seven columns, with Today holding the day's gain or loss over its % and the per-share change under Last price. Trips is the fourth tab of Reports; trip cards keep Edit and Delete in the ··· menu (`ActionMenu` in `Goals.jsx`), and the away setting is one ruled line ("Away means more than 100 miles from Seattle, WA. Change").

### Range Control
One segmented control picks a period: preset ranges (Last 30 days, Last 3 months) and a month stepper (‹ Nov 2026 ›) raised as one segment while a month is picked, the same stepping as Budget's month. Never one pill per month.

### Undo and Dialogs
Native browser dialogs are never used. Confirmations, notices and text prompts are a solid sheet in a modal `<dialog>` (`confirmDialog`, `notice`, `askText` in `ui.jsx`); the confirm button names the action ("Delete trip"), red text on a secondary button when it destroys something. An edit that can be reversed (a category, a rename, Not a bill) shows a toast on the cover cloth for 6 seconds with Undo, instead of asking first.

### This Month Panel
The dashboard's calendar panel: the month calendar on the left; beside it Needs you (only while something waits; the highlighter swipe stays) above Coming up (five items, three while something needs you, so the column ends with the calendar); across the panel under both, Budget (the four groups closest to their budget, in two columns, with which groups are over in its head). At 1440 × 900 the whole panel and the top of the board show without scrolling. The right column drops under the calendar only when the panel itself is narrower than about 800px, so at 1024 it still sits beside it. Budget names the groups that are over ("Utilities and Food are over", red) or says everything is within budget, never a "left of" total; rows are two units with hairlines; a drawn check and a muted "Nothing to sort." line when nothing waits. Saved layouts fold the old `glance` panel into it (`was` in `PANELS`, `renamePanels` in `layout.js`): hidden only if both were hidden, at the earlier of the two positions.

### Seal
A 30px vermillion circle with an inner hairline ring and a drawn "M" in seal ink, like a hanko, with a small drop shadow. It rests pressed at -7° and does not move on hover. Logo only.

## Do's and Don'ts

### Do:
- **Do** draw every panel as a 1px pencil line around a faint wash, 3px corners, no shadow; panels inside panels add no second wash.
- **Do** put every panel edge, section rule and row on the dot grid: whole-unit widths and gaps in CSS, heights left to `grid.js`.
- **Do** make neighbouring panels on one subject a single ruled panel (a ruled strip or a ledger).
- **Do** use Atkinson Hyperlegible Next for everything, with tabular figures.
- **Do** name panels with the tracked uppercase label (0.74rem, 800, 0.12em) as their title.
- **Do** mark estimated, partial or future figures with `<Est>` (muted, dashed underline, a reason on hover); in charts, dashed lines and outlines, faded partial months, no wash under estimated runs.
- **Do** keep motion to one arrival: fill or draw in once with `--ease`; panels never move. Move with opacity and transform; draw lines and marks with clip or stroke; never animate size. Only the refresh icon and the loading shimmer may loop, and only while work runs.
- **Do** give every dollar figure an amount class (`.amt`, `.tamt`, `.big`, or a covered table cell) so Hide amounts blurs it.
- **Do** draw icons as 1.8px-stroke line SVGs in currentColor, matching the navigation set.
- **Do** design light and dark together; dark keeps the indigo cover rail and uses its own validated steps.
- **Do** put the detail behind a figure in a hover card (dotted underline) rather than hiding it.
- **Do** give every planner object one meaning, listed in the Planner Details table, and use it only for that.
- **Do** take journal colours from tokens only; never hard-code a cover, paper or ink colour.

### Don't:
- **Don't** use green or red for anything but money in/out or good/bad.
- **Don't** use vermillion anywhere but the seal.
- **Don't** lay out a subject as a row of separate cards with dots showing between them.
- **Don't** put white sheets with shadows on the page or float anything but tips and dialogs on blurry shadows; don't add glossy gradients to charts, or fill a chart area with anything but the net worth hatch or the projection band.
- **Don't** use the highlighter for anything but attention: the "Needs you" heading and the banks chip.
- **Don't** add a second typeface or a system display face.
- **Don't** put a small line of label text above a heading as a kicker or eyebrow.
- **Don't** use text glyphs (×, ‹, ›, ●, ↻) as icons; draw them.
- **Don't** use more than four chart hues; the rest are grey.
- **Don't** design a phone layout; narrow windows collapse the rail and stack columns.
- **Don't** add decoration beyond the budget, or let decoration or texture become a signal.

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

- Short, specific subtitles: "Track savings targets by hand, or link a goal to an account and it follows the balance." (`web/src/Goals.jsx`).
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
