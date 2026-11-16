# Design review: task prompts (round 2)

Round 1 (net worth breakdown, month replay, stamps, Budget ledger, planner features) is done. This round covers the
rail, the index tabs, the paper around the sheets, and how DESIGN.md decides which planner details belong. Every task is now done, skipped
or tried and dropped (see Status). Each task has a prompt you can paste into a new session or hand
to a subagent, and a recommended model.

## Status

| Task | State | Note |
|---|---|---|
| 1. Earned Detail Rule | Done | In DESIGN.md (Planner Details), `.impeccable/design.json` and the surface contract. |
| 2. Index tabs | Done | Links to the last page used per section (`web/src/sections.js`), with a hover card of the section's pages. |
| 3. Wordmark dot | Done | Cover ink, no movement on hover. |
| 4. Active rail item | Done | The tab overhangs the stitch onto the page; `.side` is overflow: visible except below 760px tall, where the tab is cut at the rail edge. |
| 5. Sync status | Done | "Synced … ago" is the Refresh button at the rail foot; the sync summary shows briefly in the top bar. |
| 6. Stitched dividers | Done | |
| 7. Pressed wordmark | Skipped | Low value, and four other tasks were already changing the rail. |
| 8. Budget's empty spread | Done | Not a bug: it was the loading row before the data arrived. A failed request now says so instead of loading forever. |
| 9. Calm the paper | Done | `--dot` a third closer to the page colour in light and dark. |
| 10. Dog-ear | Skipped | As recommended. |
| 11. Margin line | Tried, dropped | It crowded the stamps and crossed every row hairline; the sheet read busier. |
| 12. Header bands | Skipped | They would read like the tinted group, weekend and hover rows. |
| 13. Unlinked transfers in Budget | Done | Option [a]: saving beyond plan is "met", not over. Net worth too: a transfer links to the account it names even when you categorized it, and accounts without history rewind money that arrived later, so it is not counted twice. |

## Models

| Model | Id | Use it for |
|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | Rules in DESIGN.md, logic that changes numbers, and design that needs judgement across files. |
| Sonnet 5.5 | `claude-sonnet-5-5` | A contained UI change with a clear brief: one component, one page, a few CSS rules. |
| Haiku 5.5 | `claude-haiku-5-5` | Copy, docs and one-line CSS fixes where the exact change is written down. |

## How to run these

- **Order:** Task 1 is in, and it is the rule the others are checked against. Next: Task 2 before Task 4 (both change
  how the rail and tabs meet), and Task 8 any time (it's a bug). The rest stand alone.
- **One writer per file.** Tasks 2-7 touch `web/src/App.jsx` and the rail rules in `styles.css`; run them one after
  another.
- **Owner decisions:** Tasks 10, 11, 12 and 13 need a choice from you before starting. Each says what the choice is.
- **New planner objects:** a task that adds one (only Task 10 here) adds its row to the Planner Details table in
  DESIGN.md first. Ruling and textures (Tasks 7, 9, 11, 12) are materials: they need no row, but must stay quiet.
- **Do not commit.** Leave changes in the working tree for review.

## Rules for every task (put these in front of every prompt)

```
Before you start, read CLAUDE.md, PRODUCT.md and DESIGN.md.
- Numbers don't change unless this task says so. Estimated or incomplete figures stay marked with <Est>.
- Green and red mean money in/out or good/bad only. Vermillion is the logo only. One typeface.
- A planner object appears only when it marks something true, with one meaning (DESIGN.md, Planner Details: the
  Earned Detail Rule and its table). Textures and ruling are materials: quiet, the same everywhere, never a signal.
- Every dollar figure stays blur-able by Hide amounts (.amt, .tamt, .big or <Amt>).
- Design light and dark together. A new colour needs a value in :root and in both dark blocks.
- No sideways scrolling at 1280px or 1440px. No phone layout. Respect reduced motion.
- Keep it generic: no real names, employers or account numbers (use Acme Corp, Alex Rivera, mask 3456).
- New logic gets a test in tests/ that fails without it. A new endpoint or page action gets one in tests/api.test.js.
- Append new CSS at the end of web/src/styles.css under /* ---------- Round 2: <task name> ---------- */.
- When done: npm test passes; npx vite build web --outDir ../../_tmpbuild succeeds (then delete _tmpbuild);
  with the app running, npm run check:ui passes. Look at the light and dark screenshots of the pages you changed.
  Update DESIGN.md for anything visual you add or change.
- Don't commit.
```

---

## A. The rule

### Task 1. Replace "refuses playfulness" with the Earned Detail Rule (done)

**What went in:** DESIGN.md's Overview now refuses decoration, not playfulness. A new "Planner Details (rule)" section
under Components holds the Earned Detail Rule, the table of objects and their one meaning, a "Materials are not
objects" clause (weave, grain, dot grid, paper shadow, uneven ink edges, a stamp's tilt), and a short refused list.
One Do and one Don't were added. `.impeccable/design.json` and `.impeccable/surfaces/web-src-app-jsx.md` carry the
same wording. No code changed.

**Different from the prompt below:** the table's "double rule" row says "the top of a page" (that is where the app
uses it), a dashed outline is one row meaning "not yet" (the Shapes section already says so), wet-ink dots and pencil
figures have rows, and there is no "proposed" dog-ear row: Task 10 adds it if it goes ahead.

**What breaks the rule today** (not fixed here):
- The wordmark's dot is vermillion (`.wm-dot` uses `var(--seal)`), which breaks the Seal Rule, and it hops on hover
  with a spring curve and a scale, which breaks the Motion rules (one curve, nothing scales on hover). Fixed in Task 3.
- The index tabs mark the section, so they pass the meaning test, but they are drawn as raised tabs and can't be
  pressed, and on the Dashboard, Plan and Settings none is raised. Task 2.
- The page's dot grid and grain are the busiest texture on screen; a material shouldn't be. Task 9.
- `.impeccable/design.json`'s narrative is older than DESIGN.md in other places (it still says sheets are flat with no
  shadows and estimated data gets a small "est"). Regenerate it from DESIGN.md when convenient.

The original prompt, for the record:

**Why:** DESIGN.md refuses "playfulness" as a whole, yet the app now has stamps, a ribbon, index tabs, margin notes and
date blocks, and they work because each one means something. A blanket ban doesn't explain why those are in and
binder rings are out; a rule about meaning does.

```
Edit DESIGN.md (Overview, Named Rules under Colors or a new "Planner details" section, and Do's and Don'ts) and
.impeccable/design.json if it repeats the wording. Don't change any code.

1. Replace "It also refuses ... playfulness ..." with: it refuses decoration. Keep the refusal of the bank-app look,
   spreadsheet density and hiding detail.
2. Add "The Earned Detail Rule": a planner object appears only when it marks something true about the data, always
   means the same thing, and appears nowhere else. If you can't say what it means in one sentence, it doesn't go in.
3. Add a table of the planner objects in use and their one meaning:
   cover cloth = navigation and the lead figure; stamp = a dated fact that has happened (paid, received, reached,
   confirmed); dashed stamp = due; highlighter = needs you; ribbon = today; index tab = section; margin note = how a
   figure was worked out; date block = a day in the log; double rule = a page or a total closing; seal = the logo.
   Leave a row for "dog-ear = changed since your last visit" marked "proposed (Task 10)".
4. List what's refused because it marks nothing: binder rings, punched holes, washi tape, paper clips (unless the app
   gains attached notes, where a clip would mean "attached"), perforated or torn edges, elastic closures, stickers,
   handwriting fonts, coffee stains.
5. Check the current app against the table and list anything that breaks it at the end of your reply (for example the
   vermillion dot after the wordmark, which breaks the Seal Rule). Don't fix them here.
Follow DESIGN.md's own voice: plain, short, no em dashes in sentences.
```

---

## B. The rail and the index tabs

### Task 2. Make the index tabs clickable (M, Sonnet 5.5)

**Why:** the tabs on the page's right edge look like raised buttons but have `pointer-events: none`, so clicking does
nothing. On the Dashboard, Plan and Settings no tab is raised, so they read as decoration. Under the Earned Detail
Rule an index tab marks "the section you are in", so it must do that on every page it shows on. If you'd rather not
have a second way to navigate, the other honest fix is to remove the tabs and their section in DESIGN.md.

```
Rework the index tabs (SECTIONS and the .idxtabs markup in web/src/App.jsx; .idxtabs/.idxtab in styles.css;
"Index Tabs" in DESIGN.md).
1. Five tabs: Today (the dashboard), Spending, Looking back, What you own, Plan. Settings stays in the rail only.
   The current section's tab is raised, so one tab is always raised except on Settings.
2. Each tab is a link to the last page you used in that section (remember it in localStorage per section, wrapped in
   try/catch; fall back to the section's first page). Today and Plan go to their one page.
3. Remove pointer-events: none and aria-hidden. The rail stays the main navigation: give the tabs tabindex="-1" and
   a title naming where they go, inside a <nav aria-label="Section tabs">, so keyboard users don't meet each link
   twice.
4. Hover: the tab slides out 3px (transform only, 0.2s, --ease) and a small hover card lists the section's pages,
   each clickable.
5. Keep them inside the page's right margin at 1100px and wider; check they never cover a page's top-right controls
   or a sheet's edge at 1280 and 1440.
Add a node:test for the "last page per section" helper if it's a function of its own.
```

### Task 3. The dot after the wordmark (done: cover ink)

**What went in:** `.wm-dot` is `var(--rail-ink)` on the rail and the text colour on the first-run screen; the hover
hop, its spring curve and the reduced-motion override are gone. DESIGN.md's Navigation section describes the dot.

**Your choice:** keep the dot in cover ink, or drop it. Recommended: cover ink, still. (Keeping it vermillion means
changing the Seal Rule, which isn't recommended.)

```
The wordmark "Mizo Money" ends with a vermillion dot (<i class="wm-dot"> in web/src/App.jsx and
web/src/PlaidSetup.jsx; .wm-dot in web/src/styles.css). DESIGN.md's Seal Rule says vermillion is the seal only, and
the dot hops on hover with a spring curve and a scale, which the Motion rules don't allow.
Apply the owner's choice: [cover ink | remove]. If kept: var(--rail-ink) on the rail and ink on the first-run screen,
and no hover movement (remove the transition, the hover rule and its reduced-motion override). Describe the wordmark
(the dot if kept) in DESIGN.md's Navigation section, which says only "white 800 wordmark".
```

### Task 4. The active rail item crosses the stitch (M, Opus 5.5, after Task 2)

```
Make the active rail item a tab that runs across the rail's stitched right edge and touches the page, like a divider
tab standing out of a planner, so the rail and the page read as one object.
- The active item's fold extends past the stitch by about 10px and meets the page with a small rounded end; the
  stitch breaks where it passes (a gap in the dashed line, not drawn over it).
- Its colour matches the raised index tab from Task 2, so the two read as the same cloth.
- No layout shift: the page doesn't move, and the item's text stays where it is. Transform/clip only if it animates.
- Collapsed rail (64px, below 1100px): the same, around the icon.
Light and dark. Update DESIGN.md Navigation.
```

### Task 5. Sync status at the rail's foot (M, Sonnet 5.5)

```
The top bar above every page holds "Updated 14 min ago", Refresh, the theme toggle and Hide amounts as loose icon
buttons. Move "Updated …" and Refresh to the rail's foot, as one line above Settings ("Synced 14 min ago" with the
refresh icon button; the icon spins only while a sync runs, as now). In the collapsed rail, only the icon with the
time in its title. Keep the theme toggle and Hide amounts where they are. The "banks need attention" chip stays in
the top bar (it's attention, so it stays where you look). Check the sync summary message still shows after Refresh.
```

### Task 6. One stitched divider between every rail group (S, Haiku 5.5)

```
In the rail (web/src/App.jsx RAIL, styles.css), the dashed stitch appears above Plan and Settings, but the named
groups (Spending, Looking back, What you own) are separated only by spacing. Put the same stitched divider (the dashed
line used above Plan, in cover ink at the same opacity) above every group, including the named ones, and keep the
group heading under it. In the collapsed rail the heading is already a divider: make it the same stitch.
```

### Task 7. Press the wordmark into the cloth (S, Sonnet 5.5, optional)

**Against the rule:** allowed. It is a material treatment (how the cloth takes the lettering), not an object. It adds
little; do it after Task 3 or not at all.

```
Set the rail's wordmark as if it were pressed into the cover cloth: a 1px darker text-shadow above
(rgba(0,0,0,.35) at 0 -1px) and a faint lighter one below (rgba(255,255,255,.08) at 0 1px), text in cover ink at
about 92% white rather than pure white. It must stay above 7:1 against the rail in both themes; measure it and report
the ratio. No gold or foil colours.
```

---

## C. The paper and the sheets

### Task 8. Budget's month spread renders as an empty sheet (S, Sonnet 5.5)

```
At the top of the Budget page (web/src/Budget.jsx), the compact month spread showed as an empty white sheet with only
its top rule in a headless Edge screenshot, while the dashboard's full spread rendered. Find out why (loading state,
an empty-data case, a CSS rule from round 1's ledger work hiding .spread.compact, or the screenshot timing) and fix
the real cause. If it's only timing, confirm with a screenshot after the page settles and change nothing. If the
spread can legitimately be empty, show the planner empty state instead of a blank sheet.
```

### Task 9. Calm the paper around the sheets (S, Sonnet 5.5)

```
The page's 22px dot grid plus grain is now the busiest texture on screen, busier than the sheets. Lower the dot
contrast by about a third in light and dark (the dot-grid tokens in styles.css :root and both dark blocks), and keep
the grain as it is. Compare screenshots of Dashboard, Budget and Reports before and after in both themes and keep
the change only if the dots are still visible on a normal laptop screen at 100% zoom. Update the Page Paper entry in
DESIGN.md.
```

### Task 10. A dog-ear for "changed since your last visit" (M, Opus 5.5, owner decision, not recommended)

**Against the rule:** the meaning is real ("changed since your last visit"), but the standing strip already says it in
words under each figure ("+$412 since Fri"), so the dog-ear would be a second object for one meaning. **Your choice:**
skip it (recommended), or build it and drop the "since" note from the sheets that get a fold, so one thing carries
the meaning. If it goes ahead, its row goes into the Planner Details table first.

```
The standing strip already remembers each figure from the last visit (this browser, at least 2 hours ago) and counts
to the new value. Extend that to whole sheets: a sheet whose figures changed since your last visit gets a small
folded corner at its top right (a 14px triangle in sheet-tint with a hairline fold and a tiny shadow under it, no
colour), shown on that visit only.
- Start with the dashboard's sheets that have a since-last-visit figure; don't add tracking to every panel.
- The fold's title says what changed in words ("Free to spend changed since Fri").
- It folds in once on arrival (transform/clip, 0.4s, --ease); reduced motion shows it still.
Add the row "Dog-ear = changed since your last visit" to the Planner Details table in DESIGN.md, and describe it
under Components.
```

### Task 11. A margin line on the dashboard's main sheet (M, Sonnet 5.5, owner decision)

**Your choice:** try it on the dashboard only, or skip it.

**Against the rule:** allowed. A margin line is ruling, like the hairlines, and it does a job (icons and stamps to its
left, text to its right). Keep it only if the sheet reads calmer with it than without.

```
Draw a single vertical indigo-ink hairline at 25% about 2.5rem in from the left edge of the dashboard's glance sheet
(the Coming up / Budget sheet), like the margin of ruled paper. Row icons and stamps sit in the margin to its left,
text starts to its right. Never red. If it crowds the rows at 1280px, drop it and report that. Screenshots in light
and dark.
```

### Task 12. Sheet headers as ruled bands (S, Sonnet 5.5, owner decision)

**Your choice:** apply to every panel header, only the glance sheet's sections, or skip it.

**Against the rule:** allowed as ruling, but on every panel it puts a tinted band on every sheet, which makes the
material louder everywhere. Recommended: the glance sheet only, or skip. Note the sheet tint already marks weekends,
group rows and hover rows; check a band doesn't read as one of those.

```
Panel headers (Panel in web/src/ui.jsx: tracked label left, links right) sit on the sheet with a hairline under them.
Give the header row a sheet-tint band running edge to edge of the sheet, with the hairline as its bottom edge, so each
section starts like a printed planner section. Sheets inside sheets don't get a band. Check every page with
npm run check:ui; nothing may shift by more than the band's padding.
```

### Task 13. Money moved to unlinked accounts in the Budget (M, Opus 5.5, owner decision)

**Found:** Budget shows "Spending & saving $28,267 spent, $24,721 over" this month, most of it one $28,000 transfer
to an unlinked brokerage account (categorized Savings & investments). **Your choice:** should a transfer to your
own unlinked account count against the savings budget?

```
On Budget, a large transfer to an unlinked account of your own (unpaired, Savings & investments) counts as savings
for the month and pushes "Spending & saving" far over. Apply the owner's choice:
[a] keep counting it, but show the line "Savings & investments" as met rather than over (saving more than planned
    isn't overspending), with green only for "met";
[b] leave one-off transfers above N× the category's average out of the savings actual, with a margin note naming
    them and a link to include them.
Change only server/budget.js and Budget.jsx. Add a test in tests/ for the chosen behaviour with a stand-in transfer
(mask 3456). Numbers elsewhere (net worth, reports) don't change.
```
