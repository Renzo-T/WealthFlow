import { usd, usd2, shortDate } from './format.js';
import { tipText } from './ui.jsx';
import { billAmount } from './Bills.jsx';

// Under the month spread, the three things a check-in looks for, as ruled sections of one sheet: what needs you, what's
// coming up, and whether you're on budget. Each links to its page for the detail.
const inDays = (d) => {
  const n = Math.round((Date.parse(`${d}T00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00`)) / 864e5);
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : shortDate(d);
};

export default function Glance({ todo = [], upcoming = [], budgets }) {
  const groups = (budgets?.items ?? []).filter((b) => b.amount > 0);
  const total = groups.reduce((s, b) => s + b.amount, 0), spent = groups.reduce((s, b) => s + b.spent, 0);
  return (
    <section className="card glance" aria-label="At a glance">
      <div className="gsec">
        <div className="ghead"><h2>Needs you</h2></div>
        {todo.length === 0 ? <p className="gquiet small"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>Nothing to sort. You're all caught up.</p>
          : todo.map((t) => <a key={t.key} className="grow glink" href={t.href}><span>{t.label}</span><span className="gmore" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg></span></a>)}
      </div>
      <div className="gsec">
        <div className="ghead"><h2>Coming up</h2><a className="small" href="#/bills">Bills</a></div>
        {upcoming.length === 0 && <p className="gquiet small">Nothing due in the next 30 days.</p>}
        {upcoming.slice(0, 5).map((r) => (
          <div className="grow" key={r.key + r.next_date}>
            <span className="gname" title={r.name}>{r.name}</span>
            <span className="small muted gwhen">{inDays(r.next_date)}</span>
            <span className={`tamt${r.direction === 'in' ? ' good' : ''}`}>{billAmount(r)}{r.estimate && <sup className="est">est</sup>}</span>
          </div>
        ))}
      </div>
      <div className="gsec">
        <div className="ghead"><h2>Budget</h2><a className="small" href="#/budget">Budget</a></div>
        {groups.length === 0 ? <p className="gquiet small">No budget yet. <a href="#/budget">Set one up</a> and this shows how each group is tracking.</p> : <>
          <div className="gtotal small"><b className="amt">{usd(spent)}</b> <span className="muted">of <span className="amt">{usd(total)}</span> budgeted</span></div>
          {groups.slice(0, 4).map((b) => {
            const p = b.amount ? (b.spent / b.amount) * 100 : 0;
            return (
              <div className="gbud" key={b.category} title={tipText(`${b.category}: ${usd2(b.spent)} of ${usd2(b.amount)}`)}>
                <span className="gname">{b.category}</span><span className="small muted amt">{usd(b.spent)} of {usd(b.amount)}</span>
                <span className="meter"><i className={p > 100 ? 'over' : ''} style={{ width: `${Math.min(100, p)}%` }} /></span>
              </div>
            );
          })}
        </>}
      </div>
    </section>
  );
}
