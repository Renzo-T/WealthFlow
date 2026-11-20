import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import Progress from './Progress.jsx';
import { usd } from './format.js';
import AccountOptions from './AccountOptions.jsx';
import { Panel, PageHeader, EmptyState, PageSkeleton, Hover, TipList, confirmDialog, Standing, Stand } from './ui.jsx';
import { TextStamp } from './Stamp.jsx';
import { statusText } from './goalStatus.js';

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

// A reached goal: a stamp with the month it got there; just "Reached" when the month can't be known.
function ReachedStamp({ g }) {
  return <TextStamp kind="in" tilt>Reached{g.reached ? ` ${monthYear(g.reached)}` : ''}</TextStamp>;
}

// A small "···" button that opens a few actions (also used for trips). `before(close)` adds anything above them.
export function ActionMenu({ name, actions, before }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('.rowmenu-btn')?.focus(); } };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <span className="rowmenu" ref={ref}>
      <button type="button" className="rowmenu-btn" aria-label={`Actions for ${name}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="12.5" cy="8" r="1.4" /></svg>
      </button>
      {open && <div className="rowmenu-pop" role="group" aria-label={`${name} actions`}>
        {before?.(() => setOpen(false))}
        {actions.map(([label, run]) => <button key={label} type="button" onClick={() => { setOpen(false); run(); }}>{label}</button>)}
      </div>}
    </span>
  );
}

// Edit, Remove and (for a goal you track by hand) the saved amount, behind one icon button.
function RowMenu({ g, onEdit, onRemove, onSaved }) {
  const commit = (close) => (e) => { if (e.target.value !== '' && Number(e.target.value) !== g.saved) { onSaved(e.target.value); close(); } };
  return <ActionMenu name={g.name} actions={[['Edit', onEdit], ['Remove', onRemove]]} before={(close) => !g.account_id && (
    <label className="small muted">Saved
      <input className="mini" type="number" min="0" step="any" autoFocus defaultValue={g.saved} aria-label={`Saved for ${g.name}`}
        onBlur={commit(close)} onKeyDown={(e) => e.key === 'Enter' && commit(close)(e)} /></label>)} />;
}

// A line only when the balance moved; flat or missing history draws nothing (and no label).
const hasSpark = (data) => data?.length > 1 && Math.max(...data) - Math.min(...data) >= 1;
function Spark({ data }) {
  if (!hasSpark(data)) return null;
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
function useGoalActions(g, reload) {
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState('');
  const save = async (f) => {
    const r = await api(`/goals/${g.id}`, { method: 'PATCH', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setEdit(false); reload();
  };
  const remove = async () => { if (await confirmDialog({ title: `Delete the goal "${g.name}"?`, body: 'The goal goes away; the account it follows is not touched.', confirm: 'Delete goal', danger: true })) { await api(`/goals/${g.id}`, { method: 'DELETE' }); reload(); } };
  return { edit, setEdit, err, save, remove };
}

function GoalCard({ g, accounts, reload }) {
  const { edit, setEdit, err, save, remove } = useGoalActions(g, reload);
  const p = plan(g);
  const done = g.saved >= g.target;
  if (edit) return (
    <div className="card goal">
      <GoalForm initial={{ ...g, saved: g.account_id ? '' : g.saved, target_date: g.target_date ?? '', account_id: g.account_id ?? '' }} accounts={accounts}
        onSave={save} onCancel={() => setEdit(false)} submit="Save" />
      {err && <p className="bad small">{err}</p>}
    </div>
  );
  return (
    <div className={`card goal view${done ? ' done' : ''}`}>
      <div className="row base"><b>{g.name}</b><span className="goalhead">{done ? <ReachedStamp g={g} /> : <span className="small muted">{pct(g)}%</span>}
        <RowMenu g={g} onEdit={() => setEdit(true)} onRemove={remove} onSaved={(v) => save({ saved: v })} /></span></div>
      <div className="big amt">{usd(g.saved)}</div>
      <div className="small muted">of <span className="amt">{usd(g.target)}</span>{g.account ? ` · follows ${g.account}` : ''}</div>
      <Progress value={g.saved} max={g.target} />
      <div className="small">{statusText(g) && <span className={`amt ${done ? 'good' : 'muted'}`}>{statusText(g)}</span>}</div>
      <div className="goalplan small">
        {g.target_date && !done && <div><span className="muted">By {monthYear(g.target_date)}</span><b className="amt">{usd(p.monthly)} a month</b></div>}
        {g.account_id && g.pace != null && !g.everyday && <div><span className="muted">
          <Hover className="quiet" tip={<TipList title="Recent pace" rows={[['Change per month', `${g.pace >= 0 ? '+' : '−'}${usd(Math.abs(g.pace))}`]]}
            note={`${g.account}'s balance over the last 3 months${g.estimated ? ', partly estimated from transactions' : ''}.`} />}>Recent pace</Hover></span>
          <b className={`amt ${g.pace > 1 ? 'good' : ''}`}>{(() => { const t = Math.abs(g.pace) < 1 ? 'no change' : `${g.pace > 0 ? '+' : '−'}${usd(Math.abs(g.pace))} a month`;
            return t; })()}</b></div>}
        {p.eta && !g.everyday && <div><span className="muted">At that pace</span><b>{monthYear(p.eta)}</b></div>}
        {!g.target_date && !done && <button className="linkbtn" onClick={() => setEdit(true)}>Add a date to see what it takes each month</button>}
      </div>
      <div className="goalsparkslot">{hasSpark(g.spark) && <>
        <span className="goalsparklabel small muted">{g.account ? `${g.account} balance` : 'Balance'}, last 3 months</span>
        <Spark data={g.spark} /></>}</div>
    </div>
  );
}

// Reached goals, compact: one ruled sheet with a row each (name, target, when it got there, and the same menu).
function ReachedRow({ g, accounts, reload }) {
  const { edit, setEdit, err, save, remove } = useGoalActions(g, reload);
  if (edit) return (
    <div className="reachedrow editing">
      <GoalForm initial={{ ...g, saved: g.account_id ? '' : g.saved, target_date: g.target_date ?? '', account_id: g.account_id ?? '' }} accounts={accounts}
        onSave={save} onCancel={() => setEdit(false)} submit="Save" />
      {err && <p className="bad small">{err}</p>}
    </div>
  );
  return (
    <div className="reachedrow">
      <b className="rl-name" title={g.name}>{g.name}</b>
      <span className="amt">{usd(g.target)}</span>
      <ReachedStamp g={g} />
      <RowMenu g={g} onEdit={() => setEdit(true)} onRemove={remove} onSaved={(v) => save({ saved: v })} />
    </div>
  );
}

// One goal on the dashboard as a ruled row: name, saved, target and what's left in fixed columns, the meter under it.
function GoalRow({ g }) {
  const done = g.saved >= g.target;
  return (
    <div className={`rl-item${done ? ' done' : ''}`}>
      <div className="rl-row" role="row">
        <span className="rl-namecell" role="cell"><b className="rl-name" title={g.name}>{g.name}</b>{g.account && <span className="small muted rl-sub">follows {g.account}</span>}</span>
        <b className="rl-num amt" role="cell">{usd(g.saved)}</b>
        <span className="rl-num amt" role="cell">{usd(g.target)}</span>
        <span className={`rl-num amt ${done ? 'good' : 'muted'}`} role="cell">{statusText(g)}</span>
      </div>
      <div className="rl-meter">
        <Progress value={g.saved} max={g.target} />
        {done ? <ReachedStamp g={g} /> : <span className="small muted">{pct(g)}%</span>}
      </div>
    </div>
  );
}

export function GoalsPanel({ items }) {
  const all = items;
  items = all.filter((g) => g.saved < g.target); // reached goals live on the Plan page
  return (
    <Panel title="Goals" actions={<a href="#/plan">Manage</a>}>
      {all.length === 0 && <EmptyState art="goals" title="Saving for something?" actions={<a className="btn linkbtn-solid" href="#/plan">Add a goal</a>}>
        Set a target, optionally tied to an account, and watch it fill up.</EmptyState>}
      {all.length > 0 && items.length === 0 && <p className="small muted mt-0">All {all.length} goal{all.length > 1 ? 's' : ''} reached. <a href="#/plan">See them on Plan</a>.</p>}
      {items.length > 0 && (
        <div className="rl rl-goals" role="table" aria-label="Goals">
          <div className="rl-head" role="row">
            <span role="columnheader" aria-label="Goal" />
            {['Saved', 'Target', 'Status'].map((h) => <span key={h} role="columnheader">{h}</span>)}
          </div>
          {items.slice(0, 4).map((g) => <GoalRow key={g.id} g={g} />)}
        </div>
      )}
    </Panel>
  );
}

// Ideas for new goals, sized from your own spending and trips.
function Ideas({ ideas, goals, start }) {
  const have = new Set(goals.map((g) => g.name.trim().toLowerCase()));
  const list = [
    ideas.emergency3 && ['Emergency fund', ideas.emergency3, <>3 months of your spending (about <span className="amt">{usd(ideas.monthlySpend)}</span> a month)</>],
    ideas.emergency6 && ['Emergency fund', ideas.emergency6, '6 months of spending: the usual advice if your income varies'],
    ideas.travelYear && ['Travel fund', ideas.travelYear, `What your ${ideas.trips} trip${ideas.trips > 1 ? 's' : ''} in the last year cost`],
    ['House down payment', null, 'Often 10–20% of the price'],
    ['New car', null, null],
    ['Something else', null, null],
  ].filter(Boolean)
    .filter(([name]) => !have.has(name.toLowerCase()))
    // one emergency-fund idea is enough (the 3-month one)
    .filter(([name, , why], i, a) => name !== 'Emergency fund' || a.findIndex((x) => x[0] === name) === i);
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
  if (!goals) return <PageSkeleton panels={1} title="Plan" />;

  const add = async (f) => {
    const r = await api('/goals', { method: 'POST', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setAdding(null); load();
  };
  const doneGoals = goals.filter((g) => g.saved >= g.target), active = goals.filter((g) => g.saved < g.target);
  const reached = doneGoals.length;
  const saved = goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0), target = goals.reduce((s, g) => s + g.target, 0);
  const monthly = goals.map(plan).reduce((s, p) => s + (p.monthly ?? 0), 0);

  return (
    <>
      <PageHeader title="Plan">
        <button className="btn primary" onClick={() => setAdding(adding ? null : {})}>{adding ? 'Cancel' : 'Add a goal'}</button>
      </PageHeader>
      {/* With one goal its own card says all of this, so the standing line starts at two. */}
      {goals.length > 1 && <Standing label="Goals" className="mt">
        <Stand lead label="Saved toward goals" note={<span className="small muted">of <span className="amt">{usd(target)}</span> across {goals.length} goals</span>}>{usd(saved)}</Stand>
        {reached > 0 && <Stand label="Reached" note={<span className="small muted">{reached === goals.length ? 'All done. Time for a new one?' : `${goals.length - reached} in progress`}</span>}>{reached} of {goals.length}</Stand>}
        {monthly > 0 && <Stand label="Needed each month" note={<span className="small muted">To reach goals with a date on time</span>}>{usd(monthly)}</Stand>}
      </Standing>}
      {adding && <Panel className="mt" title="New goal">
        <GoalForm key={JSON.stringify(adding)} initial={adding} accounts={accounts} onSave={add} submit="Add goal" />
        {err && <p className="bad small">{err}</p>}
      </Panel>}
      <div className="goalsgrid mt">
        <div>
          {goals.length === 0 && !adding && <Panel><EmptyState art="goals" title="Saving for something?" actions={<button className="btn primary" onClick={() => setAdding({})}>Add a goal</button>}>
            Set a target, optionally with a date or tied to an account, and watch it fill up. The ideas on the right are sized from your own spending.</EmptyState></Panel>}
          {active.length > 0 && <div className={`goalgrid${active.length === 1 ? ' single' : ''}`}>{active.map((g) => <GoalCard key={g.id} g={g} accounts={accounts} reload={load} />)}</div>}
          {doneGoals.length > 0 && <Panel className={active.length ? 'mt' : ''} title={<>Reached <span className="asof">{doneGoals.length}</span></>}>
            <div className="reachedshelf">{doneGoals.map((g) => <ReachedRow key={g.id} g={g} accounts={accounts} reload={load} />)}</div>
          </Panel>}
        </div>
        {ideas && <aside><Ideas ideas={ideas} goals={goals} start={(f) => { setAdding(f); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></aside>}
      </div>
    </>
  );
}
