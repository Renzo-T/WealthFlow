# Design critique

A review of every page (light and dark, 1440px wide), November 2026. The "Planner Page" world itself is strong: indigo
cover, dot grid, stamps, one typeface. What reads as unfinished is around it: too much explaining, too many marker
types, browser-default controls, and the same fact shown different ways.

Figures below are described, not quoted, so no real data lives in this file.

---

## Critical

### 1. It explains itself everywhere
- Every page has an explanatory sentence under the title (Transactions: transfers show as one row; Bills: where bills
  come from and that your edits win). These are build notes, not subtitles.
- The net worth chart carries a four-line footnote explaining the dashed line. A dashed line plus an "est" tag on hover
  says the same thing.
- Settings › App wraps three checkboxes in roughly 180 words.

**Fix:** delete page subtitles, move explanations into hover tips (`Tip.jsx`), and limit each setting to one line of
help. Target: cut about 70% of the visible text.

### 2. The month calendar needs a legend to be read
- One dashboard day cell can hold a spend dot sized by amount, a paid-bill stamp with a count, a money-in badge, a
  dashed due box and future-day hatching: five marker types in about 60px, plus a legend.
- In dark mode the biggest spend dot is a large pale disc and the brightest thing on the screen.
- The calendar gets half the width while Coming up gets the other half and is mostly empty space between name and date.
  The split is backwards.
- An earlier version wrote each day's amount in the cell with a highlighter underline. That one could be read without a
  legend; the dots can't.

**Fix:** write the amount in the day again, keep at most one stamp per day (with a count), give the calendar about 60%
of the width and narrow Coming up.

### 3. Numbers on the same screen seem to disagree
- Net worth page: the header shows a gain "in the last 30 days" while "What moved your net worth", right below, shows a
  large red loss for "this month". Both are correct, but nobody reads the window labels. In a money app that kills trust.
- The same change is "▲ x% vs. 30 days ago" on the Dashboard and "+$x in the last 30 days" on Net worth. Pick one
  format.
- Plan: a goal that follows a checking account shows a large negative monthly pace, because bills and paydays move the
  balance. A meaningless alarming number is worse than none.

**Fix:** one time window per page (or the window stated in the figure itself), one format for change, and hide figures
known to mislead (pace on a goal that follows a checking account).

### 4. Browser controls inside a designed world
- Transactions filters are native `<select>` elements with the system chevron, the strongest "nobody designed this"
  signal in the app.
- Budget amounts sit in white bordered input boxes in every row, which looks like a spreadsheet, and show raw numbers
  (`9385`) with no $ or thousands separator while every other figure is formatted.
- Budget's "Today" is disabled grey but still drawn as a button.

**Fix:** a custom select (share the menu Jump uses); budget amounts as formatted text that becomes an input on hover or
focus; hide "Today" when you're already on this month.

---

## High impact

### 5. Buttons don't match from page to page
- Primary buttons (Add a bill, Connect a bank, Fill in suggestions) are dark and raised with a drop shadow, breaking
  DESIGN.md's rule that only floating things are solid.
- Transactions has two large secondary buttons (Download CSV, Edit multiple), each heavier than any other page's main
  action.
- The theme and hide-amounts buttons repeat in every page header. Move them to the rail footer or Jump so the header
  holds only the page's own action.

### 6. Table rows break the 2-unit rhythm
- Bills table: the amount column stacks up to three lines (amount, "Paid …", "Statement balance"), so rows jump between
  2 and 3 units. "Next statement" and long schedules ("27th monthly · business day") wrap.
- Bills › Due this month scrolls inside its panel. No nested scrolling: show 6 and add "Show all".
- Transactions: merchant names start at different x positions depending on whether the row has a brand logo or a
  category icon (about 6px apart). Some logos are unreadable at 16px. Use category icons everywhere, or logos only where
  they're legible, on one alignment.
- Category labels repeat themselves: "Travel › Travel", "Transfer › Transfer", "Insurance › Insurance". Leave out the
  group when it matches the subcategory.

### 7. The margin doodle reads as "favourite this page"
The journal doodle (a star in Indigo) sits right after every page title, where people expect a favourite/pin button and
will click it. Move it into the margin or onto empty states.

### 8. Every number gets two underlines (Reports)
In Month by month, figures carry a length bar plus a dashed "not final" underline. Keep the bar and show "not final"
in pencil grey, per DESIGN.md's ink/pencil rule. A column that's all dashes (a month before any history) should be
dropped, not shown empty.

### 9. Money flow's default view tells the wrong story
"From account balances" and "Savings & investments" take most of the Sankey, so the default says "you moved money
around" rather than "where your pay went". Default to income-only flow; leave the shuffling to "Through accounts".

### 10. Investments: the second-largest bucket is "Other"
An index fund inside an employer plan lands in "Other" (a near-invisible light grey bar) at over a third of the
portfolio. Classify employer-plan index funds (`holdingKind`) so the biggest slice has a real name and colour.

---

## Nice to have

- **Plan headline numbers are empty states.** "0 of 1", "—" and "Add a date to a goal to see this" take the most
  prominent spot. Hide a figure until it has a value.
- **Washi tape floating between panels on Plan** looks like a rendering glitch. Pin tape to a panel edge or drop it there.
- **Budget alarm doesn't scale.** A category a few dollars over gets red header text ("Utilities is over", also ungrammatical)
  and a full red bar. Scale the alarm to how far over it is.
- **"Nothing to sort." on the dashboard** is a dead row. Hide it when there's nothing to sort.
- **Rail active state** overhangs the rail edge onto the paper. If it's meant as a tab, give it a notch; otherwise
  keep it inside the rail.
- **Investments holdings:** "as of <date>" repeats on every row, and "+$0.00 0.00%" for funds without intraday prices is
  noise. Show the date once in the header and a dash for no change data.
- **Month replay legend** has nine items in one line (Cash, Ahead, Cushion, $0, Money in, Bill paid, Bill due, Moved to
  savings, plus Replay). Label lines directly on the chart and keep the legend to the stamps.
- **Comparison line** on the dashboard ("You've spent $x less than this time last month…") opens with a bare ▼
  disclosure triangle. Use the drawn `Chevron` and make the whole line the toggle.

---

## If only three get done
1. Cut the copy (Critical 1).
2. Make the calendar readable without a legend (Critical 2).
3. Stop the numbers from disagreeing (Critical 3).
