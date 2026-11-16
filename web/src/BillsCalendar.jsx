import { useEffect, useState } from 'react';
import { api } from './api.js';
import { INCOME, SPENDING } from './format.js';
import { billAmount } from './Bills.jsx';
import { tipText, Chevron } from './ui.jsx';

const ymd = (d) => d.toLocaleDateString('en-CA');
const shift = (m, k) => { const [y, mo] = m.split('-').map(Number); return ymd(new Date(y, mo - 1 + k, 1)).slice(0, 7); };
export const billIcon = (b) => (b.card ? { group: 'Debt repayment', kind: 'card' } : { group: b.direction === 'in' ? 'Income' : b.grp, sub: b.category });

// Small month grid (inside Upcoming) with a dot on each day something is due (money out / money in). Clicking a day
// hands that day's bills to `onDay`; clicking it again clears the filter. The Bills page picks days on its month
// spread instead.
export default function BillsCalendar({ onDay, selected }) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [items, setItems] = useState([]);
  useEffect(() => { api(`/bills/calendar?month=${month}`).then(setItems).catch(() => {}); }, [month]);

  const day = selected;
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
  const by = items.reduce((acc, x) => ({ ...acc, [x.date]: [...(acc[x.date] ?? []), x] }), {});
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const pick = (d) => onDay?.(d === selected ? null : d, by[d] ?? []);

  return (
    <>
      <div className="calnav">
        <button className="linkbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><Chevron dir="left" /></button>
        <b className="small">{new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
        <button className="linkbtn" onClick={() => setMonth(shift(month, 1))} aria-label="Next month"><Chevron /></button>
      </div>
      <div className="calgrid compact">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="calhead">{d}</span>)}
        {cells.map((d, i) => d ? (
          <button key={d} className={`calday${d === today ? ' today' : ''}${d === day ? ' sel' : ''}${by[d] ? ' has' : ''}`} onClick={() => pick(d)}
            title={tipText(by[d]?.map((x) => `${x.name} ${billAmount(x)}`).join('\n'))}>
            {+d.slice(8)}
            {by[d] && <i className="caldots">{by[d].slice(0, 3).map((x, k) => <i key={k} style={{ background: x.direction === 'in' ? INCOME : SPENDING }} />)}</i>}
          </button>
        ) : <span key={`e${i}`} />)}
      </div>
    </>
  );
}
