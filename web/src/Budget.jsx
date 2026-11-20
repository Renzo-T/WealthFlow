import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import Progress from './Progress.jsx';
import { usd, label, usd2 } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList, amountsHidden, Chevron, Migrate, Close, confirmDialog } from './ui.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import CloseMonth from './CloseMonth.jsx';

export function BudgetsPanel({ items, suggestions }) {
  const top = [...items].sort((a, b) => b.spent / b.amount - a.spent / a.amount).slice(0, 4);
  return (
    <Panel title="Budgets" actions={<a href="#/budget">Manage</a>}>
      {top.length === 0 && (
        <EmptyState art="budget" title="Plan your month" actions={<a className="btn primary linkbtn-solid" href="#/budget">Set up a budget</a>}>
          {suggestions?.count ? <>From your bills and recent spending, Mizo Money can fill in <b className="amt">{usd(suggestions.total)}</b> a month across {suggestions.count} categories. Adjust anything after.</>
            : 'Set amounts for categories like Groceries or Rent, and see how you\'re tracking as the month goes.'}
        </EmptyState>)}
      {top.map((b) => (
        <div className="cat" key={b.category}>
          <div className="row base"><span>{label(b.category)}</span><span className="small muted"><span className="amt">{usd(b.spent)}</span> of <span className="amt">{usd(b.amount)}</span></span></div>
          <Progress value={b.spent} max={b.amount} warn />
        </div>
      ))}
    </Panel>
  );
}

const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
// From the 1st to the 10th, last month can be closed out (the sheet in CloseMonth.jsx).
const closeWindow = (m) => { const d = new Date(); return d.getDate() <= 10 && m === new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString('en-CA').slice(0, 7); };
// Remembered per browser: collapsed cards and how expenses are grouped. Storage can be unavailable; then defaults.
const remember = (k, v) => { try { localStorage.setItem(`wf.budget.${k}`, JSON.stringify(v)); } catch { /* not available */ } };
const recall = (k, d) => { try { return JSON.parse(localStorage.getItem(`wf.budget.${k}`)) ?? d; } catch { return d; } };

// Remaining as plain text: ink while there is room, red only when over, muted "met" for saving above its budget
// (saving more than planned isn't overspending).
function Remaining({ value, income, saving }) {
  const v = Math.round(value);
  if (saving && v < 0) return <span className="rem muted" title={amountsHidden() ? 'Saved more than planned' : `${usd(-v)} more than planned`}>met</span>;
  if (income && v < 0) return <span className="rem amt" title={amountsHidden() ? 'Received more than budgeted' : `${usd(-v)} more than budgeted`}>+{usd(-v)}</span>; // income above budget is good news, not "over"
  return <span className={`rem amt${v < 0 ? ' over' : ''}`}>{v < 0 ? '−' : ''}{usd(Math.abs(v))}</span>;
}

// Budget amount, edited in place: saves on Enter or when you leave the field. Empty (or 0) removes the budget.
function BudgetInput({ c, save }) {
  const [v, setV] = useState(c.budget ?? '');
  useEffect(() => setV(c.budget ?? ''), [c.budget]);
  const commit = () => { const n = v === '' ? null : Math.round(Number(v)); if (n !== (c.budget ?? null)) save(c, n); };
  return (
    <input className={`binput${v === '' && c.suggested ? ' sugg' : ''}`} type="number" min="0" step="1" value={v} placeholder={c.suggested ? `≈ ${c.suggested}` : '—'}
      title={c.suggested ? `Suggested${amountsHidden() ? '' : ` ${usd(c.suggested)}`} from ${c.basis}` : undefined}
      onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Budget for ${c.category}`} />
  );
}

// Actual against budget. Green: on track. Amber: a flexible category ahead of an even pace for today. Red: over.
// Income fills green as it arrives. The tick marks the even pace (flexible spending only).
function Meter({ actual, budget, income, pace, saving }) {
  if (!budget) return <div className="meter blank" />;
  const p = Math.min(100, (Math.max(0, actual) / budget) * 100);
  const state = income || saving ? 'ok' : actual > budget + 0.5 ? 'over' : pace != null && pace < 1 && p > pace * 100 + 10 ? 'ahead' : 'ok';
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
          <span className="ftag mtag">{monthShort(month)} only<button className="tagx" onClick={() => resetMonth(c)} aria-label="Back to the usual amount"><Close /></button></span></Hover>}
        {c.rollover && <Hover tip={<TipList title="Rolls over" rows={c.carryHistory.map((h) => [monthShort(h.month), signedUsd(h.left)])}
          note={c.carryHistory.length ? 'Unspent money carries into the next month; overspending takes from it.' : 'Starts building up from this month.'} />}>
          <button className="ftag rtag" onClick={async () => { if (await confirmDialog({ title: `Stop rolling over ${c.category}?`, body: `What's carried over (${usd(c.carry)}) won't count any more.`, confirm: 'Stop rolling over' })) setRollover(c, false); }}>
            <Migrate /> {c.carry ? signedUsd(c.carry) : 'rolls over'}</button></Hover>}
        {!c.rollover && !income && !inGroup && c.kind === 'nonmonthly' && <button className="linkbtn small" onClick={() => setRollover(c, true)}
          title="Let unspent money build up month to month until the bill comes">Roll over</button>}</span>
      <span className="r">{inGroup ? null : <BudgetInput c={c} save={save} />}</span>
      <span className="r amt">{c.count ? <Hover tip={<TipList title={`${c.category}: ${c.count} transaction${c.count > 1 ? 's' : ''}`}
        rows={c.top.map((t) => [t.name, `${t.amount < 0 ? '−' : ''}${usd2(Math.abs(t.amount))}`, new Date(`${t.date}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })])}
        note={c.count > c.top.length ? `and ${c.count - c.top.length} more` : null} />}>{usd(c.actual)}</Hover> : usd(c.actual)}</span>
      <span className="r">{inGroup ? null : avail != null ? <Remaining value={avail - c.actual} income={income} saving={c.saving} />
        : c.saving && c.actual > 0.5 ? <Remaining value={-c.actual} saving /> : <span className="muted" title="No budget">—</span>}</span>
      {!inGroup && <span className="bmeter"><Meter actual={c.actual} budget={avail} income={income} saving={c.saving} pace={!income && c.kind === 'flexible' ? progress : null} /></span>}
    </div>
  );
}

// The group's less-used actions behind one icon button (same menu as the Goals rows).
function GroupMenu({ label, children }) {
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
    <span className="rowmenu groupmenu" ref={ref}>
      <button type="button" className="rowmenu-btn" aria-label="Group options" title={`Options for ${label}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="12.5" cy="8" r="1.4" /></svg>
      </button>
      {open && <div className="rowmenu-pop" role="group" aria-label={`${label} options`} onClick={() => setOpen(false)}>{children}</div>}
    </span>
  );
}

// One group of the sheet: a title row with the group's totals (click to collapse), its categories, and the
// categories with nothing in them behind "Show N unbudgeted".
function GroupBlock({ id, title, rows, income, progress, save, tags, clear, group, setWhole, month, resetMonth, setRollover }) {
  const [open, setOpen] = useState(() => !recall(`closed.${id}`, false));
  const [more, setMore] = useState(false);
  const active = (c) => c.budget != null || Math.abs(c.actual) >= 0.5 || c.suggested;
  const shown = rows.filter((c) => more || active(c));
  const hidden = rows.length - rows.filter(active).length;
  if (!rows.length) return null;
  const whole = !!group?.whole;
  const budget = whole ? group.groupBudget ?? 0 : rows.reduce((s, c) => s + (c.budget ?? 0), 0), actual = rows.reduce((s, c) => s + c.actual, 0);
  const left = budget - actual;
  const saving = rows.every((c) => c.saving);
  const toggle = () => { setOpen(!open); remember(`closed.${id}`, open); };
  // The group as one budget line (its amount, suggestion and spending), for the header's input and meter.
  const self = whole && { category: title, isGroup: true, budget: group.groupBudget, suggested: group.groupSuggested, basis: 'its categories', kind: group.kind,
    overridden: group.groupOverridden, usual: group.groupUsual };
  return (
    <div className="bgroup">
      <div className={`bhead${whole ? ' whole' : ''}`}>
        <button className="btitle" onClick={toggle} aria-expanded={open}>
          <svg className={`chev${open ? ' open' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>{title}</button>
        <span className="r amt bheadin">{self?.overridden && <span className="ftag mtag">{monthShort(month)} only<button className="tagx" onClick={() => resetMonth(self)} aria-label="Back to the usual amount"><Close /></button></span>}
          {whole ? <BudgetInput c={self} save={save} /> : budget ? usd(budget) : '—'}</span>
        <span className="r amt">{usd(actual)}</span>
        <span className="r">{whole ? (group.groupBudget != null ? <Remaining value={left} income={income} saving={saving} /> : <span className="muted" title="No budget">—</span>)
          : budget ? <Remaining value={left} income={income} saving={saving} /> : null}</span>
        {whole && <span className="bmeter"><Meter actual={actual} budget={group.groupBudget} income={income} saving={saving} pace={!income && group.kind === 'flexible' ? progress : null} /></span>}
      </div>
      {open && shown.map((c) => <Row key={c.category} c={c} income={income} progress={progress} save={save} tags={tags} inGroup={whole} month={month} resetMonth={resetMonth} setRollover={setRollover} />)}
      {open && <div className="bfoot">
        {hidden > 0 && <button className="bmore" onClick={() => setMore(!more)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {more ? 'Hide' : 'Show'} {hidden} unbudgeted</button>}
        {!hidden && <span className="bfill" />}
        {((group && rows.length > 1) || budget > 0) && <GroupMenu label={title}>
          {group && rows.length > 1 && <button type="button" onClick={() => setWhole(group.group, !whole)}
            title={whole ? 'Give each category its own amount, split by recent spending' : 'One amount for the whole group; categories just show what was spent'}>
            {whole ? 'Budget each category' : 'Budget as one amount'}</button>}
          {budget > 0 && <button type="button" onClick={() => clear(whole ? { groups: [group.group] } : {
            categories: rows.filter((c) => c.budget != null && !c.isGroup).map((c) => c.category),
            groups: rows.filter((c) => c.budget != null && c.isGroup).map((c) => c.category) }, title)}>Clear budgets</button>}
        </GroupMenu>}
      </div>}
    </div>
  );
}

// The sheet's column heads (once, at the top) and a section's closing total, which sits on a double rule.
const ColHeads = ({ last = 'Remaining' }) => (
  <div className="bcolhead" role="presentation"><span /><span className="r">Budget</span><span className="r">Actual</span><span className="r">{last}</span></div>
);
// Saved beyond plan (`extra`) isn't counted as over: remaining is against what was spent and planned saving. Income
// received beyond its budget shows as +extra, not a negative remainder.
const Total = ({ title, budget, actual, income, extra = 0, refunds = 0 }) => {
  const left = budget - (actual - extra);
  return (
    <div className="btot">
      <span>{title}</span><span className="r amt">{usd(budget)}</span><span className="r amt">{usd(actual)}</span>
      <span className="r">{extra > 0.5 ? <span className="small muted nowrap" title="Saved beyond plan: not counted as over"><span className="amt">+{usd(extra)}</span> extra</span> : budget ? <Remaining value={left} income={income} /> : null}</span>
      {refunds > 0.5 && <span className="btotnote small muted">Leaves out <span className="amt">{usd(refunds)}</span> of refunds beyond a group's own spending: a refund only offsets its own group.</span>}
    </div>
  );
};

// The page's lead figure: budgeted income not yet given a job. A planning number, not money you can spend.
function Unassigned({ b }) {
  const left = b.leftToBudget, t = b.totals;
  const none = !t.income && !t.expenses;
  if (!t.income && t.expenses > 0) { // spending budgeted but no income: "left" would just be minus the spending
    return (
      <section className="card bassign none">
        <span><b>Budgeted for spending & saving</b><span className="small muted">Add your income below to see what's not yet assigned.</span></span>
        <span className="big amt">{usd(t.expenses)}</span>
      </section>
    );
  }
  return (
    <section className={`card bassign ${left < 0 ? 'neg' : none ? 'none' : ''}`}>
      <span><b><Hover tip={<TipList title="Not yet assigned" rows={[['Income budgeted', usd(t.income)], ['Spending & saving budgeted', `−${usd(t.expenses)}`]]}
        note="Give every dollar of expected income a job: aim for $0. This is a planning number, not money to spend." />}>{left < 0 ? 'Over assigned' : none ? 'Nothing budgeted yet' : 'Not yet assigned'}</Hover></b>
        {left < 0 && <span className="small muted">More is budgeted than your income.</span>}</span>
      <span className="big amt">{left < 0 ? '−' : ''}{usd(Math.abs(left))}</span>
    </section>
  );
}

// Side panel meters: one per line, same colours as the rows.
function Split({ title, t, income, pace, sub, verb }) {
  if (!t.budget) return <div className="bsplit"><div className="row"><span>{title}</span><span className="small muted">no budget yet</span></div>{sub && <div className="small muted">{sub}</div>}
    {t.actual > 0.5 && <div className="small muted"><span className="amt">{usd(t.actual)}</span> {verb ?? (income ? 'received' : 'spent')}</div>}</div>;
  const extra = t.extra ?? 0, left = t.budget - (t.actual - extra); // saved beyond plan isn't "over"
  return (
    <div className="bsplit">
      <div className="row"><span>{title}</span><span className="small muted amt">{usd(t.budget)} budget</span></div>
      <Meter actual={t.actual - extra} budget={t.budget} income={income} pace={pace} />
      <div className="row small"><b className="amt">{usd(t.actual - extra)} {verb ?? (income ? 'received' : 'spent')}</b>
        <span className={`amt ${left < -0.5 && !income ? 'bad' : left > 0.5 && !income && pace != null && (t.actual - extra) / t.budget > pace + 0.1 ? 'warn' : 'good'}`}>
          {usd(Math.abs(left))} {left < -0.5 ? (income ? 'extra' : 'over') : income ? 'to come' : 'remaining'}</span></div>
      {extra > 0.5 && <div className="small muted">Plus <span className="amt">{usd(extra)}</span> saved beyond plan, not counted against it.</div>}
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
        <Split title="Spending" t={t.spending} pace={b.progress} />
        <Split title="Saving" t={t.saving} verb="saved" />
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
  const [closing, setClosing] = useState(false); // the close-out sheet is open
  const [showIdle, setShowIdle] = useState(false); // the unbudgeted groups are expanded
  const load = useCallback(async () => setB(await api(`/budget?month=${month}`)), [month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setClosing(false), [month]);
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
    if (!await confirmDialog({ title: `Fill in ${todo.length} empty budget${todo.length === 1 ? '' : 's'}?`, confirm: 'Fill in budgets',
      body: `Fixed categories use your recurring bills; the rest use your average from ${b.suggestedFrom.map((m) => monthName(m).split(' ')[0]).join(', ')}. About ${usd(total)} a month of spending. You can change any of them afterwards.` })) return;
    for (const c of todo) await put(c, c.suggested);
    load();
  };
  // Clear some budgets (a card's) or all of them. They apply to every month, so say so before clearing.
  const clear = async (which, title) => {
    const n = which ? (which.categories?.length ?? 0) + (which.groups?.length ?? 0) : all.filter((c) => c.budget != null).length;
    if (!n) return;
    if (!await confirmDialog({ title: `Clear ${n} budget${n > 1 ? 's' : ''}${title ? ` in ${title}` : ''}?`, confirm: n > 1 ? 'Clear budgets' : 'Clear budget', danger: true,
      body: 'Budgets apply to every month, so this clears them everywhere. Suggestions stay, so you can fill them in again.' })) return;
    await api('/budgets/clear', { method: 'POST', body: JSON.stringify(which ?? {}) });
    load();
  };
  const none = !b.totals.income && !b.totals.expenses;
  const pickView = (v) => { setView(v); remember('view', v); };
  const cards = view === 'kind'
    ? KINDS.map(([k, title]) => ({ id: `k.${k}`, title, rows: b.expenses.flatMap(lines).filter((c) => kindOf(c) === k) }))
    : b.expenses.map((g) => ({ id: `g.${g.group}`, title: g.group, rows: withGroup(g), group: g }));
  // By group: groups with no budget and no spending this month collapse into one "Not budgeted" line.
  const isIdle = (c) => view === 'group' && c.group && c.group.groupBudget == null && Math.abs(c.group.actual) < 0.5 && c.rows.every((r) => r.budget == null && Math.abs(r.actual) < 0.5);
  const live = cards.filter((c) => !isIdle(c)), idle = cards.filter(isIdle);
  const block = (c) => <GroupBlock key={c.id} id={c.id} title={c.title} rows={c.rows} progress={b.progress} save={save} tags={view !== 'kind'} clear={clear} group={c.group} setWhole={setWhole} {...extra} />;

  return (
    <>
      <PageHeader title="Budget" sub="Amounts repeat every month unless you set one for a single month.">
        <div className="monthnav">
          <button className="iconbtn" onClick={() => setMonth(b.prev)} aria-label="Previous month"><Chevron dir="left" /></button>
          <b>{monthName(month)}</b>
          <button className="iconbtn" onClick={() => setMonth(b.next)} aria-label="Next month"><Chevron /></button>
          <button className="btn" onClick={() => setMonth(thisMonth())} disabled={month === thisMonth()}>Today</button>
          <span className="ranges bscope" title="Where your edits go">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Every month</button>
            <button className={scope === 'month' ? 'on' : ''} onClick={() => setScope('month')}>Only {monthShort(month)}</button>
          </span>
        </div>
      </PageHeader>
      {closeWindow(month) && b.month === month && (closing ? <CloseMonth b={b} onClose={() => { setClosing(false); load(); }} />
        : !b.closed && <section className="card closeprompt mt">
          <span><b>{monthName(month).split(' ')[0]} is over.</b> <span className="muted">Sort what's left, see how it went and set up {monthName(b.next).split(' ')[0]}.</span></span>
          <button className="btn primary" onClick={() => setClosing(true)}>Close out {monthName(month).split(' ')[0]}</button>
        </section>)}
      <Unassigned b={b} />
      <div className="budgetgrid mt">
        <section className="card panel bsheet">
          <div className="head bsheethead"><h2>Income and expenses</h2>
            <span className="ranges bview" title="How expenses are grouped">
              <button className={view === 'group' ? 'on' : ''} onClick={() => pickView('group')}>By group</button>
              <button className={view === 'kind' ? 'on' : ''} onClick={() => pickView('kind')}>Fixed & flexible</button>
            </span></div>
          <ColHeads last="To come" />
          <GroupBlock id="income" title="Income" rows={incomeRows} income progress={b.progress} save={save} clear={clear} group={b.income} setWhole={setWhole} {...extra} />
          <Total title="Total income" budget={b.totals.income} actual={b.totals.incomeActual} income />
          <div className="bsection">Expenses</div>
          <ColHeads />
          {live.map(block)}
          {idle.length > 0 && <div className="bidle">
            <span>Not budgeted: {idle.map((c) => c.title).join(', ')}</span>
            <button className="linkbtn small" onClick={() => setShowIdle(!showIdle)} aria-expanded={showIdle}>{showIdle ? 'Hide' : 'Show'}</button>
          </div>}
          {showIdle && idle.map(block)}
          <Total title="Total spending" budget={b.totals.spending.budget} actual={b.totals.spending.actual} refunds={b.totals.refundsLeftOut} />
          {(b.totals.saving.budget > 0 || b.totals.saving.actual > 0.5) &&
            <Total title="Total saving" budget={b.totals.saving.budget} actual={b.totals.saving.actual} extra={b.totals.saving.extra} />}
        </section>
        <aside className="bside ledger">
          <SidePanel b={b} />
          <div className="bopts">
          <label className="check small btrips"><input type="checkbox" checked={b.trips.counted} onChange={async (e) => {
            await api('/settings/budget-trips', { method: 'PUT', body: JSON.stringify({ on: e.target.checked }) }); load(); }} />
            Count trips in these categories</label>
          {!b.trips.counted && b.trips.left_out > 0 && <p className="small muted btrips">Leaving out <b className="amt">{usd(b.trips.left_out)}</b> spent on <a href="#/trips">trips</a> this month.</p>}
          {!none && <button className="linkbtn bclearall" onClick={() => clear(null)}>Clear the whole budget</button>}
          </div>
          {todo.length > 0 && <Panel title="Suggestions">
            <p className="small muted mt-0">{todo.length} {todo.length === 1 ? 'line has' : 'lines have'} no budget yet. Suggestions come from your recurring bills and your average spending ({b.suggestedFrom.map((m) => monthName(m).split(' ')[0]).join(', ')}). They show as ≈ amounts in dashed boxes until you set them.</p>
            <button className="btn primary" onClick={suggest}>Fill in suggestions</button>
          </Panel>}
        </aside>
      </div>
    </>
  );
}
