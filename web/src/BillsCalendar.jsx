import { useEffect, useState } from 'react';
import { api } from './api.js';
import { INCOME, SPENDING } from './format.js';
import CategoryIcon from './CategoryIcon.jsx';
import { billAmount } from './Bills.jsx';
import { Panel } from './ui.jsx';

const ymd = (d) => d.toLocaleDateString('en-CA');
const shift = (m, k) => { const [y, mo] = m.split('-').map(Number); return ymd(new Date(y, mo - 1 + k, 1)).slice(0, 7); };
export const billIcon = (b) => (b.card ? { group: 'Debt repayment', kind: 'card' } : { group: b.direction === 'in' ? 'Income' : b.grp, sub: b.category });

// Month grid with a dot on each day something is due (violet = money out, green = money in).
//   full (Bills page): bigger cells, clicking a day lists what's due under the grid.
//   compact (dashboard, inside Upcoming): small cells; clicking a day hands that day's bills to `onDay`,
//   clicking it again clears the filter.
export default function BillsCalendar({ compact = false, onDay, selected }) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [items, setItems] = useState([]);
  const [own, setOwn] = useState(null);
  useEffect(() => {
    api(`/bills/calendar?month=${month}`).then((r) => {
      setItems(r);
      if (!compact) setOwn(r.find((x) => x.date >= today)?.date ?? r[0]?.date ?? null);
    });
  }, [month, today, compact]);

  const day = compact ? selected : own;
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
  const by = items.reduce((acc, x) => ({ ...acc, [x.date]: [...(acc[x.date] ?? []), x] }), {});
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const pick = (d) => (compact ? onDay?.(d === selected ? null : d, by[d] ?? []) : setOwn(d));
  const list = day ? by[day] ?? [] : [];

  const grid = (
    <>
      <div className="calnav">
        <button className="linkbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month">‹</button>
        <b className={compact ? 'small' : undefined}>{new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
        <button className="linkbtn" onClick={() => setMonth(shift(month, 1))} aria-label="Next month">›</button>
      </div>
      <div className={`calgrid${compact ? ' compact' : ''}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="calhead">{d}</span>)}
        {cells.map((d, i) => d ? (
          <button key={d} className={`calday${d === today ? ' today' : ''}${d === day ? ' sel' : ''}${by[d] ? ' has' : ''}`} onClick={() => pick(d)}
            title={by[d]?.map((x) => `${x.name} ${billAmount(x)}`).join('\n')}>
            {+d.slice(8)}
            {by[d] && <i className="caldots">{by[d].slice(0, 3).map((x, k) => <i key={k} style={{ background: x.direction === 'in' ? INCOME : SPENDING }} />)}</i>}
          </button>
        ) : <span key={`e${i}`} />)}
      </div>
    </>
  );
  if (compact) return grid;

  return (
    <Panel className="cal" title="Calendar">
      {grid}
      <div className="callist">
        {day && <div className="small muted" style={{ margin: '.5rem 0 .25rem' }}>{new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>}
        {list.length === 0 && <p className="small muted">{items.length ? 'Nothing due this day.' : 'No bills due this month.'}</p>}
        {list.map((x) => (
          <div className="trow" key={x.key + x.date}>
            <span className="rowicon"><CategoryIcon {...billIcon(x)} size={28} /><b className="small">{x.name}</b></span>
            <span className={`tamt small${x.direction === 'in' ? ' good' : ''}`}>{billAmount(x)}{x.estimate && <sup className="est">est</sup>}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
