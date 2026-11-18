import { usd, usd2, shortDate } from './format.js';
import { tipText, Est } from './ui.jsx';
import { billAmount } from './Bills.jsx';
import { Stamp, RowStamp, useStampedExit } from './Stamp.jsx';

// Under the month spread, the three things a check-in looks for, as ruled sections of one sheet: what needs you, what's
// coming up, and whether you're on budget. Each links to its page for the detail.
const inDays = (d) => {
  const n = Math.round((Date.parse(`${d}T00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00`)) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : shortDate(d);
};

// How many upcoming items "Coming up" lists; the Upcoming panel continues after them. With nothing to sort the
// "Needs you" column gives way and Coming up grows to match the Budget column's height.
export const comingCount = (todo = []) => (todo.length ? 5 : 7);

export default function Glance({ todo = [], upcoming = [], budgets, spentAll }) {
  const rows = useStampedExit(todo, (t) => t.key); // a kind of thing that got sorted holds its place for a stamp
  const caught = rows.length === 0;
  const groups = (budgets?.items ?? []).filter((b) => b.amount > 0);
  const spent = groups.reduce((s, b) => s + b.spent, 0);
  const over = groups.filter((b) => b.spent > b.amount + 0.5), list = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
  // The four groups closest to (or past) their budget; one that hasn't started yet says nothing at a glance.
  const watch = [...groups].sort((a, b) => b.spent / b.amount - a.spent / a.amount).slice(0, 4);
  return (
    <section className={`card glance${caught ? ' caught' : ''}`} aria-label="At a glance">
      {caught ? <p className="gcaught small"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>Nothing to sort.</p>
        : <div className="gsec">
          <div className="ghead needs"><h2>Needs you</h2></div>
          {rows.map(({ item: t, key, leaving }) => <a key={key} className={`grow glink stampable${leaving ? ' leaving' : ''}`} href={t.href} {...(leaving ? { 'aria-hidden': true, tabIndex: -1 } : {})}><span>{t.label}</span><span className="gmore" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg></span>{leaving && <RowStamp />}</a>)}
        </div>}
      <div className="gsec">
        <div className="ghead"><h2>Coming up</h2><a className="small" href="#/bills">Bills</a></div>
        {upcoming.length === 0 && <p className="gquiet small">Nothing due in the next 30 days.</p>}
        {upcoming.slice(0, comingCount(rows)).map((r) => (
          <div className="grow gbill" key={r.key + r.next_date}>
            <Stamp kind={r.direction === 'in' ? 'in' : 'out'} />
            <span className="gname" title={r.name}>{r.name}</span>
            <span className="small muted gwhen">{inDays(r.next_date)}</span>
            <span className={`tamt${r.direction === 'in' ? ' good' : ''}`}>{r.estimate ? <Est why="Estimate: the amount varies">{billAmount(r)}</Est> : billAmount(r)}</span>
          </div>
        ))}
      </div>
      <div className="gsec">
        <div className="ghead"><h2>Budget</h2><a className="small" href="#/budget">Budget</a></div>
        {groups.length === 0 ? <p className="gquiet small">No budget yet. <a href="#/budget">Set one up</a> and this shows how each group is tracking.</p> : <>
          <div className="gtotal small">{over.length > 0 ? <span className="bad">{list(over.map((b) => b.category))} {over.length === 1 ? 'is' : 'are'} over</span> : <span className="muted">Everything is within budget</span>}</div>
          {/* The standing strip's "spent" is every group; this counts budgeted groups only. Say so when they differ. */}
          {spentAll != null && Math.abs(spentAll - spent) >= 1 && <div className="gnote small muted">Budgeted groups only: <span className="amt">{usd(spent)}</span> of the <span className="amt">{usd(spentAll)}</span> spent this month.</div>}
          {watch.map((b) => {
            const p = b.amount ? (b.spent / b.amount) * 100 : 0;
            const pace = b.kind === 'flexible' && b.pace > 0 && b.pace < 1 ? b.pace : null; // same rule as the Budget page
            return (
              <div className="gbud" key={b.category} title={tipText(`${b.category}: ${usd2(b.spent)} of ${usd2(b.amount)}`)}>
                <span className="gname">{b.category}</span><span className="small muted amt">{usd(b.spent)} of {usd(b.amount)}</span>
                <span className="meter"><i className={p > 100 ? 'over' : ''} style={{ width: `${Math.min(100, p)}%` }} />
                  {pace != null && <b style={{ left: `${pace * 100}%` }} title="An even pace for today" />}</span>
              </div>
            );
          })}
        </>}
      </div>
    </section>
  );
}
