import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Progress from './Progress.jsx';
import { usd } from './format.js';
import AccountOptions from './AccountOptions.jsx';
import { Panel, PageHeader, EmptyState, PageSkeleton, Hover, TipList } from './ui.jsx';

const pct = (g) => (g.target ? Math.round((g.saved / g.target) * 100) : 0);
const monthYear = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
// Whole months from today until a date (at least 1, so "due this month" still divides).
const monthsUntil = (d) => {
  const now = new Date(), end = new Date(`${d}T00:00`);
  return Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth());
};
const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + Math.ceil(n)); return d.toLocaleDateString('en-CA'); };

// What it takes: the monthly amount to reach the target by its date, and (for a linked account) when the
// recent pace would get there.
function plan(g) {
  const left = g.target - g.saved;
  if (left <= 0) return { done: true };
  return {
    monthly: g.target_date ? left / monthsUntil(g.target_date) : null,
    eta: g.pace > 1 ? addMonths(left / g.pace) : null,
  };
}

function Spark({ data }) {
  if (!data?.length || Math.max(...data) - Math.min(...data) < 1) return null;
  const lo = Math.min(...data), span = Math.max(...data) - lo;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(1)},${(30 - ((v - lo) / span) * 26).toFixed(1)}`).join(' ');
  return <svg className="goalspark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" style={{ stroke: 'var(--blue)' }} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

// The add/edit form: name, target, optional date, and either an account to follow or an amount saved so far.
function GoalForm({ initial, accounts, onSave, onCancel, submit }) {
  const [f, setF] = useState({ name: '', target: '', saved: '', account_id: '', target_date: '', ...initial });
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="form goalform" onSubmit={(e) => {
      e.preventDefault();
      // A goal that follows an account takes its amount from the balance, so the hidden "saved" isn't sent.
      const { saved, ...rest } = f;
      onSave(f.account_id ? rest : { ...rest, saved: saved === '' ? 0 : saved });
    }}>
      <label className="lbl">Goal<input value={f.name} onChange={on('name')} placeholder="Emergency fund" required /></label>
      <label className="lbl">Target<input type="number" min="1" step="any" value={f.target} onChange={on('target')} placeholder="10000" required /></label>
      <label className="lbl">By (optional)<input type="date" value={f.target_date ?? ''} onChange={on('target_date')} /></label>
      <label className="lbl">Follows an account
        <select value={f.account_id ?? ''} onChange={on('account_id')}>
          <option value="">No, I'll enter amounts</option>
          <AccountOptions accounts={accounts} />
        </select></label>
      {!f.account_id && <label className="lbl">Saved so far<input type="number" min="0" step="any" value={f.saved} onChange={on('saved')} placeholder="0" /></label>}
      <button className="btn primary" type="submit">{submit}</button>
      {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

// One goal as a card: saved amount, progress, what's left, the monthly amount needed by its date, and
// (for a linked account) the recent pace and when it would get there.
function GoalCard({ g, accounts, reload, compact }) {
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState('');
  const p = compact ? {} : plan(g);
  const done = g.saved >= g.target;
  const save = async (f) => {
    const r = await api(`/goals/${g.id}`, { method: 'PATCH', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setEdit(false); reload();
  };
  const remove = async () => { if (window.confirm(`Remove the goal "${g.name}"?`)) { await api(`/goals/${g.id}`, { method: 'DELETE' }); reload(); } };
  if (edit) return (
    <div className="card goal">
      <GoalForm initial={{ ...g, saved: g.account_id ? '' : g.saved, target_date: g.target_date ?? '', account_id: g.account_id ?? '' }} accounts={accounts}
        onSave={save} onCancel={() => setEdit(false)} submit="Save" />
      {err && <p className="bad small">{err}</p>}
    </div>
  );
  return (
    <div className={`card goal${done ? ' done' : ''}`}>
      <div className="row base"><b>{g.name}</b>{done ? <span className="donepill">Reached ✓</span> : <span className="small muted">{pct(g)}%</span>}</div>
      <div className="big amt">{usd(g.saved)}</div>
      <div className="small muted">of {usd(g.target)}{g.account ? ` · follows ${g.account}` : ''}</div>
      <Progress value={g.saved} max={g.target} />
      <div className="small"><span className={`amt ${done ? 'good' : 'muted'}`}>{done ? `${usd(g.saved - g.target)} past the target` : `${usd(g.target - g.saved)} to go`}</span></div>
      {!compact && <div className="goalplan small">
        {g.target_date && !done && <div><span className="muted">By {monthYear(g.target_date)}</span><b className="amt">{usd(p.monthly)} a month</b></div>}
        {g.account_id && g.pace != null && <div><span className="muted">
          <Hover className="quiet" tip={<TipList title="Recent pace" rows={[['Change per month', `${g.pace >= 0 ? '+' : '−'}${usd(Math.abs(g.pace))}`]]}
            note={`${g.account}'s balance over the last 3 months${g.estimated ? ', partly estimated from transactions' : ''}.`} />}>Recent pace</Hover></span>
          <b className={`amt ${g.pace > 1 ? 'good' : ''}`}>{Math.abs(g.pace) < 1 ? 'no change' : `${g.pace > 0 ? '+' : '−'}${usd(Math.abs(g.pace))} a month`}</b></div>}
        {p.eta && <div><span className="muted">At that pace</span><b>{monthYear(p.eta)}</b></div>}
        {!g.target_date && !done && <button className="linkbtn" onClick={() => setEdit(true)}>Add a date to see what it takes each month</button>}
      </div>}
      {!compact && <Spark data={g.spark} />}
      {!compact && <div className="row small goalfoot">
        {!g.account_id ? <label className="muted">Saved <input className="mini" type="number" min="0" step="any" defaultValue={g.saved}
          onBlur={(e) => Number(e.target.value) !== g.saved && save({ saved: e.target.value })} aria-label={`Saved for ${g.name}`} /></label> : <span />}
        <span className="btnrow"><button className="linkbtn" onClick={() => setEdit(true)}>Edit</button><button className="linkbtn" onClick={remove}>Remove</button></span>
      </div>}
    </div>
  );
}

export function GoalsPanel({ items }) {
  return (
    <Panel title="Goals" actions={<a href="#/goals">Manage</a>}>
      {items.length === 0 && <EmptyState icon="plan" title="Saving for something?" actions={<a className="btn linkbtn-solid" href="#/goals">Add a goal</a>}>
        Set a target, optionally tied to an account, and watch it fill up.</EmptyState>}
      <div className="goalgrid">{items.slice(0, 4).map((g) => <GoalCard key={g.id} g={g} compact />)}</div>
    </Panel>
  );
}

// Ideas for new goals, sized from your own spending and trips.
function Ideas({ ideas, start }) {
  const list = [
    ideas.emergency3 && ['Emergency fund', ideas.emergency3, `3 months of your spending (about ${usd(ideas.monthlySpend)} a month)`],
    ideas.emergency6 && ['Emergency fund', ideas.emergency6, '6 months of spending: the usual advice if your income varies'],
    ideas.travelYear && ['Travel fund', ideas.travelYear, `What your ${ideas.trips} trip${ideas.trips > 1 ? 's' : ''} in the last year cost`],
    ['House down payment', null, 'Often 10–20% of the price'],
    ['New car', null, null],
    ['Something else', null, null],
  ].filter(Boolean);
  return (
    <Panel title="Ideas">
      {list.map(([name, target, why], i) => (
        <button key={i} className="idea" onClick={() => start({ name: name === 'Something else' ? '' : name, target: target ?? '' })}>
          <span><b>{name}</b>{why && <span className="small muted">{why}</span>}</span>
          <span className="amt">{target ? usd(target) : '+'}</span>
        </button>))}
    </Panel>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [ideas, setIdeas] = useState(null);
  const [adding, setAdding] = useState(null); // the form's starting values, or null when closed
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [g, a, i] = await Promise.all([api('/goals'), api('/accounts'), api('/goals/ideas')]);
    setGoals(g); setAccounts(a); setIdeas(i);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!goals) return <PageSkeleton panels={1} />;

  const add = async (f) => {
    const r = await api('/goals', { method: 'POST', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setAdding(null); load();
  };
  const reached = goals.filter((g) => g.saved >= g.target).length;
  const saved = goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0), target = goals.reduce((s, g) => s + g.target, 0);
  const monthly = goals.map(plan).reduce((s, p) => s + (p.monthly ?? 0), 0);

  return (
    <>
      <PageHeader title="Goals" sub="Track savings targets by hand, or link a goal to an account and it follows the balance.">
        <button className="btn primary" onClick={() => setAdding(adding ? null : {})}>{adding ? 'Cancel' : 'Add a goal'}</button>
      </PageHeader>
      {goals.length > 0 && <div className="cards goalcards">
        <div className="card"><h3>Saved toward goals</h3><div className="big amt">{usd(saved)}</div><div className="small muted">of {usd(target)} across {goals.length} goal{goals.length > 1 ? 's' : ''}</div></div>
        <div className="card"><h3>Reached</h3><div className="big">{reached} of {goals.length}</div><div className="small muted">{reached === goals.length ? 'All done. Time for a new one?' : `${goals.length - reached} in progress`}</div></div>
        <div className="card"><h3>Needed each month</h3><div className="big amt">{monthly ? usd(monthly) : '—'}</div>
          <div className="small muted">{monthly ? 'To reach goals with a date on time' : 'Add a date to a goal to see this'}</div></div>
      </div>}
      {adding && <Panel className="mt" title="New goal">
        <GoalForm key={JSON.stringify(adding)} initial={adding} accounts={accounts} onSave={add} submit="Add goal" />
        {err && <p className="bad small">{err}</p>}
      </Panel>}
      <div className="goalsgrid mt">
        <div>
          {goals.length === 0 && !adding && <Panel><EmptyState icon="plan" title="Saving for something?" actions={<button className="btn primary" onClick={() => setAdding({})}>Add a goal</button>}>
            Set a target, optionally with a date or tied to an account, and watch it fill up. The ideas on the right are sized from your own spending.</EmptyState></Panel>}
          <div className="goalgrid">{goals.map((g) => <GoalCard key={g.id} g={g} accounts={accounts} reload={load} />)}</div>
        </div>
        {ideas && <aside><Ideas ideas={ideas} start={(f) => { setAdding(f); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></aside>}
      </div>
    </>
  );
}
