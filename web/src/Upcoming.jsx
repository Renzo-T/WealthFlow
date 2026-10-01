import { useState } from 'react';
import { shortDate } from './format.js';
import { billAmount, PaycheckPrompt } from './Bills.jsx';
import BillsCalendar, { billIcon } from './BillsCalendar.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { Panel, Hover, TipList } from './ui.jsx';

const inDays = (d) => {
  const n = Math.round((Date.parse(`${d}T00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00`)) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
};

// Upcoming bills with a compact month calendar on top. Clicking a day filters the list to that day.
export default function Upcoming({ items, max = 8 }) {
  const [day, setDay] = useState(null);
  const [dayItems, setDayItems] = useState([]);
  const rows = day ? dayItems.map((x) => ({ ...x, next_date: x.date, can_card: x.card })) : items.slice(0, max);
  return (
    <Panel title="Upcoming bills & income" actions={<a href="#/bills">Manage</a>}>
      <PaycheckPrompt compact onDone={() => window.location.reload()} />
      <BillsCalendar compact selected={day} onDay={(d, list) => { setDay(d); setDayItems(list); }} />
      <div className="small muted upnote">
        {day ? <>{new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · <button className="linkbtn" onClick={() => setDay(null)}>Show next 30 days</button></>
          : 'Next 30 days'}
      </div>
      {!day && items.length === 0 && <p className="small muted">Bills, autopays and paychecks show up here once they've repeated a couple of times on a steady schedule.</p>}
      {day && rows.length === 0 && <p className="small muted">Nothing due this day.</p>}
      {rows.map((r) => (
        <div className="trow" key={r.key + r.next_date}>
          <span className="rowicon" title={r.schedule ? `${r.schedule[0].toUpperCase()}${r.schedule.slice(1)}` : undefined}>
            <CategoryIcon {...billIcon({ ...r, card: r.can_card })} />
            <span className="tmain"><b>{r.name}</b><span className="small muted">{[r.frequency, r.account].filter(Boolean).join(' · ')}</span></span>
          </span>
          <span className="r"><span className={`tamt${r.direction === 'in' ? ' good' : ''}`} title={r.estimate ? 'Estimate: the amount varies' : undefined}>{billAmount(r)}{r.estimate && <sup className="est">est</sup>}</span>
            <div className="small muted" title={shortDate(r.next_date)}>{inDays(r.next_date)} · <span className={`kind ${r.direction === 'in' ? 'in' : ''}`}>{r.direction === 'in' ? 'Income' : 'Bill'}</span></div></span>
        </div>
      ))}
      {!day && items.length > max && <Hover tip={<TipList rows={items.slice(max).map((r) => [r.name, billAmount(r), shortDate(r.next_date)])} />}>
        <a className="small more" href="#/bills">+{items.length - max} more in the next 30 days</a></Hover>}
    </Panel>
  );
}
