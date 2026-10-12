---
name: Mizo Money
description: A personal finance dashboard kept like a cloth-bound Japanese stationery planner.
colors:
  cover-indigo: "#1e2a47"
  cover-fold: "#2b3b63"
  cover-ink: "#c5ccdd"
  indigo-ink: "#2d4a93"
  indigo-wash: "#e8ecf5"
  page-paper: "#f3f3ef"
  dot-grid: "#d6d9d3"
  sheet: "#ffffff"
  sheet-tint: "#f7f7f4"
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
  night-dot-grid: "#20252f"
  night-sheet: "#181c27"
  night-sheet-tint: "#1d2230"
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
    fontSize: "3.1rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "'Atkinson Hyperlegible Next', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.15rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
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

Money is kept the way a careful person keeps a Japanese stationery planner: a cloth-bound indigo cover down the left, calm ruled pages with a faint dot grid, ink-dark figures, and the month always in view. The page is the instrument. Hierarchy comes from size, weight and hairline rules, not from colour, shadow or decoration, so the few things that carry colour (money in, money out, something that needs you) are read at once.

Density is that of a well-used planner, not a spreadsheet: content sits on white sheets with ruled rows and fixed columns, figures align on equal-width digits, and every page opens under a dated header rule. The one authored moment is the month spread inking in on the dashboard; everything else simply appears. Light and dark are equals: dark is the same planner at night, with its own validated steps (the indigo cover stays), never an inversion.

The world refuses the category default of a white card grid with a blue accent, glossy area charts and soft shadows. It also refuses the bank-app look, playfulness, spreadsheet density and hiding detail.

**Key Characteristics:**
- An indigo cover rail holds the seal and the navigation; the page beside it is quiet paper with a 22px dot grid.
- One family (Atkinson Hyperlegible Next, chosen for legibility at small sizes) at four weights carries every level; figures are tabular everywhere.
- Hairline rules instead of shadows; 6px corners on every sheet and control.
- Tracked uppercase labels name panels and figures; they are the titles, never a line above one.
- The month spread: one ink dot per day on a fixed size ramp, bills and paydays stamped on their dates.
- Estimated, partial and future data are always marked (dashed, faded, "est").

## Colors

An ink-and-indigo planner palette on warm paper: nearly all of every screen is neutral, indigo marks the cover and interaction, and meaning colours are spent only on meaning.

### Primary
- **Cover Indigo** (cover-indigo; night: night-cover-indigo): the sidebar rail, the brand surface, and the primary button fill in light mode. The cloth binding of the planner.
- **Cover Fold** (cover-fold): the active navigation item and the primary button's hover; a lighter fold of the same cloth.
- **Indigo Ink** (indigo-ink): links, focus rings, the selected tab, the today marker in the spread, paid stamps, and budget meters. The pen colour of interaction.
- **Indigo Wash** (indigo-wash): selected-row and today tint, tag and chip fills, empty-state icon wells.

### Secondary
- **Seal Vermillion** (seal-vermillion, on seal-ink): the round "M" hanko logo and nothing else. It never marks meaning.

### Tertiary (meaning only)
- **Money In Green** (money-in): income, money received, under budget, done.
- **Money Out Red** (money-out): overspent, money out where it is a warning, errors, alerts.
- **Caution Amber** (caution-amber, with warn-wash): things that fix themselves or run ahead of pace; never a problem for the user to act on.
- **Chart Series** (series-1 to series-4, then series-rest grey): four hues checked for colour-blind separation in each theme, with night steps of their own. A fifth series is grey.

### Neutral
- **Page Paper** (page-paper) with **Dot Grid** (dot-grid): the page behind the sheets, dotted every 22px.
- **Sheet** (sheet) and **Sheet Tint** (sheet-tint): the white sheets content sits on; the tint marks weekends in the spread, day and group rows in tables, hover rows.
- **Rule** (rule) and **Strong Rule** (rule-strong): hairlines between rows and sections; the strong rule outlines inputs and buttons.
- **Ink** (ink): all text and figures, and the 1.5px header rule.
- **Muted Ink** (ink-muted): secondary text, labels on figures, column heads.
- **Pencil** (pencil): dashed stamps for bills still due, input hover borders.
- **Ink Dot** (ink-dot): the spending dots in the month spread.

### Named Rules
**The Meaning-Only Rule.** Green and red mean money in/out or good/bad, nothing else. Category icons are inked in indigo; only income and saving keep green.

**The Seal Rule.** Vermillion is the logo. If it appears anywhere but the seal, it is a mistake.

**The Four-Hue Rule.** Charts use series-1 to series-4 in order; anything beyond four is grey. The tint is a secondary cue; a label always carries identity.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with Segoe UI, system-ui, sans-serif)
**Body Font:** Atkinson Hyperlegible Next
**Label Font:** Atkinson Hyperlegible Next

**Character:** One Japanese gothic family, chosen for its equal-width figures, carries every level by size and weight alone (400, 500, 700, 800; Latin subsets only). It reads like a planner's printed ruling: plain, even, a little formal.

### Hierarchy
- **Display** (800, 3.1rem, 1.1, -0.03em): the lead figure only, net worth in the standing strip.
- **Headline** (800, 2.15rem, 1.1, -0.02em): the page title, which on the dashboard is the date.
- **Figure** (800, 1.95rem, 1.1): secondary headline figures (free to spend, spent this month, panel totals).
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

A fixed 220px cover rail on the left (64px, icons only, below 1100px; it never disappears) and a main page padded 1.5rem 2.5rem 3.5rem. Every page opens with a header whose bottom is a 1.5px ink rule; actions sit at its right, aligned to the rule.

The dashboard runs lead sheets full width (the standing strip, the month spread, the Needs you / Coming up / Budget sheet), then a packed board of panels: a three-column grid with 8px auto rows so each panel takes the height its content needs, never stretched to a neighbour. At 1440px and wider a 340px side column appears and the board beside it uses two wider columns. Other pages pair a main column with a 280-320px side sheet that drops below at 1099px.

Rhythm: 1rem between sheets; 1.15rem by 1.3rem inside them; list rows of about 0.42-0.6rem separated by hairlines. Desktop-first: narrow windows collapse the rail and stack columns; there is no phone layout.

**The Fixed Columns Rule.** Lists and tables are ruled rows with fixed columns; names truncate to one line with the full name on hover rather than reflowing the grid.

## Elevation & Depth

Flat. Depth comes from the page/sheet contrast and hairline rules, not shadows: sheets have a 1px rule border and no shadow. The only shadows are on things that float above the page, and one hairline lift on the selected segment of a segmented control.

### Shadow Vocabulary
- **Floating card** (`box-shadow: 0 2px 6px rgba(27,32,48,.06), 0 14px 34px rgba(27,32,48,.12)`; night uses black at .3/.45): hover tooltips and chart tips only.
- **Selected segment** (`box-shadow: 0 1px 2px rgba(27,32,48,.12)`): the active option in a range/segmented control.

### Named Rules
**The Hairline Rule.** Separate with a 1px rule, never a shadow. A sheet that needs a shadow to stand out is on the wrong background.

## Shapes

Quietly squared stationery. Sheets, buttons, inputs, icon buttons and tooltips share a 6px corner; stamps are 4px squares; tags, pills and chips are fully round; the seal, dots and category icons are circles. Borders are 1px hairlines; the page header rule is 1.5px ink; the month spread's top edge is a 1px ink rule. Dashed outlines mean "not yet": future days, bills still due, budget suggestions.

## Components

### Buttons
Plain controls in the world's ink.
- **Shape:** 6px corners.
- **Primary:** cover indigo fill (night: night-button, a lighter indigo so it reads on dark sheets), white 700 text, 0.5rem 0.95rem.
- **Hover / Focus:** primary moves to the cover fold; secondary's border darkens from strong rule to ink. Focus is a 2px indigo-ink outline offset 2px, keyboard only. Pressed buttons drop 1px.
- **Secondary:** sheet fill, strong-rule border, 500 ink text.
- **Icon button:** 34px square, muted icon, rule border; on/active uses the indigo wash.

### Chips and Tags
- **Style:** fully round pills at 0.68-0.8rem. Informational tags use indigo wash with indigo ink; meaning tags use a 14-15% mix of green or red over the sheet with the full colour as text.
- **Notice chip:** a 6px ink dot (amber for a problem that fixes itself, indigo for news) before the text, in a warn-wash or indigo-wash pill.

### Cards / Containers (sheets)
- **Corner Style:** 6px.
- **Background:** sheet on page paper.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px rule.
- **Internal Padding:** 1.15rem 1.3rem; panel header (label title left, links or controls right) 0.75rem above content.
- **Ruled sheets:** the standing strip and the glance sheet split one sheet into sections with vertical hairlines instead of separate cards.

### Inputs / Fields
- **Style:** sheet fill, strong-rule 1px border, 6px corners, 0.5rem 0.75rem; standard selects, checkboxes and tabs (accent-color indigo).
- **Hover / Focus:** border moves to pencil; focus is the indigo outline.
- **Suggested value:** dashed border, transparent fill, italic muted placeholder with "≈".

### Navigation
- **Style:** the indigo cover rail; seal and white 800 wordmark at the top; items 0.95rem in cover ink with 18px line icons.
- **States:** hover is a 6% white wash and white text; active is the cover fold with white 700 text. Focus outline is white on the rail.
- **Narrow windows:** 64px rail, seal and icons only.

### Standing Strip (signature)
One ruled sheet in three sections (1.5fr / 1fr / 1fr): net worth at display size, then free to spend and spent this month at figure size. Each has a tracked label above, a small muted line or delta below, and a hover breakdown behind the figure.

### Month Spread (signature)
The month across the full width, one column per day under a 1px ink top rule and vertical hairlines. Each past day carries one ink dot sized on a fixed eight-step ramp (0, 5, 8, 11, 15, 19, 24, 30px) shared by every month; days ahead carry an 8px dashed circle. Bills and paydays are 17px square stamps with the payee's initial (or a count): dashed pencil while due, solid indigo on wash once paid, green for money in. Weekends take the sheet tint; today takes the indigo wash with a 2px indigo top edge. On load, dots ink in (0.6s, cubic-bezier(.16,1,.3,1), 18ms stagger by date) and stamps press in just after; this is the app's one authored motion, and it respects reduced motion.

### Glance Sheet
Under the spread: Needs you, Coming up, Budget as three ruled sections of one sheet; rows separated by hairlines, a drawn check and a muted line when there is nothing to do.

### Seal
A 30px vermillion circle with an inner hairline ring and a drawn "M" in seal ink, like a hanko. Logo only.

## Do's and Don'ts

### Do:
- **Do** keep every sheet flat on the page with a 1px rule and 6px corners.
- **Do** use Atkinson Hyperlegible Next for everything, with tabular figures.
- **Do** name panels with the tracked uppercase label (0.74rem, 800, 0.12em) as their title.
- **Do** mark estimated, partial or future data: dashed lines and outlines, faded partial months, a small "est".
- **Do** give every dollar figure an amount class (`.amt`, `.tamt`, `.big`, or a covered table cell) so Hide amounts blurs it.
- **Do** draw icons as 1.8px-stroke line SVGs in currentColor, matching the navigation set.
- **Do** design light and dark together; dark keeps the indigo cover rail and uses its own validated steps.
- **Do** put the detail behind a figure in a hover card (dotted underline) rather than hiding it.

### Don't:
- **Don't** use green or red for anything but money in/out or good/bad.
- **Don't** use vermillion anywhere but the seal.
- **Don't** add drop shadows to sheets, or glossy gradients and area fills to charts.
- **Don't** add a second typeface or a system display face.
- **Don't** put a small line of label text above a heading as a kicker or eyebrow.
- **Don't** use text glyphs (×, ‹, ›, ●, ↻) as icons; draw them.
- **Don't** use more than four chart hues; the rest are grey.
- **Don't** design a phone layout; narrow windows collapse the rail and stack columns.
