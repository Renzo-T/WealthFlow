import { usd, usd2, shortDate } from './format.js';
import { tipText, Est, meterFill } from './ui.jsx';
import { billAmount } from './Bills.jsx';
import { Stamp, RowStamp, useStampedExit, markIcon } from './Stamp.jsx';

// The dashboard's "This month" panel holds the calendar (MonthSpread.jsx) with these beside and under it: what needs
// you and what's coming up beside it, whether you're on budget under it. Each links to its page for the detail.
const inDays = (d) => {
  const n = Math.round((Date.parse(`${d}T00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00`)) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : shortDate(d);
};

// How many upcoming items "Coming up" lists, so the column ends with the calendar beside it; the Bills page continues
// after them. With nothing to sort, Coming up takes the room Needs you would have used.
export const comingCount = (todo = []) => (todo.length ? 3 : 5);

// Beside the calendar: Needs you (only while something waits to be sorted; nothing at all otherwise) above Coming up.
export function GlanceSide({ todo = [], upcoming = [] }) {
  const rows = useStampedExit(todo, (t) => t.key); // a kind of thing that got sorted holds its place for a stamp
  return (
    <>
      {rows.length > 0 && <div className="gpart">
        <div className="head needs"><h2>Needs you</h2></div>
        <div className="glist">
          {rows.map(({ item: t, key, leaving }) => <a key={key} className={`grow glink stampable${leaving ? ' leaving' : ''}`} href={t.href} {...(leaving ? { 'aria-hidden': true, tabIndex: -1 } : {})}><span className="gname">{t.label}</span><span className="gmore" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg></span>{leaving && <RowStamp />}</a>)}
        </div>
      </div>}
      <div className="gpart">
        <div className="head"><h2>Coming up</h2><a className="small" href="#/bills">Bills</a></div>
        {upcoming.length === 0 ? <p className="gquiet small">Nothing due in the next 30 days.</p> : <div className="glist">
          {upcoming.slice(0, comingCount(rows)).map((r, i) => (
            <div className="grow gbill" key={r.key + r.next_date}>
              <Stamp kind={r.direction === 'in' ? 'in' : 'out'} icon={markIcon(r)} ink={i} />
              <span className="gname" title={r.name}>{r.name}</span>
              <span className="small muted gwhen">{inDays(r.next_date)}</span>
              <span className={`tamt${r.direction === 'in' ? ' good' : ''}`}>{r.estimate ? <Est why="Estimate: the amount varies">{billAmount(r)}</Est> : billAmount(r)}</span>
            </div>
          ))}
        </div>}
      </div>
    </>
  );
}

// Under the calendar, across the panel: the budget groups closest to (or past) their budget, in two columns.
export function GlanceBudget({ budgets }) {
  const groups = (budgets?.items ?? []).filter((b) => b.amount > 0);
  const over = groups.filter((b) => b.spent > b.amount + 0.5), list = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
  // Same rule as the Budget page: red only when well over (more than $25 and 10%); a few dollars over is amber.
  const bigOver = (b) => b.spent - b.amount > Math.max(25, 0.1 * b.amount), alarm = over.some(bigOver);
  // The four groups closest to (or past) their budget; one that hasn't started yet says nothing at a glance.
  const watch = [...groups].sort((a, b) => b.spent / b.amount - a.spent / a.amount).slice(0, 4);
  return (
    <div className="msec gbudget">
      {/* Which groups are over sits in the head, beside the title, so the rows start right under it. */}
      <div className="head"><h2>Budget</h2>
        {groups.length > 0 && <span className="gtotal small">{over.length > 0 ? <span className={alarm ? 'bad' : 'muted'}>Over budget: {list(over.map((b) => b.category))}</span> : <span className="muted">Everything is within budget</span>}</span>}
        <a className="small" href="#/budget">Budget</a></div>
      {groups.length === 0 ? <p className="gquiet small">No budget yet. <a href="#/budget">Set one up</a> and this shows how each group is tracking.</p> : <>
        <div className="gbuds">
          {watch.map((b) => {
            const p = b.amount ? (b.spent / b.amount) * 100 : 0;
            const pace = b.kind === 'flexible' && b.pace > 0 && b.pace < 1 ? b.pace : null; // same rule as the Budget page
            const fill = meterFill(b.spent, b.amount); // past the budget the track stretches, so the overspend has a length
            return (
              <div className="gbud" key={b.category} title={tipText(`${b.category}: ${usd2(b.spent)} of ${usd2(b.amount)}`)}>
                <span className="gname">{b.category}</span><span className="small muted amt">{usd(b.spent)} of {usd(b.amount)}</span>
                <span className="meter"><i className={`${bigOver(b) ? 'over' : p > 100 ? 'ahead' : ''}${fill.split ? ' split' : ''}`} style={fill.style} />
                  {pace != null && <b style={{ left: `${pace * fill.scale * 100}%` }} title="An even pace for today" />}</span>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}
