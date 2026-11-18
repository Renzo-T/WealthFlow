import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd2, shortDate } from './format.js';
import AccountOptions from './AccountOptions.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import MonthSpread from './MonthSpread.jsx';
import { Stamp, markIcon } from './Stamp.jsx';
import { Panel, PageHeader, PageSkeleton, Skeleton, Hover, TipList, notice, toast } from './ui.jsx';

const SOURCE = { detected: 'Detected', plaid: 'From Plaid', card: 'Card statement', manual: 'Added by you' };
const MODE = { last: 'Last amount', average: 'Average of recent', fixed: 'Fixed amount', statement: 'Statement balance', minimum: 'Minimum payment', current: 'Current balance' };
const KINDS = [
  ['dom', 'On a day of the month'], ['eom', 'Days before the end of the month'], ['bday', 'On the Nth business day'],
  ['lastbday', 'On the Nth-to-last business day'], ['semi', 'Twice a month (a day and month end)'], ['weeks', 'Every N weeks'], ['months', 'Every N months'],
];
// Fixed columns: the name takes what's left (truncated, full name on hover); the schedule is the short form (the full
// rule on hover); amount keeps its width. Click a row to edit it; the less common actions live in the editor.
// "Detected" is the usual case, so it isn't said; only a different source (or your own edit) is named.
const srcLine = (b) => [b.pinned ? 'Your schedule' : b.source === 'detected' ? null : SOURCE[b.source], b.edited && !b.pinned ? 'edited' : null,
  b.account ? `${b.direction === 'in' ? 'into' : 'from'} ${b.account}` : null].filter(Boolean).join(' · ');
const BillCols = () => <colgroup><col /><col className="c-sched" /><col className="c-next" /><col className="c-amt" /></colgroup>;
const today = () => new Date().toLocaleDateString('en-CA');
// The date of a bill's latest charge once it has posted: a dated fact that has happened, so it gets a stamp.
const paidOn = (b) => { const d = b.recent?.[0]?.date ?? b.last_date; return d && d <= today() ? d : null; };

// Signed amount. Estimates (averages, card balances still changing) are marked separately, not with a symbol.
export const billAmount = (b) => `${b.direction === 'in' ? '+' : '−'}${usd2(b.amount)}`;

// Schedule + amount editor, shared by "Edit" and "Add a bill".
function Editor({ bill, card, onSave, onCancel, adding, extra }) {
  const r0 = bill?.rule ?? { kind: 'dom', n: 1, roll: 1 };
  const [f, setF] = useState({
    name: bill?.name ?? '', kind: r0.kind, n: r0.n ?? 1, roll: r0.roll ?? 0, anchor: r0.anchor ?? bill?.next_date ?? today(), day: r0.day ?? 1,
    mode: bill?.amount_mode ?? 'fixed', amount: bill?.amount ? bill.amount.toFixed(2) : '', direction: bill?.direction ?? 'out', account_id: '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kinds = card ? [['due', "Days before the card's due date"], ...KINDS] : KINDS;
  const modes = card ? ['statement', 'minimum', 'current', 'average', 'fixed'] : adding ? ['fixed'] : ['last', 'average', 'fixed'];
  const save = async (e) => {
    e.preventDefault();
    const rule = { kind: f.kind, n: +f.n, roll: +f.roll, anchor: f.anchor, day: +f.day };
    const r = await onSave({ name: f.name, rule, amount_mode: f.mode, amount: f.mode === 'fixed' ? +f.amount : undefined, direction: f.direction, account_id: f.account_id });
    if (r?.error_message) setErr(r.error_message);
  };
  const rollSel = (
    <label className="lbl">If it's a weekend or holiday
      <select value={f.roll} onChange={set('roll')}><option value="0">Same day</option><option value="1">Next business day</option><option value="-1">Business day before</option></select></label>
  );
  return (
    <form className="form billform" onSubmit={save}>
      {(adding || bill) && <label className="lbl">Name<input value={f.name} onChange={set('name')} placeholder="Gym membership" required={adding} /></label>}
      {adding && <label className="lbl">Type<select value={f.direction} onChange={set('direction')}><option value="out">Bill (money out)</option><option value="in">Income (money in)</option></select></label>}
      <label className="lbl">Schedule<select value={f.kind} onChange={set('kind')}>{kinds.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
      {f.kind === 'dom' && <><label className="lbl">Day<input className="mini" type="number" min="1" max="31" value={f.n} onChange={set('n')} /></label>{rollSel}</>}
      {f.kind === 'semi' && <><label className="lbl">Day<input className="mini" type="number" min="1" max="28" value={f.n} onChange={set('n')} /></label>
        <span className="small muted">and the last day of the month</span>{rollSel}</>}
      {f.kind === 'eom' && <><label className="lbl">Days before month end<input className="mini" type="number" min="0" max="27" value={f.n} onChange={set('n')} /></label>{rollSel}</>}
      {(f.kind === 'bday' || f.kind === 'lastbday') && <label className="lbl">N<input className="mini" type="number" min="1" max="20" value={f.n} onChange={set('n')} /></label>}
      {f.kind === 'due' && <label className="lbl">Days before due<input className="mini" type="number" min="0" max="25" value={f.n} onChange={set('n')} /></label>}
      {f.kind === 'weeks' && <><label className="lbl">Every<input className="mini" type="number" min="1" max="8" value={f.n} onChange={set('n')} /></label>
        <label className="lbl">Next one on<input type="date" value={f.anchor} onChange={set('anchor')} /></label></>}
      {f.kind === 'months' && <><label className="lbl">Every (months)<input className="mini" type="number" min="1" max="24" value={f.n} onChange={set('n')} /></label>
        <label className="lbl">Next one on<input type="date" value={f.anchor} onChange={(e) => setF({ ...f, anchor: e.target.value, day: +e.target.value.slice(8) })} /></label></>}
      <label className="lbl">Amount<select value={f.mode} onChange={set('mode')}>{modes.map((m) => <option key={m} value={m}>{MODE[m]}</option>)}</select></label>
      {f.mode === 'fixed' && <label className="lbl">$<input className="mini" type="number" min="0.01" step="0.01" value={f.amount} onChange={set('amount')} required /></label>}
      {adding && <label className="lbl">Paid from (optional)<AccountSelect value={f.account_id} onChange={set('account_id')} /></label>}
      <button className="btn primary" type="submit">{adding ? 'Add' : 'Save'}</button>
      <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      {extra && <span className="billform-extra">{extra}</span>}
      {err && <span className="bad small">{err}</span>}
    </form>
  );
}

// How often a payment comes, for "this repeats" (the server turns it into a rule from the payment's date).
export const HOW_OFTEN = [['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Every month'],
  ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
const fromPayment = (id, cadence, name) => api('/bills/from-payment', { method: 'POST', body: JSON.stringify({ id, cadence, name }) })
  .catch((e) => ({ error_message: e.message }));

// On a transaction: "Repeats: Doesn't repeat ▾". Picking how often makes it a bill that follows its real payments.
export function RepeatPick({ t, onDone }) {
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const sel = e.target, cadence = sel.value;
    if (!cadence) return;
    const r = await fromPayment(t.id, cadence);
    if (r.error_message) { setErr(r.error_message); sel.value = ''; return; }
    setErr('');
    toast(`${r.name} is on Bills now${r.next_date ? `, next ${shortDate(r.next_date)}` : ''}`);
    onDone?.(r);
  };
  return <><select className="repeatpick" defaultValue="" onChange={pick} aria-label="How often this repeats">
    <option value="">Doesn't repeat</option>{HOW_OFTEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {err && <span className="bad small"> {err}</span>}</>;
}

// Adding a bill starts from a payment you've already made: the bill then follows its real payments (paid stamps,
// amounts), and a pattern found later is the same bill, never a second copy. Typing one in is for money that never
// passes through a connected account.
function AddBill({ onAdded, onCancel, addManual }) {
  const [manual, setManual] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState(null);
  const [cadence, setCadence] = useState('monthly');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let on = true;
    const from = new Date(Date.now() - 395 * 864e5).toLocaleDateString('en-CA');
    // Newest first, one row per payee (its latest payment): the schedule is about the payee, not one charge.
    const firstOfEach = (list) => list.filter((t, i) => list.findIndex((x) => (x.display ?? x.name) === (t.display ?? t.name) && (x.amount > 0) === (t.amount > 0)) === i).slice(0, 8);
    const id = setTimeout(() => api(`/transactions?limit=60&from=${from}&q=${encodeURIComponent(q.trim())}`)
      .then((r) => on && setRows(Array.isArray(r) ? firstOfEach(r) : [])).catch(() => on && setRows([])), q ? 200 : 0);
    return () => { on = false; clearTimeout(id); };
  }, [q]);
  if (manual) return <Editor adding onSave={addManual} onCancel={onCancel} extra={<button type="button" className="linkbtn" onClick={() => setManual(false)}>Pick a past payment instead</button>} />;
  const add = async (e) => {
    e.preventDefault();
    const r = await fromPayment(picked.id, cadence, name);
    if (r.error_message) return setErr(r.error_message);
    toast(`${r.name} is on Bills now${r.next_date ? `, next ${shortDate(r.next_date)}` : ''}`);
    onAdded();
  };
  return (
    <form className="addbill" onSubmit={add}>
      <p className="small muted">Pick a payment you've made and say how often it comes. The bill then follows its real payments.</p>
      <input type="search" className="addbill-q" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); setErr(''); }}
        placeholder="Search your payments from the last year" aria-label="Search your payments" autoFocus />
      <div className="addbill-list" role="listbox" aria-label="Payments">
        {rows === null ? <Skeleton h={22} /> : rows.length === 0 ? <p className="small muted">No payments match.</p>
          : rows.map((t) => (
            <button type="button" role="option" aria-selected={picked?.id === t.id} key={t.id} className={`addbill-row${picked?.id === t.id ? ' on' : ''}`}
              onClick={() => { setPicked(t); setName(''); setErr(''); }}>
              <span className="small muted">{shortDate(t.date)}</span><span className="addbill-name" title={t.display ?? t.name}>{t.display ?? t.name}</span>
              <span className="small muted addbill-acct">{t.recurring ? `On Bills as ${t.bill?.name}` : t.account}</span>
              <span className={`tamt small${t.amount < 0 ? ' good' : ''}`}>{t.amount < 0 ? '+' : '−'}{usd2(Math.abs(t.amount))}</span>
            </button>))}
      </div>
      {picked && <div className="form addbill-how">
        <label className="lbl">How often<select value={cadence} onChange={(e) => setCadence(e.target.value)}>{HOW_OFTEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="lbl">Name (optional)<input value={name} onChange={(e) => setName(e.target.value)} placeholder={picked.display ?? picked.name} maxLength={60} /></label>
        <button className="btn primary" type="submit">Add</button>
        {err && <span className="bad small">{err}</span>}
      </div>}
      <div className="addbill-foot small">
        <button type="button" className="linkbtn" onClick={() => setManual(true)}>Paid outside your connected accounts? Enter it yourself</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AccountSelect({ value, onChange }) {
  const [accts, setAccts] = useState([]);
  useEffect(() => { api('/accounts').then(setAccts); }, []);
  return <select value={value} onChange={onChange}><option value="">None</option><AccountOptions accounts={accts} /></select>;
}

// "Is this your paycheck? How often are you paid?" for a recent salary deposit with no schedule yet (with only one
// paycheck in your history there's no pattern to find). Answering adds it as recurring income; used here and in Upcoming.
const CADENCES = [['biweekly', 'Every 2 weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly'], ['weekly', 'Weekly']];
export function PaycheckPrompt({ compact, onDone }) {
  const [list, setList] = useState([]);
  const load = useCallback(async () => setList(await api('/bills/paychecks')), []);
  useEffect(() => { load(); }, [load]);
  const answer = async (key, cadence) => {
    await api('/bills/paychecks', { method: 'POST', body: JSON.stringify({ key, cadence }) });
    await load(); onDone?.();
  };
  if (!list.length) return null;
  return list.map((c) => (
    <div className={`paycheck${compact ? ' compact' : ' card mt'}`} key={c.key}>
      <div><b>Is {c.name} your paycheck?</b>
        <div className="small muted"><span className="amt">{usd2(c.amount)}</span> into {c.account} on {shortDate(c.date)}. How often are you paid? It'll show in Upcoming and set payday for Safe to spend.</div></div>
      <div className="btnrow">
        {CADENCES.map(([k, l]) => <button key={k} className="chipbtn" onClick={() => answer(c.key, k)}>{l}</button>)}
        <button className="linkbtn" onClick={() => answer(c.key, 'no')}>Not a paycheck</button>
      </div>
    </div>
  ));
}

export default function Bills() {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const load = useCallback(async () => setList(await api('/bills')), []);
  useEffect(() => { load(); }, [load]);
  // The month shown in the spread; each day's bills and paydays are in its hover.
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  if (!list) return <PageSkeleton />;

  const put = async (key, body) => {
    const r = await api(`/bills/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) }).catch((e) => ({ error_message: e.message }));
    if (r.error_message && body.hidden !== undefined) notice({ title: "Couldn't save that", body: r.error_message }); // the editor shows its own errors
    return r;
  };
  const del = async (key) => { await api(`/bills/${encodeURIComponent(key)}`, { method: 'DELETE' }); setEditing(null); load(); };
  const hide = async (b) => {
    await put(b.key, { hidden: !b.hidden }); setEditing(null); load();
    if (!b.hidden) toast(`${b.name} marked not a bill`, { undo: async () => { await put(b.key, { hidden: false }); load(); } });
  };
  // A bill you added that your transactions now show too: the found one is counted; remove yours, or count both.
  const different = async (b) => {
    await api('/bills/distinct', { method: 'POST', body: JSON.stringify({ a: b.key, b: b.same_as.key }) }); load();
  };
  const saveEdit = (b) => async (body) => {
    const r = await put(b.key, { name: body.name === b.name ? undefined : body.name, rule: body.rule, amount_mode: body.amount_mode, amount: body.amount });
    if (!r.error_message) { setEditing(null); load(); }
    return r;
  };
  const add = async (body) => {
    const r = await api('/bills', { method: 'POST', body: JSON.stringify({ ...body, amount: body.amount }) });
    if (!r.error_message) { setAdding(false); load(); }
    return r;
  };

  const setAside = list.filter((b) => b.same_as && !b.hidden);
  const active = list.filter((b) => !b.hidden && !b.ended && !b.same_as), hidden = list.filter((b) => b.hidden), ended = list.filter((b) => !b.hidden && b.ended);
  const monthOut = active.filter((b) => b.direction === 'out' && b.next_date <= new Date(Date.now() + 30 * 864e5).toLocaleDateString('en-CA'))
    .reduce((s, b) => s + b.amount, 0);

  const toggle = (b) => setEditing(editing === b.key ? null : b.key);
  const row = (b) => (
    <Fragment key={b.key}>
      <tr className={`billrow${b.hidden ? ' dim' : ''}${editing === b.key ? ' open' : ''}`} tabIndex={0} aria-expanded={editing === b.key}
        title="Click to edit" onClick={(e) => { if (!e.target.closest('button, a')) toggle(b); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggle(b); } }}>
        <td><span className="rowicon"><CategoryIcon group={b.can_card ? 'Debt repayment' : b.direction === 'in' ? 'Income' : b.grp} sub={b.category} kind={b.can_card ? 'card' : undefined} />
          <span className="bname1"><b title={b.name}>{b.name}</b>{srcLine(b) && <div className="small muted" title={srcLine(b)}>{srcLine(b)}</div>}</span></span>
</td>
        <td title={b.schedule ? b.schedule[0].toUpperCase() + b.schedule.slice(1) : undefined}>{b.schedule_short || '—'}
          {b.card && <div className="small muted">Due {shortDate(b.card.due)}{b.card.paid ? ' · paid' : ''}</div>}</td>
        <td>{b.ended ? <span className="muted" title={b.next_date ? `Expected ${shortDate(b.next_date)} and nothing came` : undefined}>Missed{b.next_date ? ` ${shortDate(b.next_date)}` : ''}</span> : b.unscheduled
          ? <span className="muted" title="This card's last statement is paid. The next bill appears when the next statement is issued; set the amount to Current balance to pay from usage instead.">Next statement</span>
          : b.next_date ? shortDate(b.next_date) : '—'}</td>
        <td className="r"><Hover tip={b.recent?.length ? <TipList title="Recent payments" rows={b.recent.map((r) => [shortDate(r.date), usd2(r.amount)])}
          note={b.card ? `Statement ${usd2(b.card.statement ?? 0)} · current balance ${usd2(b.card.current ?? 0)}` : null} /> : null}>
          <span className={`tamt${b.direction === 'in' ? ' good' : ''}`}>{billAmount(b)}</span></Hover>
          {paidOn(b) && <div className="small muted paidline"><Stamp kind={b.direction === 'in' ? 'in' : 'out'} done icon={markIcon(b)} className="mini" />{b.direction === 'in' ? 'Received' : 'Paid'} {shortDate(paidOn(b))}</div>}
          {(b.amount_mode !== 'last' || !paidOn(b)) && <div className="small muted">{MODE[b.amount_mode]}</div>}</td>
      </tr>
      {editing === b.key && <tr className="billedit"><td colSpan="4"><Editor bill={b} card={b.source === 'card'} onSave={saveEdit(b)} onCancel={() => setEditing(null)}
        extra={<>
          {b.source === 'manual' ? <button type="button" className="linkbtn bad" onClick={() => del(b.key)}>Delete this bill</button>
            : <button type="button" className="linkbtn" onClick={() => hide(b)}>{b.hidden ? 'It is a bill' : 'Not a bill'}</button>}
          {b.edited && !b.pinned && <button type="button" className="linkbtn" onClick={() => del(b.key)} title="Go back to what was detected">Reset to detected</button>}
          {b.pinned && <button type="button" className="linkbtn bad" onClick={() => del(b.key)} title="Its payments stay; they just aren't a bill">Remove this bill</button>}
        </>} /></td></tr>}
    </Fragment>
  );
  const outgoing = active.filter((b) => b.direction !== 'in'), incoming = active.filter((b) => b.direction === 'in');
  const head = (label) => <thead><tr><th>{label}</th><th>Schedule</th><th>Next</th><th className="r">Amount</th></tr></thead>;

  return (
    <>
      <PageHeader title="Bills" sub="From your transactions, statements, Plaid or your own entries; your edits always win.">
        <button className="btn primary" onClick={() => setAdding(!adding)}>Add a bill</button></PageHeader>
      <div className="mt"><MonthSpread month={month} onMonth={setMonth} dots={false} /></div>
      {adding && <Panel className="mt" title="Add a bill or recurring income">
        <AddBill addManual={add} onAdded={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} /></Panel>}
      <PaycheckPrompt onDone={load} />
      <p className="small muted billcount">{active.length} active · <b className="amt">{usd2(monthOut)}</b> going out in the next 30 days</p>
      <section className="card scroll sticky-head mt-sm">
        <table className="t billtable">
          <BillCols />
          {head('Bills')}
          <tbody>{outgoing.map(row)}</tbody>
          {incoming.length > 0 && <>{head('Money in')}<tbody>{incoming.map(row)}</tbody></>}
        </table>
        {active.length === 0 && <div className="empty">Nothing recurring found yet. Bills show up after they repeat a couple of times, or add one yourself.</div>}
        {setAside.map((b) => <p key={b.key} className="small muted foot billaside">
          <b>{b.name}</b>, which you added, now follows your transactions ({b.same_as.name}), so your copy isn't counted.{' '}
          <button className="linkbtn" onClick={() => del(b.key)}>Remove your copy</button>{' · '}
          <button className="linkbtn" onClick={() => different(b)}>They're two different things</button></p>)}
      </section>
      {ended.length > 0 && <section className="card mt scroll">
        <table className="t billtable"><BillCols />{head('Possibly ended')}<tbody>{ended.map(row)}</tbody></table>
        <p className="small muted foot">An expected payment didn't come, so these are left out of Upcoming and Free to spend. One that charges again comes back on its own.</p></section>}
      {hidden.length > 0 && <p className="small mt">
        <button className="linkbtn" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} {hidden.length} marked "not a bill"</button></p>}
      {showHidden && <section className="card scroll"><table className="t billtable"><BillCols /><tbody>{hidden.map(row)}</tbody></table></section>}
      <p className="small muted mt">
        Click a bill to change its schedule or amount, or to mark it not a bill. Schedules account for weekends and bank holidays.</p>
    </>
  );
}
