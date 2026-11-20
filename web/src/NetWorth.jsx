import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { usd, usd2, signed, label, SERIES, NEUTRAL, shortDate, tint } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList, tipText, Trend, Est, confirmDialog } from './ui.jsx';
import NetWorthChart from './NetWorthChart.jsx';
import { ConnectBank, UpdateLink, missing } from './Connect.jsx';

// Net worth page: the net worth chart and summary, every account by type (click one for this month's activity
// and its settings), each bank's connection with what to do about it, and assets Plaid can't see.

const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

// Rename in place: saves on Enter or when the field loses focus. Empty restores the bank's name.
export function Nickname({ a, saved }) {
  const [v, setV] = useState(a.nickname ?? '');
  const save = async () => {
    if (v.trim() === (a.nickname ?? '')) return;
    await api(`/accounts/${a.id}/nickname`, { method: 'PATCH', body: JSON.stringify({ nickname: v }) });
    saved();
  };
  return (
    <div className="tmain">
      <input className="nick" value={v} placeholder={a.bank_name} onChange={(e) => setV(e.target.value)} onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Nickname for ${a.bank_name}`} />
      <span className="small muted">{a.institution}{a.nickname ? ` · ${a.bank_name}` : ''}{a.mask ? ` ••${a.mask}` : ''}</span>
    </div>
  );
}

// Common kinds, as Plaid type/subtype. An account's current kind is added to the list if it isn't here.
const ACCOUNT_TYPES = [
  ['depository/checking', 'Checking'], ['depository/savings', 'Savings'], ['depository/cash management', 'Cash management'],
  ['depository/money market', 'Money market'], ['depository/cd', 'CD'], ['credit/credit card', 'Credit card'],
  ['investment/brokerage', 'Brokerage'], ['investment/401k', '401(k)'], ['investment/ira', 'IRA'], ['investment/roth', 'Roth IRA'],
  ['investment/hsa', 'HSA'], ['loan/mortgage', 'Mortgage'], ['loan/auto', 'Auto loan'], ['loan/student', 'Student loan'],
  ['loan/loan', 'Other loan'], ['other/other', 'Other'],
];
export function AccountType({ a, saved }) {
  const cur = `${a.type}/${a.subtype ?? a.type}`;
  const bank = `${a.plaid_type}/${a.plaid_subtype ?? a.plaid_type}`;
  const opts = ACCOUNT_TYPES.some(([v]) => v === cur) ? ACCOUNT_TYPES : [[cur, label(a.subtype || a.type)], ...ACCOUNT_TYPES];
  const change = async (v) => {
    const body = v === 'reset' ? { reset: true } : { type: v.split('/')[0], subtype: v.split('/')[1] };
    await api(`/accounts/${a.id}/type`, { method: 'PATCH', body: JSON.stringify(body) });
    saved();
  };
  return (
    <div className="tmain">
      <select className="catsel" value={cur} onChange={(e) => change(e.target.value)} aria-label={`Type of ${a.name}`}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        {a.type_overridden ? <option value="reset">Reset to the bank's type</option> : null}
      </select>
      {a.type_overridden && cur !== bank ? <span className="small muted">Bank says {label(a.plaid_subtype || a.plaid_type)}</span> : null}
    </div>
  );
}

const KINDS = { real_estate: 'Real estate', vehicle: 'Vehicle', investment: 'Investment account', receivable: 'Money owed to you',
  other: 'Other asset', liability: 'Loan or debt you owe' };
const today = () => new Date().toLocaleDateString('en-CA');
const longDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const valueOn = (entries, date) => entries.reduce((v, e) => (e.date <= date ? e.value : v), 0);
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

// One value in an asset's history: the date it counts from, and the amount, edited in place (saved on blur or Enter).
function ValueRow({ a, e, txn, removable, saved }) {
  const [v, setV] = useState(String(e.value));
  const save = async () => {
    if (Number(v) === e.value || v === '') return setV(String(e.value));
    await post(`/assets/${a.id}/values`, { date: e.date, value: v }); saved();
  };
  return (
    <div className="valrow">
      <span className="tmain"><span>{e.date ? `From ${longDate(e.date)}` : 'From the start'}</span>
        {txn ? <span className="small muted">with {txn}</span> : !e.date ? <span className="small muted">before any history Mizo Money has</span> : null}</span>
      <input className="mini amt" type="number" min="0" step="any" value={v} onChange={(ev) => setV(ev.target.value)} onBlur={save}
        onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()} aria-label={`Value ${e.date ? `from ${longDate(e.date)}` : 'from the start'}`} />
      {removable ? <button className="linkbtn" onClick={async () => { await api(`/assets/${a.id}/values/${e.id}`, { method: 'DELETE' }); saved(); }}>Remove</button> : <span />}
    </div>
  );
}

// An asset or debt you added: its value over time (each value counts from its date, so net worth history keeps the
// old one before it), a new value from a date, and recent transfers out of your linked accounts that may have gone into it.
function AssetRow({ a, candidates, open, setOpen, saved }) {
  const [f, setF] = useState({ value: '', date: today() });
  const [err, setErr] = useState('');
  const debt = a.kind === 'liability';
  const last = a.entries.at(-1);
  const rename = async (name) => { if (name.trim() && name.trim() !== a.name) { await api(`/assets/${a.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }); saved(); } };
  const setValue = async (e) => {
    e.preventDefault();
    const r = await post(`/assets/${a.id}/values`, f);
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setF({ value: '', date: today() }); saved();
  };
  const link = async (t, mode) => { const r = await post(`/assets/${a.id}/link`, { tx_id: t.id, mode }); setErr(r.error_message ?? ''); saved(); };
  const remove = async () => {
    if (!await confirmDialog({ title: `Remove ${a.name}?`, body: "It stops counting toward net worth, including its history.", confirm: "Remove", danger: true })) return;
    await api(`/assets/${a.id}`, { method: 'DELETE' }); saved();
  };
  return (
    <>
      <div className="arow" onClick={() => setOpen(open ? null : `m${a.id}`)} role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(open ? null : `m${a.id}`)}>
        <span className="tmain"><b>{a.name}</b><span className="small muted">{KINDS[a.kind] ?? 'Other asset'} · added by you
          {last?.date ? ` · ${a.entries.length > 1 ? 'value from' : 'since'} ${shortDate(last.date)}` : ''}</span></span>
        <span />
        <span className="r"><b className={`amt${debt ? ' bad' : ''}`}>{debt && a.value >= 0.005 ? '−' : ''}{usd2(a.value)}</b></span>
      </div>
      {open && (
        <div className="aedit asset">
          <div className="aedit-row">
            <label className="lbl">Name<input defaultValue={a.name} onBlur={(e) => rename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /></label>
            <label className="lbl">Kind<select value={a.kind} onChange={async (e) => { await api(`/assets/${a.id}`, { method: 'PATCH', body: JSON.stringify({ kind: e.target.value }) }); saved(); }}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <button className="linkbtn" onClick={remove}>Remove</button>
          </div>
          <div className="valhist">
            <span className="colhead">Value over time</span>
            {a.entries.map((e) => <ValueRow key={`${e.id}-${e.value}`} a={a} e={e} txn={e.tx_id ? e.tx_name ?? 'a transfer' : null} removable={a.entries.length > 1} saved={saved} />)}
          </div>
          <form className="form mt-0" onSubmit={setValue}>
            <label className="lbl">New value<input className="mini" type="number" min="0" step="any" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required /></label>
            <label className="lbl">From<input type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
            <button className="btn" type="submit">Save value</button>
          </form>
          {err && <p className="bad small mt-0">{err}</p>}
          {candidates.length > 0 && (
            <div className="valhist">
              <span className="colhead">Money that left your linked accounts</span>
              <p className="small muted mt-0">If one of these went {debt ? `toward ${a.name}` : `into ${a.name}`}, count it here so history shows it moving, not leaving.</p>
              {candidates.map((t) => {
                const delta = (debt ? -1 : 1) * t.amount;
                return (
                  <div className="valrow cand" key={t.id}>
                    <span className="tmain"><span>{t.name}</span><span className="small muted">{shortDate(t.date)} · {t.account}</span></span>
                    <b className="amt">{signed(-t.amount)}</b>
                    <span className="btnrow">
                      <button className="btn" onClick={() => link(t, 'add')} title={`${a.name} goes from ${usd2(valueOn(a.entries, t.date))} to ${usd2(Math.max(0, valueOn(a.entries, t.date) + delta))} on ${shortDate(t.date)}`}>
                        {delta >= 0 ? 'Add to its value' : 'Take off its value'}</button>
                      <button className="linkbtn" onClick={() => link(t, 'included')} title={`Keeps today's value; the days before ${shortDate(t.date)} count ${usd2(Math.abs(delta))} ${delta >= 0 ? 'less' : 'more'}`}>
                        Already in its value</button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function YourAssets({ manual, candidates, open, setOpen, saved }) {
  const [f, setF] = useState({ name: '', value: '', kind: 'real_estate', since: '' });
  const [err, setErr] = useState('');
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    const r = await post('/assets', f);
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setF({ ...f, name: '', value: '', since: '' }); saved();
  };
  const total = manual.reduce((s, m) => s + (m.kind === 'liability' ? -m.value : m.value), 0);
  return (
    <Panel className="mt-lg" title="Assets and debts you added" actions={manual.length ? <b className="amt">{total < -0.005 ? '−' : ''}{usd(Math.abs(total))}</b> : null}>
      {manual.map((m) => <AssetRow key={m.id} a={m} candidates={candidates} open={open === `m${m.id}`} setOpen={setOpen} saved={saved} />)}
      <form className="form" onSubmit={add}>
        <label className="lbl">Name<input value={f.name} onChange={on('name')} placeholder="Home" required /></label>
        <label className="lbl">Value<input type="number" min="1" step="any" value={f.value} onChange={on('value')} placeholder="350000" required /></label>
        <label className="lbl">Kind<select value={f.kind} onChange={on('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="lbl" title="Leave empty if you had it before Mizo Money's history starts">Yours since (optional)<input type="date" value={f.since} max={today()} onChange={on('since')} /></label>
        <button className="btn primary" type="submit">Add to net worth</button>
      </form>
      {err && <p className="bad small">{err}</p>}
    </Panel>
  );
}
const GROUPS = [
  ['depository', 'Cash'], ['credit', 'Credit cards'], ['investment', 'Investments'], ['loan', 'Loans'], ['other', 'Other'],
];
const isDebt = (a) => a.type === 'credit' || a.type === 'loan';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// Signed change for display: for debts, the balance going up is bad, so colour by what it means for net worth.
// `neutral`: a group's total moves when money moves between accounts, so it isn't coloured good or bad.
const Change = ({ v, debt, suffix = '', since, neutral }) => {
  if (v == null) return <span className="small muted" title="Investment values can't be worked out backwards, so history starts when Mizo Money started tracking">
    {since ? `tracking since ${shortDate(since)}` : 'no history yet'}</span>;
  if (Math.abs(v) < 0.5) return <span className="small muted">no change{suffix}</span>;
  const good = debt ? v < 0 : v > 0;
  return <span className={`small amt${neutral ? ' muted' : good ? ' good' : ' bad'}`}><Trend up={v > 0} /> {usd(Math.abs(v))}{suffix}</span>;
};

// 30-day trend, coloured by what the change means for net worth (a debt going up is bad). A flat line
// says nothing, so it's left out; estimated history stays dashed.
function Spark({ data, estimated, debt }) {
  if (!data || data.length < 2 || Math.abs(data.at(-1) - data[0]) < 0.5 && Math.max(...data) - Math.min(...data) < 0.5) return <span className="aspark" />;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const xy = data.map((v, i) => [(i / (data.length - 1)) * 92 + 2, 25 - ((v - lo) / span) * 21]);
  const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const d = data.at(-1) - data[0];
  const color = Math.abs(d) < 0.5 ? 'var(--muted)' : (debt ? d < 0 : d > 0) ? 'var(--green)' : 'var(--red)';
  const [ex, ey] = xy.at(-1);
  return (
    <svg className="aspark" viewBox="0 0 96 28" aria-hidden="true">
      <polygon points={`2,27 ${pts} 94,27`} style={{ fill: color }} opacity=".1" />
      <polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="1.75" strokeDasharray={estimated ? '3 2.5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="2.5" style={{ fill: color }} />
    </svg>
  );
}

const avatarColor = (s) => SERIES[[...(s ?? '?')].reduce((h, c) => h + c.charCodeAt(0), 0) % SERIES.length];
export const Avatar = ({ name }) => <span className="avatar" style={{ background: tint(avatarColor(name), 13), color: avatarColor(name) }}>{(name ?? '?')[0]}</span>;

// A bank's connection, in words: working, needs you, failing (tried again on its own), or could share more.
function BankStatus({ i }) {
  const more = missing(i);
  if (i.state === 'sign-in') return <span className="small bad" title={i.status}>Needs you to sign in again</span>;
  if (i.state === 'error') return <span className="small hint" title={i.status}>Couldn't update: {i.reason}. Tried again at the next sync.</span>;
  if (more.products) return <span className="small hint">Can also share {more.text}</span>;
  return <span className="small good">Connected</span>;
}

function Banks({ meta, accounts, saved }) {
  const remove = async (i) => {
    if (!await confirmDialog({ title: `Remove ${i.institution}?`, body: "This disconnects it from Plaid and deletes its accounts, transactions, and history from this app. On the Trial plan it does NOT free up a connection slot.", confirm: "Remove bank", danger: true })) return;
    let r = await api(`/items/${i.id}`, { method: 'DELETE' });
    if (r.can_force && await confirmDialog({ title: "Remove it anyway?", body: `Plaid could not remove it: ${r.error_message}`, confirm: "Remove anyway", danger: true })) r = await api(`/items/${i.id}?force=1`, { method: "DELETE" });
    saved();
  };
  return (
    <Panel className="mt-lg" title="Your banks">
      {meta.items.map((i) => {
        const more = missing(i);
        const n = accounts.filter((a) => a.item_id === i.id).length;
        return (
          <div className="trow" key={i.id}>
            <span className="rowicon"><Avatar name={i.institution} />
              <span className="tmain"><b>{i.institution}</b>
                <span><BankStatus i={i} /><span className="small muted"> · {n ? `${n} account${n > 1 ? 's' : ''}` : 'no accounts yet; a new connection can take a few minutes to fill in'}</span></span></span></span>
            <span className="btnrow">
              {i.state === 'sign-in' && <UpdateLink item={i} label="Reconnect" className="btn primary" />}
              {i.state === 'ok' && more.products && <UpdateLink item={i} label="Approve" products={more.products} onDone={saved} />}
              <button className="linkbtn" onClick={() => remove(i)}>Remove</button>
            </span>
          </div>
        );
      })}
      {meta.items.length === 0 && <p className="small muted mt-0">No banks yet.</p>}
      <p className="small muted foot">{meta.items.length} of {meta.max} Plaid connections used; on the Trial plan, removing one doesn't free its slot.
        Updated from Plaid when the app starts and every {meta.autoSyncHours} hours while it's running{meta.lastSync ? ` (last: ${new Date(meta.lastSync).toLocaleString()})` : ''}.
        Plaid gets new data from each bank on its own schedule, usually a few times a day for transactions and about once a day for investments.</p>
    </Panel>
  );
}

// This month's money in and out of one account, and how far back its history goes.
function Activity({ a, act }) {
  if (!act) return <span className="acctstat small muted">No transactions{a.type === 'investment' ? ' (holdings are on the Investments page)' : ''}</span>;
  return (
    <span className="acctstat small">
      <span><span className="muted">{monthName} in</span> <b className="amt good">{usd2(act.month_in)}</b></span>
      <span><span className="muted">out</span> <b className="amt">{usd2(act.month_out)}</b></span>
      <span className="muted">{act.n} transactions since {shortDate(act.first)}{act.pending ? ` · ${act.pending} pending` : ''}</span>
      <a className="linkbtn" href={`#/transactions?account=${encodeURIComponent(a.id)}`}>Transactions</a>
    </span>
  );
}

function AccountRow({ a, act, open, setOpen, saved }) {
  const toggle = async () => { await api(`/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ in_networth: !a.in_networth }) }); saved(); };
  return (
    <>
      <div className={`arow${a.in_networth ? '' : ' dim'}`} onClick={() => setOpen(open ? null : a.id)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(open ? null : a.id)} aria-expanded={open}>
        <span className="rowicon"><Avatar name={a.institution} />
          <span className="tmain"><b>{a.name}</b><span className="small muted">{cap(label(a.subtype || a.type))} · {a.institution}{a.mask ? ` ••${a.mask}` : ''}{a.in_networth ? '' : ' · not in net worth'}</span>
          {a.interest_month != null && <span className="small muted">{a.apr}% APR · about <Est why="Estimate: balance × APR ÷ 12. Your bank charges on the daily balance."><b className="amt">{usd(a.interest_month)}</b></Est> a month in interest</span>}</span></span>
        <Spark data={a.spark} estimated={a.estimated} debt={isDebt(a)} />
        <span className="r"><b className="amt">{isDebt(a) && a.balance >= 0.005 ? '−' : ''}{usd2(a.balance)}</b><div>{a.spark?.length > 1 && a.change != null && Math.abs(a.change) >= 0.5
          ? <Hover className="quiet" tip={<TipList title={`${a.name}, last 30 days`} rows={[['30 days ago', usd2(a.spark[0])], ['Today', usd2(a.spark.at(-1))],
            ['Lowest', usd2(Math.min(...a.spark))], ['Highest', usd2(Math.max(...a.spark))]]} note={a.estimated ? 'Estimated from transactions where the bank has no balance history.' : null} />}>
            <Change v={a.change} debt={isDebt(a)} since={a.tracking_since} /></Hover> : <Change v={a.change} debt={isDebt(a)} since={a.tracking_since} />}</div></span>
      </div>
      {open && (
        <div className="aedit">
          <Activity a={a} act={act} />
          <label className="lbl">Nickname<Nickname a={a} saved={saved} /></label>
          <label className="lbl">Type<AccountType a={a} saved={saved} /></label>
          <label className="check small"><input type="checkbox" checked={!!a.in_networth} onChange={toggle} /> Include in net worth
            <span className="muted">(its transactions still count toward spending and budgets)</span></label>
        </div>
      )}
    </>
  );
}

// What moved your net worth: what you earned minus what you spent (income − spending), money moved to accounts that aren't tracked, and
// everything else, mostly the market.
const PERIODS = [['month', 'This month'], ['30d', 'Last 30 days'], ['all', 'Since tracking']];
const signedUsd = (v) => `${v < 0 ? '−' : '+'}${usd(Math.abs(v))}`;
// `stamp` changes whenever the page reloads its data (a new value or a linked transfer), so this refetches too.
function WhatMoved({ stamp }) {
  const [period, setPeriod] = useState('30d');
  const [b, setB] = useState(null);
  useEffect(() => { api(`/networth/breakdown?period=${period}`).then(setB); }, [period, stamp]);
  if (!b) return null;
  const head = <div className="ranges">{PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>;
  if (!b.available) return (
    <Panel className="mt" title="What moved your net worth">
      <p className="small muted mt-0">This needs a real daily value for every account at both ends of a period. Mizo Money records one each day
        {b.since ? ` (since ${shortDate(b.since)})` : ' from the first sync'}, so it shows up after the next day's sync.</p>
    </Panel>);
  // Money paid into accounts Mizo Money can't see; hidden when it rounds to $0.
  const showMoved = Math.round(b.moved ?? 0) !== 0;
  const showValued = Math.round(b.revalued ?? 0) !== 0;
  const showPay = Math.round(b.fromPay ?? 0) !== 0; // 401(k) and similar contributions taken from your pay
  const max = Math.max(Math.abs(b.saved), Math.abs(b.market), showMoved ? Math.abs(b.moved) : 0, showValued ? Math.abs(b.revalued) : 0, showPay ? Math.abs(b.fromPay) : 0, 1);
  const bar = (v, cls) => <span className="wmbar"><i className={`${cls} ${v < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></span>;
  // Market and other: each investment account's change, then whatever is left (cash, cards, interest, fees).
  const rest = b.market - b.investments.reduce((s, a) => s + a.change, 0);
  // Money you moved in or out isn't a market move, so it's named beside the account instead of counted in it.
  const marketRows = [...b.investments.map((a) => [a.name, signedUsd(a.change),
    Math.abs(a.added ?? 0) >= 0.5 ? <><span className="amt">{signedUsd(a.added)}</span> {a.added > 0 ? 'you moved in' : 'you took out'}</> : null]),
    ...(Math.abs(rest) >= 0.5 || !b.investments.length ? [['Cash, cards and other', signedUsd(rest)]] : [])];
  const movedRows = [...(b.movedItems ?? []).map((t) => [t.name, signed(t.amount), shortDate(t.date)]),
    ...(b.movedMore?.count ? [[`and ${b.movedMore.count} more`, signed(b.movedMore.amount)]] : [])];
  return (
    <Panel className="mt" title="What moved your net worth" actions={head}>
      <div className={`wm rows${2 + showMoved + showValued + showPay}`}>
        <div className="wmtotal"><span className="small muted">{shortDate(b.from)} → {shortDate(b.to)}</span>
          <b className={`amt big ${b.change < 0 ? 'bad' : 'good'}`}>{signedUsd(b.change)}</b></div>
        <div className="wmrow"><Hover className="quiet" tip={<TipList title="Earned minus spent" rows={[['Income', usd(b.income)], ['Spending', `−${usd(b.spending)}`]]}
          note="Income minus spending, from your transactions. Transfers between your own accounts don't count, so this is not what you put into savings." />}>Earned minus spent</Hover>{bar(b.saved, 'saved')}<b className="amt">{signedUsd(b.saved)}</b></div>
        {showPay && <div className="wmrow"><Hover className="quiet" tip={<TipList title="Put in from your pay" rows={b.fromPayItems.map((a) => [a.name, signedUsd(a.amount), `${a.count} contribution${a.count === 1 ? '' : 's'}`])}
          note="Taken from your paycheck before it was deposited, so it isn't in your income or spending." />}>Put in from your pay</Hover>
          {bar(b.fromPay, 'saved')}<b className="amt">{signedUsd(b.fromPay)}</b></div>}
        {showMoved && <div className="wmrow"><Hover className="quiet" tip={<TipList title="Moved to accounts not tracked" rows={movedRows}
          note="Transfers, savings and debt payments to an account that isn't linked. The money is still yours, but Mizo Money can't see where it went. Link that account, or count the transfer toward an asset you added below, to move it out of this row." />}>Moved to accounts not tracked</Hover>
          {bar(b.moved, 'moved')}<b className="amt">{signedUsd(b.moved)}</b></div>}
        {showValued && <div className="wmrow"><Hover className="quiet" tip={<TipList title="New values you entered" rows={b.valued.map((a) => [a.name, signedUsd(a.change)])}
          note="Changes to the values of assets and debts you added, beyond transfers you counted toward them." />}>Assets and debts you added</Hover>
          {bar(b.revalued, 'market')}<b className="amt">{signedUsd(b.revalued)}</b></div>}
        <div className="wmrow"><Hover className="quiet" tip={<TipList title="Market and other" rows={marketRows}
          note="The rest of the change, mostly investments going up or down, not counting money you moved in. It also catches interest, fees and balance corrections." />}>Market and other</Hover>
          {bar(b.market, 'market')}<b className="amt">{signedUsd(b.market)}</b></div>
      </div>
      {b.clipped && <p className="small muted foot">Real daily values start {shortDate(b.since)}, so this covers from then.</p>}
    </Panel>
  );
}

// Assets and liabilities, each as one bar with a legend.
// The lead band's right side: what you own and what you owe, the two halves of the figure (the Summary sheet breaks them down).
function BandParts({ accounts, manual }) {
  const inc = accounts.filter((a) => a.in_networth), DEBT = ['credit', 'loan'];
  const owe = inc.filter((a) => DEBT.includes(a.type)).reduce((s, a) => s + a.balance, 0) + manual.filter((m) => m.kind === 'liability').reduce((s, m) => s + m.value, 0);
  const own = inc.filter((a) => !DEBT.includes(a.type)).reduce((s, a) => s + a.balance, 0) + manual.filter((m) => m.kind !== 'liability').reduce((s, m) => s + m.value, 0);
  return (
    <dl className="bandparts">
      <div><dt>You own</dt><dd className="amt">{usd(own)}</dd></div>
      <div><dt>You owe</dt><dd className="amt">{usd(owe)}</dd></div>
    </dl>
  );
}

function Summary({ accounts, manual }) {
  const [pct, setPct] = useState(false);
  const inc = accounts.filter((a) => a.in_networth);
  const sum = (f) => inc.filter(f).reduce((s, a) => s + a.balance, 0);
  const manualSum = (k) => manual.filter((m) => m.kind === k).reduce((s, m) => s + m.value, 0);
  const assets = [['Investments', sum((a) => a.type === 'investment') + manualSum('investment'), SERIES[0]], ['Cash', sum((a) => a.type === 'depository'), SERIES[2]],
    ['Real estate', manualSum('real_estate'), SERIES[1]], ['Vehicles', manualSum('vehicle'), SERIES[3]], ['Owed to you', manualSum('receivable'), NEUTRAL],
    ['Other', sum((a) => a.type === 'other') + manualSum('other'), NEUTRAL]].filter(([, v]) => v > 0.5);
  const debts = [['Credit cards', sum((a) => a.type === 'credit'), SERIES[1]], ['Loans', sum((a) => a.type === 'loan'), SERIES[3]],
    ['Other debts', manualSum('liability'), NEUTRAL]].filter(([, v]) => v > 0.5);
  // What's behind each line, for the hover: linked accounts of that type plus anything added by hand.
  const TYPES = { Investments: ['investment'], Cash: ['depository'], Other: ['other'], 'Credit cards': ['credit'], Loans: ['loan'] };
  const KINDS = { Investments: 'investment', 'Real estate': 'real_estate', Vehicles: 'vehicle', 'Owed to you': 'receivable', Other: 'other', 'Other debts': 'liability' };
  const behind = (n) => [
    ...inc.filter((a) => TYPES[n]?.includes(a.type)).sort((a, b) => b.balance - a.balance).map((a) => [a.name, usd(a.balance), a.institution]),
    ...manual.filter((m) => m.kind === KINDS[n]).map((m) => [m.name, usd(m.value), 'added by you']),
  ];
  const block = (title, rows) => {
    const total = rows.reduce((s, [, v]) => s + v, 0);
    return (
      <div className="nwblock">
        <div className="row base"><b>{title}</b><b className="amt">{usd(total)}</b></div>
        {total > 0 && <div className="splitbar">{rows.map(([n, v, c]) => <i key={n} style={{ width: `${(v / total) * 100}%`, background: c }} title={tipText(`${n}: ${usd(v)}`)} />)}</div>}
        <ul className="legend2">{rows.map(([n, v, c]) => <li key={n}><span><i className="dot" style={{ background: c }} />
          <Hover className="quiet" tip={behind(n).length ? <TipList title={n} rows={behind(n)} /> : null}>{n}</Hover></span>
          <b className="amt">{pct ? `${((v / total) * 100).toFixed(1)}%` : usd(v)}</b></li>)}</ul>
        {rows.length === 0 && <p className="small muted">None.</p>}
      </div>
    );
  };
  return (
    <Panel title="Summary" actions={<div className="ranges"><button className={pct ? '' : 'on'} onClick={() => setPct(false)}>Totals</button><button className={pct ? 'on' : ''} onClick={() => setPct(true)}>Percent</button></div>}>
      {block('Assets', assets)}
      {block('Liabilities', debts)}
    </Panel>
  );
}

export default function NetWorth({ onChange }) {
  const [d, setD] = useState(null);
  const [history, setHistory] = useState(null);
  const [nw, setNw] = useState(null);
  const [meta, setMeta] = useState(null), [activity, setActivity] = useState({});
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    const [accts, sum, items, act] = await Promise.all([api('/networth'), api('/summary'), api('/items'), api('/accounts/activity')]);
    setD(accts); setHistory(sum.history); setNw(sum.netWorth); setMeta(items); setActivity(act);
  }, []);
  useEffect(() => { load(); }, [load]);
  // Connecting, approving or removing a bank also changes the top bar's "needs attention" chip.
  const saved = () => { load(); onChange?.(); };
  if (!d || !history || !meta || !nw) return <PageSkeleton />;

  return (
    <>
      <PageHeader title="Net worth">
        {meta.items.length < meta.max && <ConnectBank />}
      </PageHeader>
      {meta.items.length === 0 && <div className="card empty mt"><EmptyState art="banks" title="No banks yet">Connect a bank to see its accounts here.</EmptyState></div>}
      {d.accounts.length > 0 && (
        <section className="standing solo mt" aria-label="Net worth">
          <div className="stand lead">
            <span className="slabel">Net worth today</span>
            <span className="sfig big"><Hover className="quiet" tip={nw.ago == null ? null : <TipList title="Net worth" rows={[['30 days ago', usd(nw.ago)], ['Today', usd(nw.value)]]} />}>{usd(nw.value)}</Hover></span>
            {nw.ago != null && (() => {
              const diff = nw.value - nw.ago, pct = nw.ago ? (diff / Math.abs(nw.ago)) * 100 : null;
              return <span className="delta small" title={`${signedUsd(diff)} since 30 days ago`}>
                <span className={diff >= 0 ? 'good' : 'bad'}><Trend up={diff >= 0} /> {pct == null ? signedUsd(diff) : `${Math.abs(pct).toFixed(1)}%`}</span>{' '}
                <span className="muted">vs. 30 days ago</span></span>;
            })()}
            <BandParts accounts={d.accounts} manual={d.manual} />
          </div>
        </section>
      )}
      <div className="nwtop mt">
        <NetWorthChart history={history} />
        <Summary accounts={d.accounts} manual={d.manual} />
      </div>
      <WhatMoved stamp={d} />
      {/* Cash, cards, investments and loans: one ruled sheet, a section per type. */}
      {d.accounts.length > 0 && <div className="ledger mt">{GROUPS.map(([type, title]) => {
        const list = d.accounts.filter((a) => a.type === type);
        if (!list.length) return null;
        const inc = list.filter((a) => a.in_networth);
        const total = inc.reduce((s, a) => s + a.balance, 0);
        // A group with an account that has no history yet can't show a 30-day change.
        const untracked = inc.filter((a) => a.change == null);
        const change = untracked.length ? null : inc.reduce((s, a) => s + a.change, 0);
        const since = untracked.map((a) => a.tracking_since).sort().at(-1);
        return (
          <Panel key={type} title={<>{title} <span className="titlenote"><Change v={change} debt={type === 'credit' || type === 'loan'} suffix=" in 30 days" since={since} neutral /></span></>}
            actions={<b className="amt">{(type === 'credit' || type === 'loan') && total >= 0.5 ? '−' : ''}{usd(total)}</b>}>
            {list.map((a) => <AccountRow key={a.id} a={a} act={activity[a.id]} open={open === a.id} setOpen={setOpen} saved={load} />)}
          </Panel>
        );
      })}</div>}
      <YourAssets manual={d.manual} candidates={d.candidates ?? []} open={open} setOpen={setOpen} saved={saved} />
      <Banks meta={meta} accounts={d.accounts} saved={saved} />
    </>
  );
}
