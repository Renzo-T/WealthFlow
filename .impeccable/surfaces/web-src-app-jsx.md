---
version: 1
slug: "web-src-app-jsx"
primary_target: "web/src/App.jsx"
related_targets: ["web/src/styles.css","web/src/Dashboard.jsx"]
---

## Scope and mode
The whole Mizo Money app shell and its pages (web/src). Mode: Operate. Users check in briefly a few times a week
(where do I stand, what's due, am I on budget) and occasionally sit down to budget and review. Desktop-first; light
and dark are equals. Function, data and copy stay; this replaces the visual world.

## Constraints
Green/red only for in/out and good/bad; estimated or partial data stays marked; every amount stays blurrable by Hide
amounts; standard web controls (tables, selects, tabs, buttons); no phone layout. Avoid: bank-app look, playful,
spreadsheet-dense, and hiding detail.

## Direction contract
THESIS: Money kept like a well-kept Japanese stationery planner: a cloth-bound cover, calm ruled pages, the month always
in view. It refuses the category default of a white card grid with a blue accent and glossy area charts.

OWN-WORLD: Deep indigo cover (#1E2A47 family) as the sidebar rail and brand; a quiet off-white page with a faint dot
grid; ink-dark text; hairline rules instead of shadows; one vermillion round seal (an "M" hanko) as the logo only;
green/red reserved for meaning. One gothic family (M PLUS 1p, chosen for its equal-width figures) carries every level by size and weight;
tabular figures; tracked small-caps labels.

STORY: The visitor opens it, reads net worth and free-to-spend first, sees the month's shape at a glance (which days
cost, what's stamped ahead), notices anything that needs them, and leaves knowing they're OK.

FIRST VIEWPORT: Left, the indigo rail with the seal and navigation. Main: a dated header rule; one bordered strip with
net worth (largest figure), free to spend, and spent this month; below, the month spread across the full width, one
ink dot per day on a fixed size ramp, bills and paydays stamped on their dates, future days dashed, today tinted;
then three panels: Needs you, Coming up, Budget.

FORM: Planner Page, item 4 of my ordered list (1 trail maps, 2 FT pink, 3 transit maps, 4 stationery planner, 5
climbing topos, 6 nutrition label, 7 passport stamps). Seed key 7d6c00d6. Raises: fixed dot-size ramp (star atlas);
every month at the same scale (botanical folio); new things stay marked until seen (boarding pass); ruled rows and
fixed columns only (split-flap); one family for all hierarchy (Emigre). Signature move: the month spread; motion is
ink settling (dots and stamps fade/scale in once, in date order).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decision record
No file record of the roll or the pick exists: the decision-page logs (.impeccable/questions/03638023.log and
fddc3616.log) are empty or hold only a timeout; the evidence lives in this session's command output, quoted verbatim:
- concept-seed: "DIRECTION CONCEPT SEED (key: 7d6c00d6; mode: operate; source: api; approved pool: c3b204a1eed6; 306/564
  human-approved ...)" and "ASSIGNED INDEX: 4".
- serve-question --wait --key 03638023: "ANSWER: {"optionId":"assigned","steer":"","html":".impeccable/mocks/decision/
  assigned.html","buildPath":"code","buildPathFlipped":false}".
- concept-seed --kind assigned --from 7d6c00d6: "choice recorded".
Adaptations made with the user's direction: the date is the page title; M PLUS 1p replaced Zen Kaku Gothic New for
equal-width figures; the strip shows net worth, free to spend and spent against budget (income lives in Cash flow);
after the finish review: a Needs you / Coming up / Budget row under the spread and a packed two-column board below it.
