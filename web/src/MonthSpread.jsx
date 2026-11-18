import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2 } from './format.js';
import { Panel, Hover, TipList } from './ui.jsx';
import { Stamp, markIcon, initialOf } from './Stamp.jsx';

// The month spread: the whole month across the page like a planner's month view. Each past day carries one ink dot
// sized by what was spent (one fixed scale for every month, so a $200 day always looks the same); bills and paydays
// are stamped on their day in ink (Stamp.jsx: square for bills, round for money in, the category's drawn icon knocked
// out once it has happened, a dashed pencil box while still to come); days ahead carry a dashed placeholder.
export const SIZES = [0, 5, 8, 11, 15, 19, 24, 30]; // dot diameter per step of the fixed ramp (server/spread.js)
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dayName = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const shift = (m, n) => { const d = new Date(`${m}-01T00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-CA').slice(0, 7); };

// One stamp per direction per day: the category's icon, or how many when several fall on the same day.
const DayStamp = ({ kind, list, i }) => (
  <Stamp kind={kind} done={list.every((x) => x.done)} icon={markIcon(list[0])} count={list.length} ink={i} />
);
// In the hover, each bill or payday is named beside a small stamp with the payee's initial.
const tipName = (x) => (
  <span className="tipstamp"><Stamp kind={x.direction === 'in' ? 'in' : 'out'} done={x.done} label={initialOf(x.name)} className="mini" />{x.name}{x.done ? '' : ' (expected)'}</span>
);

function Day({ d, i, selected, onPick, dots }) {
  const outs = d.marks.filter((x) => x.direction !== 'in'), ins = d.marks.filter((x) => x.direction === 'in');
  const rows = [
    ...(dots && d.spent != null ? [['Spent', usd2(d.spent)]] : []),
    ...d.marks.map((x) => [tipName(x), `${x.direction === 'in' ? '+' : ''}${usd2(x.amount)}${x.estimate ? ' est' : ''}`]),
  ];
  const cls = `sday${d.future ? ' future' : ''}${d.today ? ' today' : ''}${d.weekend ? ' weekend' : ''}${selected ? ' sel' : ''}${onPick ? ' pick' : ''}`;
  // With onPick each day is a button (the Bills page lists the chosen day's bills beside it); the button takes focus,
  // so the hover wrapper doesn't add a second tab stop.
  const Tag = onPick ? 'button' : 'span';
  const pickProps = onPick ? { type: 'button', onClick: () => onPick(d.date), 'aria-pressed': selected, 'aria-label': dayName(d.date) } : {};
  return (
    <Hover className="quiet" tabbable={!onPick} tip={rows.length ? <TipList title={dayName(d.date)} rows={rows} /> : <TipList title={dayName(d.date)} note={d.future ? 'Nothing expected.' : 'Nothing spent.'} />}>
      <Tag className={cls} style={{ '--i': i }} {...pickProps}>
        {d.today && <i className="ribbon" aria-hidden="true" />}
        <span className="snum">{+d.date.slice(8)}</span>
        {dots && <span className="sink">{d.step > 0 ? <i className="amt" style={{ width: SIZES[d.step], height: SIZES[d.step] }} /> : d.future ? <i className="fut" /> : null}</span>}
        <span className="sstamps">
          {outs.length > 0 && <DayStamp kind="out" list={outs} i={i} />}
          {ins.length > 0 && <DayStamp kind="in" list={ins} i={i + 1} />}
        </span>
      </Tag>
    </Hover>
  );
}

// `month` makes the strip follow a page's own month (no arrows of its own, unless `onMonth` is given: then the arrows
// hand the new month back to the page); `onPick(date)` makes the days clickable and `selected` marks the chosen one. Same data (/month-spread) and
// the same dot scale either way.
// `dots={false}` renders it stamps-only (the Bills page: no spending dots, no "Spent that day" in the legend).
export default function MonthSpread({ month: fixed, onMonth, selected, onPick, dots = true }) {
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [own, setOwn] = useState(thisMonth);
  const month = fixed ?? own, setMonth = onMonth ?? setOwn, nav = fixed == null || onMonth != null;
  const [d, setD] = useState(null);
  // A failed request says so instead of leaving the loading row up for good.
  useEffect(() => { let on = true; api(`/month-spread?month=${month}`).then((r) => on && setD(r)).catch(() => on && setD({ month, failed: true })); return () => { on = false; }; }, [month]);
  const due = d?.days ? d.days.flatMap((x) => x.marks.filter((m) => !m.done && m.direction !== 'in')).reduce((s, m) => s + m.amount, 0) : 0;
  const days = d?.failed && d.month === month ? <p className="small muted spreadfail">The month's days couldn't be loaded. Refresh the page to try again.</p>
    : d && d.month === month
    ? <div className={`sdays${dots ? '' : ' nodots'}`} style={{ '--n': d.days.length }} key={month}>{d.days.map((x, i) => <Day key={x.date} d={x} i={i} selected={x.date === selected} onPick={onPick} dots={dots} />)}</div>
    : <div className="sdays skelrow" aria-busy="true" />;
  return (
    <Panel className="spread" title={<>{monthName(month)}{month !== thisMonth && <span className="asof">{month < thisMonth ? 'past' : 'ahead'}</span>}
      {due > 0 && <span className="asof">Bills still due <b className="amt">{usd(due)}</b></span>}</>}
      actions={<span className="spreadnav">
        <span className="legend">
          {dots && <Hover tip="Dots use one size scale for every month, so busy days compare at a glance."><span><i className="lgdot" />Spent that day</span></Hover>}
          <span><Stamp kind="out" done icon="receipt" />Bill paid</span><span><Stamp kind="out" />Bill due</span><span><Stamp kind="in" done icon="arrowin" />Money in</span>
        </span>
        {nav && <>
          <button className="iconbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3L4.5 7l4 4" /></svg></button>
          <button className="iconbtn" onClick={() => setMonth(shift(month, 1))} disabled={month >= shift(thisMonth, 1)} aria-label="Next month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3l4 4-4 4" /></svg></button>
        </>}
      </span>}>
      {days}
    </Panel>
  );
}
