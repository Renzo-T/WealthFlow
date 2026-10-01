import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Progress from './Progress.jsx';
import { usd, label, usd2 } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList } from './ui.jsx';
import CategoryIcon from './CategoryIcon.jsx';

export function BudgetsPanel({ items, suggestions }) {
  const top = [...items].sort((a, b) => b.spent / b.amount - a.spent / a.amount).slice(0, 4);
  return (
    <Panel title="Budgets" actions={<a href="#/budget">Manage</a>}>
      {top.length === 0 && (
        <EmptyState icon="plan" title="Plan your month" actions={<a className="btn primary linkbtn-solid" href="#/budget">Set up a budget</a>}>
          {suggestions?.count ? <>From your bills and recent spending, WealthFlow can fill in <b className="amt">{usd(suggestions.total)}</b> a month across {suggestions.count} categories. Adjust anything after.</>
            : 'Set amounts for categories like Groceries or Rent, and see how you\'re tracking as the month goes.'}
        </EmptyState>)}
      {top.map((b) => (
        <div className="cat" key={b.category}>
          <div className="row base"><span>{label(b.category)}</span><span className="small muted">{usd(b.spent)} of {usd(b.amount)}</span></div>
          <Progress value={b.spent} max={b.amount} warn />
        </div>
      ))}
    </Panel>
  );
}

const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
// Remembered per browser: collapsed cards and how expenses are grouped. Storage can be unavailable; then defaults.
const remember = (k, v) => { try { localStorage.setItem(`wf.budget.${k}`, JSON.stringify(v)); } catch { /* not available */ } };
const recall = (k, d) => { try { return JSON.parse(localStorage.getItem(`wf.budget.${k}`)) ?? d; } catch { return d; } };

// Remaining as a pill: green = room left (or income still to come), red = over, grey = exactly on budget.
function Remaining({ value, income }) {
  const v = Math.round(value);
  const cls = v === 0 ? 'zero' : (income ? v > 0 : v > 0) ? 'ok' : 'over';
  return <span className={`pill amt ${cls}`}>{v < 0 ? '−' : ''}{usd(Math.abs(v))}</span>;
}

// Budget amount, edited in place: saves on Enter or when you leave the field. Empty (or 0) removes the budget.
function BudgetInput({ c, save }) {
  const [v, setV] = useState(c.budget ?? '');
  useEffect(() => setV(c.budget ?? ''), [c.budget]);
  const commit = () => { const n = v === '' ? null : Math.round(Number(v)); if (n !== (c.budget ?? null)) save(c, n); };
  return (
    <input className={`binput${v === '' && c.suggested ? ' sugg' : ''}`} type="number" min="0" step="1" value={v} placeholder={c.suggested ? `≈ ${c.suggested}` : '—'}
      title={c.suggested ? `Suggested ${usd(c.suggested)} from ${c.basis}` : undefined}
      onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Budget for ${c.category}`} />
  );
}

// Actual against budget. Green: on track. Amber: a flexible category ahead of an even pace for today. Red: over.
// Income fills green as it arrives. The tick marks the even pace (flexible spending only).
function Meter({ actual, budget, income, pace }) {
  if (!budget) return <div className="meter blank" />;
  const p = Math.min(100, (Math.max(0, actual) / budget) * 100);
  const state = income ? 'ok' : actual > budget + 0.5 ? 'over' : pace != null && pace < 1 && p > pace * 100 + 10 ? 'ahead' : 'ok';
  return (
    <div className="meter"><i className={state} style={{ width: `${p}%` }} />
      {pace != null && pace > 0 && pace < 1 && <b style={{ left: `${pace * 100}%` }} title="An even pace for today" />}</div>
  );
}

const KIND_TAG = { fixed: 'Fixed', nonmonthly: 'Non-monthly' };
const monthShort = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'short' });
const signedUsd = (v) => `${v < 0 ? '−' : '+'}${usd(Math.abs(v))}`;
function Row({ c, income, progress, save, tags = true, inGroup = false, month, resetMonth, setRollover }) {
  const avail = c.budget == null ? null : c.budget + (c.rollover ? c.carry : 0);
  return (
    <div className={`brow${inGroup ? ' ingroup' : ''}`}>
      <span className="bname"><CategoryIcon group={c.group} sub={c.category} size={26} />
        <span>{c.category}</span>
        {tags && KIND_TAG[c.kind] && <Hover className="quiet" tip={<TipList title={c.kind === 'fixed' ? 'Fixed: has a recurring bill' : 'Non-monthly: billed every few months or yearly'}
          rows={c.bills.map((x) => [x, ''])} note={c.kind === 'nonmonthly' ? 'The budget is the monthly share, so the money is there when the bill comes.' : null} />}>
          <span className="ftag">{KIND_TAG[c.kind]}</span></Hover>}
        {c.overridden && <Hover className="quiet" tip={<TipList title={`${monthShort(month)} only`} rows={[['This month', usd(c.budget)], ['Usually', c.usual == null ? '—' : usd(c.usual)]]} />}>
          <span className="ftag mtag">{monthShort(month)} only<button className="tagx" onClick={() => resetMonth(c)} aria-label="Back to the usual amount">×</button></span></Hover>}
        {c.rollover && <Hover tip={<TipList title="Rolls over" rows={c.carryHistory.map((h) => [monthShort(h.month), signedUsd(h.left)])}
          note={c.carryHistory.length ? 'Unspent money carries into the next month; overspending takes from it.' : 'Starts building up from this month.'} />}>
          <button className="ftag rtag" onClick={() => window.confirm(`Stop rolling over ${c.category}? What's carried over (${usd(c.carry)}) won't count any more.`) && setRollover(c, false)}>
            ↻ {c.carry ? signedUsd(c.carry) : 'rolls over'}</button></Hover>}
        {!c.rollover && !income && !inGroup && c.kind === 'nonmonthly' && <button className="linkbtn small" onClick={() => setRollover(c, true)}
          title="Let unspent money build up month to month until the bill comes">Roll over</button>}</span>
      <span className="r">{inGroup ? null : <BudgetInput c={c} save={save} />}</span>
      <span className="r amt">{c.count ? <Hover tip={<TipList title={`${c.category}: ${c.count} transaction${c.count > 1 ? 's' : ''}`}
        rows={c.top.map((t) => [t.name, `${t.amount < 0 ? '−' : ''}${usd2(Math.abs(t.amount))}`, new Date(`${t.date}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })])}
        note={c.count > c.top.length ? `and ${c.count - c.top.length} more` : null} />}>{usd(c.actual)}</Hover> : usd(c.actual)}</span>
      <span className="r">{inGroup ? null : avail != null ? <Remaining value={avail - c.actual} income={income} /> : <span className="small muted">no budget</span>}</span>
      {!inGroup && <span className="bmeter"><Meter actual={c.actual} budget={avail} income={income} pace={!income && c.kind === 'flexible' ? progress : null} /></span>}
    </div>
  );
}

// One card per group: a header row with the group's totals (click to collapse), its categories, and the
// categories with nothing in them behind "Show N unbudgeted".
function GroupCard({ id, title, rows, income, progress, save, tags, clear, group, setWhole, month, resetMonth, setRollover }) {
  const [open, setOpen] = useState(() => !recall(`closed.${id}`, false));
  const [more, setMore] = useState(false);
  const active = (c) => c.budget != null || Math.abs(c.actual) >= 0.5 || c.suggested;
  const shown = rows.filter((c) => more || active(c));
  const hidden = rows.length - rows.filter(active).length;
  if (!rows.length) return null;
  const whole = !!group?.whole;
  const budget = whole ? group.groupBudget ?? 0 : rows.reduce((s, c) => s + (c.budget ?? 0), 0), actual = rows.reduce((s, c) => s + c.actual, 0);
  const left = budget - actual;
  const toggle = () => { setOpen(!open); remember(`closed.${id}`, open); };
  // The group as one budget line (its amount, suggestion and spending), for the header's input and meter.
  const self = whole && { category: title, isGroup: true, budget: group.groupBudget, suggested: group.groupSuggested, basis: 'its categories', kind: group.kind,
    overridden: group.groupOverridden, usual: group.groupUsual };
  return (
    <section className="card bcard">
      <div className={`bhead${whole ? ' whole' : ''}`}>
        <button className="btitle" onClick={toggle} aria-expanded={open}>
          <svg className={`chev${open ? ' open' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>{title}</button>
        <span className="r amt bheadin">{self?.overridden && <span className="ftag mtag">{monthShort(month)} only<button className="tagx" onClick={() => resetMonth(self)} aria-label="Back to the usual amount">×</button></span>}
          {whole ? <BudgetInput c={self} save={save} /> : budget ? usd(budget) : '—'}</span>
        <span className="r amt">{usd(actual)}</span>
        <span className="r">{whole ? (group.groupBudget != null ? <Remaining value={left} income={income} /> : <span className="small muted">no budget</span>)
          : <span className={`amt ${!budget ? '' : left < -0.5 && !income ? 'bad' : 'good'}`}>{budget ? `${left < -0.5 ? '−' : ''}${usd(Math.abs(left))}` : ''}</span>}</span>
        {whole && <span className="bmeter"><Meter actual={actual} budget={group.groupBudget} income={income} pace={!income && group.kind === 'flexible' ? progress : null} /></span>}
      </div>
      {open && shown.map((c) => <Row key={c.category} c={c} income={income} progress={progress} save={save} tags={tags} inGroup={whole} month={month} resetMonth={resetMonth} setRollover={setRollover} />)}
      {open && <div className="bfoot">
        {hidden > 0 && <button className="bmore" onClick={() => setMore(!more)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {more ? 'Hide' : 'Show'} {hidden} unbudgeted</button>}
        {!hidden && <span className="bfill" />}
        {group && rows.length > 1 && <button className="bmore bswitch" onClick={() => setWhole(group.group, !whole)}
          title={whole ? 'Give each category its own amount, split by recent spending' : 'One amount for the whole group; categories just show what was spent'}>
          {whole ? 'Budget each category' : 'Budget as one amount'}</button>}
        {budget > 0 && <button className="bmore bclear" onClick={() => clear(whole ? { groups: [group.group] } : {
          categories: rows.filter((c) => c.budget != null && !c.isGroup).map((c) => c.category),
          groups: rows.filter((c) => c.budget != null && c.isGroup).map((c) => c.category) }, title)}>Clear</button>}
      </div>}
    </section>
  );
}

const Strip = ({ title, children }) => (
  <div className="bstrip"><span>{title}{children}</span><span className="r">Budget</span><span className="r">Actual</span><span className="r">Remaining</span></div>
);
const Total = ({ title, budget, actual, income }) => (
  <section className="card btot">
    <span>{title}</span><span className="r amt">{usd(budget)}</span><span className="r amt">{usd(actual)}</span>
    <span className={`r amt ${budget - actual < -0.5 && !income ? 'bad' : 'good'}`}>{budget ? `${budget - actual < -0.5 ? '−' : ''}${usd(Math.abs(budget - actual))}` : ''}</span>
  </section>
);

// Side panel meters: one per line, same colours as the rows.
function Split({ title, t, income, pace, sub }) {
  if (!t.budget) return <div className="bsplit"><div className="row"><span>{title}</span><span className="small muted">no budget yet</span></div>{sub && <div className="small muted">{sub}</div>}</div>;
  const left = t.budget - t.actual;
  return (
    <div className="bsplit">
      <div className="row"><span>{title}</span><span className="small muted amt">{usd(t.budget)} budget</span></div>
      <Meter actual={t.actual} budget={t.budget} income={income} pace={pace} />
      <div className="row small"><b className="amt">{usd(t.actual)} {income ? 'received' : 'spent'}</b>
        <span className={`amt ${left < -0.5 && !income ? 'bad' : left > 0.5 && !income && pace != null && t.actual / t.budget > pace + 0.1 ? 'warn' : 'good'}`}>
          {usd(Math.abs(left))} {left < -0.5 ? (income ? 'extra' : 'over') : income ? 'to come' : 'remaining'}</span></div>
    </div>
  );
}

function SidePanel({ b }) {
  const [tab, setTab] = useState(() => recall('tab', 'summary'));
  const pick = (t) => { setTab(t); remember('tab', t); };
  const t = b.totals;
  return (
    <section className="card bside-card">
      <div className="ranges btabs" role="tablist">
        {[['summary', 'Summary'], ['income', 'Income'], ['expenses', 'Expenses']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>))}
      </div>
      {tab === 'summary' && <>
        <Split title="Income" t={{ budget: t.income, actual: t.incomeActual }} income />
        <Split title="Spending & saving" t={{ budget: t.expenses, actual: t.expensesActual }} pace={b.progress} />
      </>}
      {tab === 'income' && b.income.categories.filter((c) => c.budget || Math.abs(c.actual) >= 0.5).map((c) => (
        <Split key={c.category} title={c.category} t={{ budget: c.budget ?? 0, actual: c.actual }} income />))}
      {tab === 'expenses' && <>
        <Split title="Fixed" t={t.fixed} sub="Bills that come every month." />
        <Split title="Flexible" t={t.flexible} pace={b.progress} sub="Everyday spending." />
        <Split title="Non-monthly" t={t.nonmonthly} sub="Bills every few months or yearly: budget the monthly share." />
      </>}
      {b.progress > 0 && b.progress < 1 && <p className="small muted foot">{Math.round(b.progress * 100)}% of {monthName(b.month).split(' ')[0]} has passed. The tick marks an even pace for flexible spending.</p>}
    </section>
  );
}

// Expenses grouped by kind instead of by budget group.
const KINDS = [['fixed', 'Fixed'], ['flexible', 'Flexible'], ['nonmonthly', 'Non-monthly'], ['saving', 'Saving & debt']];
const kindOf = (c) => (c.group === 'Savings & investments' || c.group === 'Debt repayment' ? 'saving' : c.kind);

export default function Budget() {
  const [month, setMonth] = useState(thisMonth);
  const [b, setB] = useState(null);
  const [view, setView] = useState(() => recall('view', 'group'));
  const [scope, setScope] = useState('all'); // edits apply to every month, or only this one
  const load = useCallback(async () => setB(await api(`/budget?month=${month}`)), [month]);
  useEffect(() => { load(); }, [load]);
  if (!b) return <PageSkeleton />;

  // Edits go to every month, or (scope "month") only the month on screen.
  const put = (c, amount, onlyMonth = scope === 'month') => {
    const body = JSON.stringify(onlyMonth ? { amount, month } : { amount });
    return c.isGroup ? api(`/budget-groups/${encodeURIComponent(c.category)}`, { method: 'PUT', body })
      : api(`/budgets/${encodeURIComponent(c.category)}`, { method: 'PUT', body });
  };
  const resetMonth = async (c) => { await put(c, '', true); load(); };
  const setRollover = async (c, on) => { await api(`/budget-rollover/${encodeURIComponent(c.category)}`, { method: 'PUT', body: JSON.stringify({ on }) }); load(); };
  const extra = { month, resetMonth, setRollover };
  const save = async (c, amount) => { await put(c, amount); load(); };
  const setWhole = async (group, whole) => { await api(`/budget-groups/${encodeURIComponent(group)}`, { method: 'PUT', body: JSON.stringify({ whole }) }); load(); };
  const withGroup = (g) => g.categories.map((c) => ({ ...c, group: g.group }));
  // A group budgeted as one amount, as a single line (for the Fixed & flexible view, suggestions and totals).
  const asLine = (g) => ({ category: g.group, group: g.group, isGroup: true, budget: g.groupBudget, suggested: g.groupSuggested, actual: g.actual,
    kind: g.kind, bills: [], count: g.categories.reduce((s, c) => s + c.count, 0),
    top: g.categories.flatMap((c) => c.top).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 6), basis: 'its categories' });
  const lines = (g) => (g.whole ? [asLine(g)] : withGroup(g));
  const incomeRows = withGroup(b.income);
  const all = [b.income, ...b.expenses].flatMap(lines);
  const todo = all.filter((c) => c.budget == null && c.suggested);
  const suggest = async () => {
    const total = todo.filter((c) => c.group !== 'Income').reduce((s, c) => s + c.suggested, 0);
    if (!window.confirm(`Fill in ${todo.length} empty budget${todo.length === 1 ? '' : 's'} with suggested amounts?\n\nFixed categories use your recurring bills; the rest use your average from ${b.suggestedFrom.map((m) => monthName(m).split(' ')[0]).join(', ')}. About ${usd(total)} a month of spending. You can change any of them afterwards.`)) return;
    for (const c of todo) await put(c, c.suggested);
    load();
  };
  // Clear some budgets (a card's) or all of them. They apply to every month, so say so before clearing.
  const clear = async (which, title) => {
    const n = which ? (which.categories?.length ?? 0) + (which.groups?.length ?? 0) : all.filter((c) => c.budget != null).length;
    if (!n || !window.confirm(`Clear ${n} budget${n > 1 ? 's' : ''}${title ? ` in ${title}` : ''}?

Budgets apply to every month, so this clears them everywhere. Suggestions stay, so you can fill them in again.`)) return;
    await api('/budgets/clear', { method: 'POST', body: JSON.stringify(which ?? {}) });
    load();
  };
  const left = b.leftToBudget;
  const none = !b.totals.income && !b.totals.expenses;
  const pickView = (v) => { setView(v); remember('view', v); };
  const cards = view === 'kind'
    ? KINDS.map(([k, title]) => ({ id: `k.${k}`, title, rows: b.expenses.flatMap(lines).filter((c) => kindOf(c) === k) }))
    : b.expenses.map((g) => ({ id: `g.${g.group}`, title: g.group, rows: withGroup(g), group: g }));

  return (
    <>
      <PageHeader title="Budget" sub="Plan each month by category. Amounts apply to every month unless you set one for a single month (&quot;Only …&quot;).">
        <div className="monthnav">
          <button className="iconbtn" onClick={() => setMonth(b.prev)} aria-label="Previous month">‹</button>
          <b>{monthName(month)}</b>
          <button className="iconbtn" onClick={() => setMonth(b.next)} aria-label="Next month">›</button>
          <button className="btn" onClick={() => setMonth(thisMonth())} disabled={month === thisMonth()}>Today</button>
          <span className="ranges bscope" title="Where your edits go">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Every month</button>
            <button className={scope === 'month' ? 'on' : ''} onClick={() => setScope('month')}>Only {monthShort(month)}</button>
          </span>
        </div>
      </PageHeader>
      <div className="budgetgrid mt">
        <div className="bcol">
          <Strip title="Income" />
          <GroupCard id="income" title="Income" rows={incomeRows} income progress={b.progress} save={save} clear={clear} group={b.income} setWhole={setWhole} {...extra} />
          <Total title="Total income" budget={b.totals.income} actual={b.totals.incomeActual} income />
          <Strip title="Expenses">
            <span className="ranges bview">
              <button className={view === 'group' ? 'on' : ''} onClick={() => pickView('group')}>By group</button>
              <button className={view === 'kind' ? 'on' : ''} onClick={() => pickView('kind')}>Fixed & flexible</button>
            </span>
          </Strip>
          {cards.map((c) => <GroupCard key={c.id} id={c.id} title={c.title} rows={c.rows} progress={b.progress} save={save} tags={view !== 'kind'} clear={clear} group={c.group} setWhole={setWhole} {...extra} />)}
          <Total title="Total spending & saving" budget={b.totals.expenses} actual={b.totals.expensesActual} />
        </div>
        <aside className="bside">
          <section className={`card leftcard ${left < 0 ? 'neg' : none ? 'none' : ''}`}>
            <div className="big amt">{left < 0 ? '−' : ''}{usd(Math.abs(left))}</div>
            <div><Hover tip={<TipList title="Left to budget" rows={[['Income budgeted', usd(b.totals.income)], ['Spending & saving budgeted', `−${usd(b.totals.expenses)}`]]}
              note="Give every dollar of expected income a job: aim for $0 left." />}>{left < 0 ? 'Over budget' : none ? 'Nothing budgeted yet' : 'Left to budget'}</Hover></div>
          </section>
          <SidePanel b={b} />
          <label className="check small btrips"><input type="checkbox" checked={b.trips.counted} onChange={async (e) => {
            await api('/settings/budget-trips', { method: 'PUT', body: JSON.stringify({ on: e.target.checked }) }); load(); }} />
            Count trips in these categories</label>
          {!b.trips.counted && b.trips.left_out > 0 && <p className="small muted btrips">Leaving out <b className="amt">{usd(b.trips.left_out)}</b> spent on <a href="#/trips">trips</a> this month.</p>}
          {!none && <button className="linkbtn bclearall" onClick={() => clear(null)}>Clear the whole budget</button>}
          {todo.length > 0 && <Panel className="mt" title="Suggestions">
            <p className="small muted mt-0">{todo.length} {todo.length === 1 ? 'line has' : 'lines have'} no budget yet. Suggestions come from your recurring bills and your average spending ({b.suggestedFrom.map((m) => monthName(m).split(' ')[0]).join(', ')}). They show as ≈ amounts in dashed boxes until you set them.</p>
            <button className="btn primary" onClick={suggest}>Fill in suggestions</button>
          </Panel>}
        </aside>
      </div>
    </>
  );
}
