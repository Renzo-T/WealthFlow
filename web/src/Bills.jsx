import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd2, shortDate } from './format.js';
import AccountOptions from './AccountOptions.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import BillsCalendar from './BillsCalendar.jsx';
import { Panel, PageHeader, PageSkeleton, Hover, TipList } from './ui.jsx';

const SOURCE = { detected: 'Detected', plaid: 'From Plaid', card: 'Card statement', manual: 'Added by you' };
const MODE = { last: 'Last amount', average: 'Average of recent', fixed: 'Fixed amount', statement: 'Statement balance', minimum: 'Minimum payment', current: 'Current balance' };
const KINDS = [
  ['dom', 'On a day of the month'], ['eom', 'Days before the end of the month'], ['bday', 'On the Nth business day'],
  ['lastbday', 'On the Nth-to-last business day'], ['semi', 'Twice a month (a day and month end)'], ['weeks', 'Every N weeks'], ['months', 'Every N months'],
];
const today = () => new Date().toLocaleDateString('en-CA');

// Signed amount. Estimates (averages, card balances still changing) are marked separately, not with a symbol.
export const billAmount = (b) => `${b.direction === 'in' ? '+' : '−'}${usd2(b.amount)}`;

// Schedule + amount editor, shared by "Edit" and "Add a bill".
function Editor({ bill, card, onSave, onCancel, adding }) {
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
      {err && <span className="bad small">{err}</span>}
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
  if (!list) return <PageSkeleton />;

  const put = (key, body) => api(`/bills/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) });
  const del = async (key) => { await api(`/bills/${encodeURIComponent(key)}`, { method: 'DELETE' }); load(); };
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

  const active = list.filter((b) => !b.hidden && !b.ended), hidden = list.filter((b) => b.hidden), ended = list.filter((b) => !b.hidden && b.ended);
  const monthOut = active.filter((b) => b.direction === 'out' && b.next_date <= new Date(Date.now() + 30 * 864e5).toLocaleDateString('en-CA'))
    .reduce((s, b) => s + b.amount, 0);

  const row = (b) => (
    <Fragment key={b.key}>
      <tr className={b.hidden ? 'dim' : undefined}>
        <td><span className="rowicon"><CategoryIcon group={b.can_card ? 'Debt repayment' : b.direction === 'in' ? 'Income' : b.grp} sub={b.category} kind={b.can_card ? 'card' : undefined} />
          <span><b>{b.name}</b><div className="small muted">{SOURCE[b.source]}{b.edited ? ' · edited' : ''}{b.account ? ` · from ${b.account}` : ''}</div></span></span></td>
        <td>{b.schedule ? <span>{b.schedule[0].toUpperCase() + b.schedule.slice(1)}</span> : '—'}
          {b.card && <div className="small muted">Due {shortDate(b.card.due)}{b.card.paid ? ' · this statement is paid' : ''}</div>}</td>
        <td>{b.ended ? <span className="muted">Missed, probably ended</span> : b.unscheduled
          ? <span className="muted" title="This card's last statement is paid. The next bill appears when the next statement is issued; set the amount to Current balance to pay from usage instead.">Next statement not issued yet</span>
          : b.next_date ? shortDate(b.next_date) : '—'}</td>
        <td className="r"><Hover tip={b.recent?.length ? <TipList title="Recent payments" rows={b.recent.map((r) => [shortDate(r.date), usd2(r.amount)])}
          note={b.card ? `Statement ${usd2(b.card.statement ?? 0)} · current balance ${usd2(b.card.current ?? 0)}` : null} /> : null}>
          <span className={`tamt${b.direction === 'in' ? ' good' : ''}`}>{billAmount(b)}</span></Hover><div className="small muted">{MODE[b.amount_mode]}</div></td>
        <td className="r nowrap">
          <button className="linkbtn" onClick={() => setEditing(editing === b.key ? null : b.key)}>Edit</button>{' '}
          {b.source === 'manual' ? <button className="linkbtn" onClick={() => del(b.key)}>Delete</button>
            : <button className="linkbtn" onClick={async () => { await put(b.key, { hidden: !b.hidden }); load(); }}>{b.hidden ? 'Unhide' : 'Not a bill'}</button>}{' '}
          {b.edited && <button className="linkbtn" onClick={() => del(b.key)} title="Go back to what was detected">Reset</button>}
        </td>
      </tr>
      {editing === b.key && <tr><td colSpan="5"><Editor bill={b} card={b.source === 'card'} onSave={saveEdit(b)} onCancel={() => setEditing(null)} /></td></tr>}
    </Fragment>
  );

  return (
    <>
      <PageHeader title="Bills" sub="Recurring bills, autopays and income: found in your transactions, from Plaid, from card statements, or added by you. Your edits always win.">
        <button className="btn primary" onClick={() => setAdding(!adding)}>Add a bill</button></PageHeader>
      {adding && <Panel className="mt" title="Add a bill or recurring income">
        <Editor adding onSave={add} onCancel={() => setAdding(false)} /></Panel>}
      <PaycheckPrompt onDone={load} />
      <p className="small muted" style={{ margin: '1rem 0 .5rem' }}>{active.length} active · <b className="amt">{usd2(monthOut)}</b> going out in the next 30 days</p>
      <div className="billsgrid">
      <section className="card scroll sticky-head">
        <table className="t billtable">
          <thead><tr><th>Bill</th><th>Schedule</th><th>Next</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>{active.map(row)}</tbody>
        </table>
        {active.length === 0 && <div className="empty">Nothing recurring found yet. Bills show up after they repeat a couple of times, or add one yourself.</div>}
      </section>
      <BillsCalendar />
      </div>
      {ended.length > 0 && <section className="card mt scroll">
        <div className="head" style={{ padding: '.25rem .25rem .5rem' }}><h2 style={{ fontSize: '1rem', margin: 0 }}>Possibly ended</h2></div>
        <table className="t"><tbody>{ended.map(row)}</tbody></table></section>}
      {hidden.length > 0 && <p className="small mt">
        <button className="linkbtn" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} {hidden.length} marked "not a bill"</button></p>}
      {showHidden && <section className="card scroll"><table className="t"><tbody>{hidden.map(row)}</tbody></table></section>}
      <p className="small muted mt">
        Detected schedules account for weekends and bank holidays: a bill due on a Saturday usually posts the next business day.
        "~" amounts are estimates. Card payments use your statement balance once your bank shares card statements.</p>
    </>
  );
}
