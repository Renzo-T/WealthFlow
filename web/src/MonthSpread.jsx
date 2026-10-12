import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2 } from './format.js';
import { Panel, Hover, TipList } from './ui.jsx';

// The month spread: the whole month across the page like a planner's month view. Each past day carries one ink dot
// sized by what was spent (one fixed scale for every month, so a $200 day always looks the same); bills and paydays
// are stamped on their day as square seals with the payee's initial (stamped solid once paid, an outline while still to
// come); days ahead carry a dashed placeholder.
const SIZES = [0, 5, 8, 11, 15, 19, 24, 30]; // dot diameter per step of the fixed ramp (server/spread.js)
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dayName = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const shift = (m, n) => { const d = new Date(`${m}-01T00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-CA').slice(0, 7); };

// A stamp shows the payee's initial (or how many, when several fall on one day), like a seal pressed on the date.
const mark = (list) => (list.length > 1 ? list.length : (list[0].name.match(/[A-Za-z0-9]/)?.[0] ?? '').toUpperCase());

function Day({ d, i }) {
  const outs = d.marks.filter((x) => x.direction !== 'in'), ins = d.marks.filter((x) => x.direction === 'in');
  const rows = [
    ...(d.spent != null ? [['Spent', usd2(d.spent)]] : []),
    ...d.marks.map((x) => [`${x.name}${x.done ? '' : ' (expected)'}`, `${x.direction === 'in' ? '+' : ''}${usd2(x.amount)}${x.estimate ? ' est' : ''}`]),
  ];
  const cls = `sday${d.future ? ' future' : ''}${d.today ? ' today' : ''}${d.weekend ? ' weekend' : ''}`;
  return (
    <Hover className="quiet" tip={rows.length ? <TipList title={dayName(d.date)} rows={rows} /> : <TipList title={dayName(d.date)} note={d.future ? 'Nothing expected.' : 'Nothing spent.'} />}>
      <span className={cls} style={{ '--i': i }}>
        <span className="snum">{+d.date.slice(8)}</span>
        <span className="sink">{d.step > 0 ? <i className="amt" style={{ width: SIZES[d.step], height: SIZES[d.step] }} /> : d.future ? <i className="fut" /> : null}</span>
        <span className="sstamps">
          {outs.length > 0 && <i className={`stamp out${outs.every((x) => x.done) ? ' done' : ''}`}>{mark(outs)}</i>}
          {ins.length > 0 && <i className={`stamp in${ins.every((x) => x.done) ? ' done' : ''}`}>{mark(ins)}</i>}
        </span>
      </span>
    </Hover>
  );
}

export default function MonthSpread() {
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [d, setD] = useState(null);
  useEffect(() => { let on = true; api(`/month-spread?month=${month}`).then((r) => on && setD(r)); return () => { on = false; }; }, [month]);
  const due = d ? d.days.flatMap((x) => x.marks.filter((m) => !m.done && m.direction !== 'in')).reduce((s, m) => s + m.amount, 0) : 0;
  return (
    <Panel className="spread" title={<>{monthName(month)}<span className="asof">{month === thisMonth ? 'this month' : month < thisMonth ? 'past' : 'ahead'}</span></>}
      actions={<span className="spreadnav">
        <span className="legend">
          <span><i className="lgdot" />Spent that day</span>
          <span><i className="stamp out done" />Bill paid</span><span><i className="stamp out" />Bill due</span><span><i className="stamp in done" />Money in</span>
        </span>
        <button className="iconbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 3L4.5 7l4 4" /></svg></button>
        <button className="iconbtn" onClick={() => setMonth(shift(month, 1))} disabled={month >= shift(thisMonth, 1)} aria-label="Next month"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3l4 4-4 4" /></svg></button>
      </span>}>
      {d ? <>
        <div className="sdays" style={{ '--n': d.days.length }} key={month}>{d.days.map((x, i) => <Day key={x.date} d={x} i={i} />)}</div>
        <div className="sfoot small muted">
          <span>Spent so far <b className="amt">{usd(d.total)}</b></span>
          {due > 0 && <span>Bills still due <b className="amt">{usd(due)}</b></span>}
          <span className="sscale">Dots use one size scale for every month, so busy days compare at a glance.</span>
        </div>
      </> : <div className="sdays skelrow" aria-busy="true" />}
    </Panel>
  );
}
