import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd } from './format.js';
import { Amt, Check } from './ui.jsx';

// Close out a finished month on the Budget page: one ruled sheet with four steps, all visible, done ones ticked.
// 1 Sort what's still waiting (/api/todo), 2 budget against actual by group, 3 for groups more than 15% off, keep
// the budget or set next month to the recent average (a one-month amount, so the closed month isn't rewritten),
// 4 record the month as closed (POST /api/budget/close). Nothing is saved until you choose something.
const name = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long' });
const short = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'short' });
const OFF = 0.15; // more than 15% over or under

// The amount a group would get next month, from that month's suggestions (the average of the last 3 finished months,
// or the bills for categories that have them), and the lines it would be saved on.
function nextFor(nb, group) {
  const g = nb?.expenses.find((x) => x.group === group);
  if (!g) return null;
  if (g.whole) return g.groupSuggested ? { amount: g.groupSuggested, items: [{ path: `/budget-groups/${encodeURIComponent(group)}`, amount: g.groupSuggested }] } : null;
  const cats = g.categories.filter((c) => c.budget != null || c.suggested);
  const amount = Math.round(cats.reduce((s, c) => s + (c.suggested ?? 0), 0));
  return amount ? { amount, items: cats.map((c) => ({ path: `/budgets/${encodeURIComponent(c.category)}`, amount: c.suggested ?? 0 })) } : null;
}

function Step({ done, title, children }) {
  return (
    <li className={`closestep${done ? ' done' : ''}`}>
      <span className="closecheck" aria-label={done ? 'Done' : 'Not done yet'}>{done && <Check size={11} />}</span>
      <div className="closebody"><b>{title}</b>{children}</div>
    </li>
  );
}

export default function CloseMonth({ b, onClose }) {
  const month = b.month, next = b.next;
  const [todo, setTodo] = useState(null);
  const [nb, setNb] = useState(null);
  const [choice, setChoice] = useState({}); // group → 'keep' | 'set'
  const [busy, setBusy] = useState(null);
  const [closed, setClosed] = useState(b.closed);
  useEffect(() => {
    api('/todo').then(setTodo).catch(() => setTodo([]));
    api(`/budget?month=${next}`).then(setNb).catch(() => setNb(null));
  }, [next]);

  // Step 2: every group with a budget or spending, over-budget groups first (biggest overspend first).
  const groups = b.expenses.filter((g) => g.budget > 0 || Math.abs(g.actual) >= 0.5)
    .map((g) => ({ ...g, diff: g.actual - g.budget }))
    .sort((x, y) => (y.budget > 0 && y.diff > 0.5) - (x.budget > 0 && x.diff > 0.5) || (x.budget > 0 && x.diff > 0.5 ? y.diff - x.diff : y.actual - x.actual));
  // Step 3: budgeted groups that landed more than 15% over or under.
  const flagged = groups.filter((g) => g.budget > 0 && Math.abs(g.diff) / g.budget > OFF);
  const choose = async (g, what, plan) => {
    if (choice[g.group] === what) return;
    setBusy(g.group);
    try {
      // "Set" saves next month's own amount; going back to "Keep" afterwards puts next month back to the usual amount.
      if (what === 'set') for (const it of plan.items) await api(it.path, { method: 'PUT', body: JSON.stringify({ amount: it.amount, month: next }) });
      else if (choice[g.group] === 'set') for (const it of plan.items) await api(it.path, { method: 'PUT', body: JSON.stringify({ amount: '', month: next }) });
      setChoice((c) => ({ ...c, [g.group]: what }));
    } finally { setBusy(null); }
  };
  const close = async () => {
    setBusy('close');
    try { await api('/budget/close', { method: 'POST', body: JSON.stringify({ month }) }); setClosed(true); } finally { setBusy(null); }
  };

  const steps = [todo != null && todo.length === 0, true, nb != null && flagged.every((g) => choice[g.group] || !nextFor(nb, g.group)), closed];
  const pct = (g) => `${Math.round((Math.abs(g.diff) / g.budget) * 100)}%`;
  const income = b.income;

  return (
    <section className="card closeout mt" aria-label={`Close out ${name(month)}`}>
      <div className="row base">
        <b className="closetitle">Close out {name(month)}</b>
        <span className="btnrow"><span className="small muted">{steps.filter(Boolean).length} of 4 done</span>
          <button className="linkbtn small" onClick={onClose}>{closed ? 'Back to the budget' : 'Not now'}</button></span>
      </div>
      <ol className="closesteps">
        <Step done={steps[0]} title="Sort what's still waiting">
          {todo == null ? <p className="small muted">Checking…</p>
            : todo.length === 0 ? <p className="small muted">Nothing waiting. Every transfer, payment and trip is sorted.</p>
              : <ul className="closelist">{todo.map((t) => <li key={t.key}><a href={t.href}>{t.label}</a></li>)}</ul>}
        </Step>

        <Step done={steps[1]} title="How it went">
          {groups.length === 0 ? <p className="small muted">No budget and no spending in {name(month)}.</p> : <>
            <div className="closegrid closehead small muted"><span>Group</span><span className="r">Budget</span><span className="r">Actual</span><span className="r">Difference</span></div>
            {groups.map((g) => (
              <div className="closegrid" key={g.group}>
                <span className="closename">{g.group}</span>
                <span className="r">{g.budget > 0 ? <Amt>{usd(g.budget)}</Amt> : <span className="small muted">no budget</span>}</span>
                <span className="r"><Amt>{usd(g.actual)}</Amt></span>
                <span className="r">{g.budget > 0 && (Math.abs(g.diff) < 0.5 ? <span className="small muted">on budget</span>
                  : <Amt className={g.diff > 0 ? 'bad' : 'good'}>{usd(Math.abs(g.diff))} {g.diff > 0 ? 'over' : 'under'}</Amt>)}</span>
              </div>))}
            {(income.budget > 0 || Math.abs(income.actual) >= 0.5) && <p className="small muted closenote">
              Income: <Amt>{usd(income.actual)}</Amt> received{income.budget > 0 && <> of <Amt>{usd(income.budget)}</Amt> budgeted</>}.</p>}
          </>}
        </Step>

        <Step done={steps[2]} title="Carry on or change">
          {flagged.length === 0 ? <p className="small muted">Every budgeted group landed within 15% of its budget.</p> : <>
            <p className="small muted closenote">Groups more than 15% over or under. Setting an amount changes {name(next)} only; your usual budget stays.</p>
            {flagged.map((g) => {
              const plan = nextFor(nb, g.group);
              return (
                <div className="closechoice" key={g.group}>
                  <span className="closename">{g.group} <span className="small muted">{pct(g)} {g.diff > 0 ? 'over' : 'under'}</span></span>
                  <span className="ranges" role="group" aria-label={`${g.group} next month`}>
                    <button className={choice[g.group] === 'keep' ? 'on' : ''} aria-pressed={choice[g.group] === 'keep'} disabled={busy != null}
                      onClick={() => choose(g, 'keep', plan)}>Keep</button>
                    {plan && <button className={choice[g.group] === 'set' ? 'on' : ''} aria-pressed={choice[g.group] === 'set'} disabled={busy != null}
                      title={`From your average of ${nb.suggestedFrom.map(short).join(', ')}, or your bills for categories that have them`}
                      onClick={() => choose(g, 'set', plan)}>Set {name(next)} to <Amt>{usd(plan.amount)}</Amt></button>}
                  </span>
                  {nb && !plan && <span className="small muted">no recent average</span>}
                </div>);
            })}
          </>}
        </Step>

        <Step done={steps[3]} title="Done">
          {closed ? <p className="small muted">{name(month)} is closed out.</p> : <>
            <p className="small muted closenote">Marks {name(month)} as closed, so this stops asking. Nothing else changes.</p>
            <button className="btn primary" onClick={close} disabled={busy != null}>Close out {name(month)}</button>
          </>}
        </Step>
      </ol>
    </section>
  );
}
