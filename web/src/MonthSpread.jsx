import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2 } from './format.js';
import { Hover, TipList } from './ui.jsx';
import { Stamp, markIcon, initialOf } from './Stamp.jsx';
import useWidth from './useWidth.js';
import { unit } from './grid.js';

// The month as a wall calendar: Sunday to Saturday, its lines on the page's dot grid (each day whole units wide and 2
// tall). Each past day with spending shows the amount with a highlighter stroke under it, its length on one fixed scale
// for every month (so a $200 day always looks the same); a day's bills and paydays share one stamp in its top-right
// corner (Stamp.jsx: square for bills, round when money comes in, the category's drawn icon knocked out once it has
// happened, a dashed pencil box while something is still to come, a count when there are several). It reads without a
// legend: the figures are written out and the hover names each item. Days before the 1st and after the last day are
// hatched blanks. On the dashboard the head carries a one-line key for the stamps (money in, bill paid, due).
export const SIZES = [0, 5, 7, 10, 13, 16, 20, 24]; // dot diameter per step of the fixed ramp (server/spread.js): Reports' year at a glance
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const dayName = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const shift = (m, n) => { const d = new Date(`${m}-01T00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-CA').slice(0, 7); };
const firstWeekday = (m) => new Date(`${m}-01T00:00`).getDay();
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

// One stamp per day: round when money comes in that day (a payday is the day's news), square for bills only; inked once
// everything on it has happened; the category's icon for one item, how many for several.
const DayStamp = ({ list, i }) => (
  <Stamp kind={list.some((x) => x.direction === 'in') ? 'in' : 'out'} done={list.every((x) => x.done)} icon={markIcon(list[0])} count={list.length} ink={i} />
);
// In the hover, each bill or payday is named beside a small stamp with the payee's initial.
const tipName = (x) => (
  <span className="tipstamp"><Stamp kind={x.direction === 'in' ? 'in' : 'out'} done={x.done} label={initialOf(x.name)} className="mini" />{x.name}{x.done ? '' : ' (expected)'}</span>
);

// Bills writes each day's bills and paydays in the day: a short line each (a small stamp, the payee cut to fit, the
// whole-dollar amount, green for money in), three at most, or two and "+N more" on a crowded day.
const LINES = 3;
function DayLines({ marks }) {
  const shown = marks.length > LINES ? marks.slice(0, LINES - 1) : marks;
  return (
    <span className="clist">
      {shown.map((x, k) => (
        <span key={k} className={`cbill${x.direction === 'in' ? ' in' : ''}${x.done ? ' done' : ''}`}>
          <Stamp kind={x.direction === 'in' ? 'in' : 'out'} done={x.done} icon={x.done ? markIcon(x) : undefined} className="tiny" />
          <span className="cbname">{x.name}</span>
          <span className="cbamt amt">{x.direction === 'in' ? '+' : '−'}{usd(x.amount)}</span>
        </span>))}
      {marks.length > LINES && <span className="cmore">+{marks.length - shown.length} more</span>}
    </span>
  );
}

function Day({ d, i, selected, onPick, dots, list }) {
  const rows = [
    ...(dots && d.spent != null ? [['Spent', usd2(d.spent)]] : []),
    ...d.marks.map((x) => [tipName(x), `${x.direction === 'in' ? '+' : ''}${usd2(x.amount)}${x.estimate ? ' est' : ''}`]),
  ];
  const cls = `cday${d.future ? ' future' : ''}${d.today ? ' today' : ''}${selected ? ' sel' : ''}${onPick ? ' pick' : ''}`;
  // With onPick each day is a button (the Bills page lists the chosen day's bills under the calendar); the button takes focus,
  // so the hover wrapper doesn't add a second tab stop.
  const Tag = onPick ? 'button' : 'span';
  const pickProps = onPick ? { type: 'button', onClick: () => onPick(d.date), 'aria-pressed': selected, 'aria-label': dayName(d.date) } : {};
  return (
    <Hover className="quiet" tabbable={!onPick} tip={rows.length ? <TipList title={dayName(d.date)} rows={rows} /> : <TipList title={dayName(d.date)} note={d.future ? 'Nothing expected.' : 'Nothing spent.'} />}>
      <Tag className={cls} style={{ '--i': i }} {...pickProps}>
        <span className="cnum">{+d.date.slice(8)}</span>
        {/* What was spent, written in the day, with a highlighter stroke under it whose length follows the fixed ramp
            (server/spread.js), so a big day looks the same in every month. Days ahead show nothing here. */}
        {dots && d.step > 0 && <><span className="cspent amt">{usd(d.spent)}</span><i className="cstroke" style={{ '--s': d.step }} aria-hidden="true" /></>}
        {list ? d.marks.length > 0 && <DayLines marks={d.marks} /> : d.marks.length > 0 && <span className="cstamps"><DayStamp list={d.marks} i={i} /></span>}
      </Tag>
    </Hover>
  );
}

// The grid itself: weekday heads, then the weeks. While the month loads it draws the same grid empty, so nothing moves.
function Calendar({ month, days, selected, onPick, dots, list, cols }) {
  const lead = firstWeekday(month), n = days?.length ?? daysIn(month), cells = Math.ceil((lead + n) / 7) * 7;
  const fit = cols && { width: `calc(${cols.reduce((a, b) => a + b, 0)} * var(--u))`, gridTemplateColumns: cols.map((c) => `calc(${c} * var(--u))`).join(' ') };
  return (
    <div className="cal" style={fit || undefined} aria-busy={days ? undefined : 'true'}>
      {WEEKDAYS.map((w) => <span key={w} className="cdow" aria-hidden="true">{w}</span>)}
      {Array.from({ length: cells }, (_, c) => {
        const k = c - lead, d = days?.[k];
        if (k < 0 || k >= n) return <span key={`b${c}`} className="cday blank" aria-hidden="true" />;
        return d ? <Day key={d.date} d={d} i={k} selected={d.date === selected} onPick={onPick} dots={dots} list={list} /> : <span key={`e${c}`} className="cday" />;
      })}
    </div>
  );
}

// `month` makes it follow a page's own month (no arrows of its own, unless `onMonth` is given: then the arrows hand the
// new month back to the page); `onPick(date)` makes the days clickable and `selected` marks the chosen one. Same data
// (/month-spread) and the same spending scale either way. `dots={false}` renders it stamps-only (the Bills page).
// `aside` is a section beside the calendar (a node, or a function of the month's days), `below` full-width sections
// under both (each a node, or a function of the month's days); together they make one panel, ruled into sections.
// `list` writes the bills and paydays into the days and runs the calendar the full width of the panel (Bills).
// Bills runs the calendar the full width of its panel: every whole unit the panel has goes to a column, at least 3 each,
// and the units left after an even split go to the weekdays first (Monday on), where most bills fall. Lines stay on dots.
export function fitColumns(units) {
  const base = Math.max(3, Math.floor(units / 7)), cols = Array(7).fill(base);
  let extra = Math.max(0, units - 7 * base);
  for (const i of [1, 2, 3, 4, 5, 0, 6]) { if (!extra) break; cols[i] += 1; extra -= 1; }
  return cols;
}

export default function MonthSpread({ month: fixed, onMonth, selected, onPick, dots = true, list = false, aside, below, label = 'This month' }) {
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [own, setOwn] = useState(thisMonth);
  const month = fixed ?? own, setMonth = onMonth ?? setOwn, nav = fixed == null || onMonth != null;
  const [d, setD] = useState(null);
  const [fitRef, fitW] = useWidth(0);
  const cols = list && fitW > 0 ? fitColumns(Math.floor(fitW / unit())) : null;
  // A failed request says so instead of leaving the loading grid up for good.
  useEffect(() => { let on = true; api(`/month-spread?month=${month}`).then((r) => on && setD(r)).catch(() => on && setD({ month, failed: true })); return () => { on = false; }; }, [month]);
  const days = d && d.month === month && !d.failed ? d.days : null;
  const due = days ? days.flatMap((x) => x.marks.filter((m) => !m.done && m.direction !== 'in')).reduce((s, m) => s + m.amount, 0) : 0;
  const side = typeof aside === 'function' ? aside(days) : aside, foot = typeof below === 'function' ? below(days) : below;
  return (
    <section className={`card panel spread${side ? ' has-aside' : ''}${list ? ' listdays' : ''}`} aria-label={label}>
      <div className="mgrid">
        <div className="msec mcal"><div className="mcal-in">
          <div className="head">
            <h2><span className="mlabel">{monthName(month)}</span>{month !== thisMonth && <span className="asof">{month < thisMonth ? 'past' : 'ahead'}</span>}
              {due > 0 && <span className="asof">Bills still due <b className="amt">{usd(due)}</b></span>}</h2>
            {/* The key, on the dashboard: there the days carry only a figure and a stamp, so what the marks mean is written
                once in the head (Bills writes each bill out in its day and needs none). */}
            {!list && <span className="legend ckey" aria-hidden="true">
              <span><Stamp kind="in" done icon="arrowin" />Money in</span>
              <span><Stamp kind="out" done icon="receipt" />Bill paid</span>
              <span><Stamp kind="out" />Due</span>
            </span>}
            {nav && <span className="spreadnav">
              <button className="iconbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3L4.5 7l4 4" /></svg></button>
              <button className="iconbtn" onClick={() => setMonth(shift(month, 1))} disabled={month >= shift(thisMonth, 1)} aria-label="Next month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3l4 4-4 4" /></svg></button>
            </span>}
          </div>
          {d?.failed && d.month === month ? <p className="small muted spreadfail">The month's days couldn't be loaded. Refresh the page to try again.</p>
            : <div ref={list ? fitRef : undefined}><Calendar key={month} month={month} days={days} selected={selected} onPick={onPick} dots={dots} list={list} cols={cols} /></div>}
        </div></div>
        {side && <div className="msec mside"><div className="mside-in">{side}</div></div>}
      </div>
      {foot}
    </section>
  );
}
