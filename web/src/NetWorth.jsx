import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { usd, usd2, label, SERIES, NEUTRAL, shortDate } from './format.js';
import { Panel, PageHeader, PageSkeleton, Hover, TipList } from './ui.jsx';
import NetWorthChart from './NetWorthChart.jsx';

// Rename in place: saves on Enter or when the field loses focus. Empty restores the bank's name.
function Nickname({ a, saved }) {
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
function AccountType({ a, saved }) {
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

const KINDS = { real_estate: 'Real estate', vehicle: 'Vehicle', other: 'Other asset', liability: 'Loan or debt' };
const GROUPS = [
  ['depository', 'Cash'], ['credit', 'Credit cards'], ['investment', 'Investments'], ['loan', 'Loans'], ['other', 'Other'],
];
const isDebt = (a) => a.type === 'credit' || a.type === 'loan';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// Signed change for display: for debts, the balance going up is bad, so colour by what it means for net worth.
const Change = ({ v, debt, suffix = '', since }) => {
  if (v == null) return <span className="small muted" title="Investment values can't be worked out backwards, so history starts when WealthFlow started tracking">
    {since ? `tracking since ${shortDate(since)}` : 'no history yet'}</span>;
  if (Math.abs(v) < 0.5) return <span className="small muted">no change{suffix}</span>;
  const good = debt ? v < 0 : v > 0;
  return <span className={`small amt ${good ? 'good' : 'bad'}`}>{v > 0 ? '↑' : '↓'} {usd(Math.abs(v))}{suffix}</span>;
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
const Avatar = ({ name }) => <span className="avatar" style={{ background: `${avatarColor(name)}22`, color: avatarColor(name) }}>{(name ?? '?')[0]}</span>;

function AccountRow({ a, open, setOpen, saved }) {
  const toggle = async () => { await api(`/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ in_networth: !a.in_networth }) }); saved(); };
  return (
    <>
      <div className={`arow${a.in_networth ? '' : ' dim'}`} onClick={() => setOpen(open ? null : a.id)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(open ? null : a.id)} aria-expanded={open}>
        <span className="rowicon"><Avatar name={a.institution} />
          <span className="tmain"><b>{a.name}</b><span className="small muted">{cap(label(a.subtype || a.type))} · {a.institution}{a.mask ? ` ••${a.mask}` : ''}{a.in_networth ? '' : ' · not in net worth'}</span></span></span>
        <Spark data={a.spark} estimated={a.estimated} debt={isDebt(a)} />
        <span className="r"><b className="amt">{isDebt(a) && a.balance >= 0.005 ? '−' : ''}{usd2(a.balance)}</b><div>{a.spark?.length > 1 && a.change != null && Math.abs(a.change) >= 0.5
          ? <Hover className="quiet" tip={<TipList title={`${a.name}, last 30 days`} rows={[['30 days ago', usd2(a.spark[0])], ['Today', usd2(a.spark.at(-1))],
            ['Lowest', usd2(Math.min(...a.spark))], ['Highest', usd2(Math.max(...a.spark))]]} note={a.estimated ? 'Estimated from transactions where the bank has no balance history.' : null} />}>
            <Change v={a.change} debt={isDebt(a)} since={a.tracking_since} /></Hover> : <Change v={a.change} debt={isDebt(a)} since={a.tracking_since} />}</div></span>
      </div>
      {open && (
        <div className="aedit">
          <label className="lbl">Nickname<Nickname a={a} saved={saved} /></label>
          <label className="lbl">Type<AccountType a={a} saved={saved} /></label>
          <label className="check small"><input type="checkbox" checked={!!a.in_networth} onChange={toggle} /> Include in net worth
            <span className="muted">(its transactions still count toward spending and budgets)</span></label>
        </div>
      )}
    </>
  );
}

// What moved your net worth: what you saved (income − spending) and everything else, mostly the market.
const PERIODS = [['month', 'This month'], ['30d', 'Last 30 days'], ['all', 'Since tracking']];
const signedUsd = (v) => `${v < 0 ? '−' : '+'}${usd(Math.abs(v))}`;
function WhatMoved() {
  const [period, setPeriod] = useState('month');
  const [b, setB] = useState(null);
  useEffect(() => { api(`/networth/breakdown?period=${period}`).then(setB); }, [period]);
  if (!b) return null;
  const head = <div className="ranges">{PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>;
  if (!b.available) return (
    <Panel className="mt" title="What moved your net worth">
      <p className="small muted mt-0">This needs a real daily value for every account at both ends of a period. WealthFlow records one each day
        {b.since ? ` (since ${shortDate(b.since)})` : ' from the first sync'}, so it shows up after the next day's sync.</p>
    </Panel>);
  const max = Math.max(Math.abs(b.saved), Math.abs(b.market), 1);
  const bar = (v, cls) => <span className="wmbar"><i className={`${cls} ${v < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></span>;
  return (
    <Panel className="mt" title="What moved your net worth" actions={head}>
      <div className="wm">
        <div className="wmtotal"><span className="small muted">{shortDate(b.from)} → {shortDate(b.to)}</span>
          <b className={`amt big ${b.change < 0 ? 'bad' : 'good'}`}>{signedUsd(b.change)}</b></div>
        <div className="wmrow"><Hover className="quiet" tip={<TipList title="Saved" rows={[['Income', usd(b.income)], ['Spending', `−${usd(b.spending)}`]]}
          note="From your transactions. Transfers between your own accounts don't count." />}>Saved</Hover>{bar(b.saved, 'saved')}<b className="amt">{signedUsd(b.saved)}</b></div>
        <div className="wmrow"><Hover className="quiet" tip={<TipList title="Investments" rows={b.investments.map((a) => [a.name, signedUsd(a.change)])}
          note="Market and other: the rest of the change, mostly investments going up or down. It also catches interest, fees and balance corrections." />}>Market and other</Hover>
          {bar(b.market, 'market')}<b className="amt">{signedUsd(b.market)}</b></div>
      </div>
      {b.clipped && <p className="small muted foot">Real daily values start {shortDate(b.since)}, so this covers from then.</p>}
    </Panel>
  );
}

// Assets and liabilities, each as one bar with a legend.
function Summary({ accounts, manual }) {
  const [pct, setPct] = useState(false);
  const inc = accounts.filter((a) => a.in_networth);
  const sum = (f) => inc.filter(f).reduce((s, a) => s + a.balance, 0);
  const manualSum = (k) => manual.filter((m) => m.kind === k).reduce((s, m) => s + m.value, 0);
  const assets = [['Investments', sum((a) => a.type === 'investment'), SERIES[0]], ['Cash', sum((a) => a.type === 'depository'), SERIES[2]],
    ['Real estate', manualSum('real_estate'), SERIES[1]], ['Vehicles', manualSum('vehicle'), SERIES[3]],
    ['Other', sum((a) => a.type === 'other') + manualSum('other'), NEUTRAL]].filter(([, v]) => v > 0.5);
  const debts = [['Credit cards', sum((a) => a.type === 'credit'), SERIES[1]], ['Loans', sum((a) => a.type === 'loan'), SERIES[3]],
    ['Other debts', manualSum('liability'), NEUTRAL]].filter(([, v]) => v > 0.5);
  // What's behind each line, for the hover: linked accounts of that type plus anything added by hand.
  const TYPES = { Investments: ['investment'], Cash: ['depository'], Other: ['other'], 'Credit cards': ['credit'], Loans: ['loan'] };
  const KINDS = { 'Real estate': 'real_estate', Vehicles: 'vehicle', Other: 'other', 'Other debts': 'liability' };
  const behind = (n) => [
    ...inc.filter((a) => TYPES[n]?.includes(a.type)).sort((a, b) => b.balance - a.balance).map((a) => [a.name, usd(a.balance), a.institution]),
    ...manual.filter((m) => m.kind === KINDS[n]).map((m) => [m.name, usd(m.value), 'added by you']),
  ];
  const block = (title, rows) => {
    const total = rows.reduce((s, [, v]) => s + v, 0);
    return (
      <div className="nwblock">
        <div className="row base"><b>{title}</b><b className="amt">{usd(total)}</b></div>
        {total > 0 && <div className="splitbar">{rows.map(([n, v, c]) => <i key={n} style={{ width: `${(v / total) * 100}%`, background: c }} title={`${n}: ${usd(v)}`} />)}</div>}
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

export default function NetWorth() {
  const [d, setD] = useState(null);
  const [history, setHistory] = useState(null);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ name: '', value: '', kind: 'real_estate' });
  const [err, setErr] = useState('');
  const load = useCallback(async () => { setD(await api('/networth')); setHistory((await api('/summary')).history); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d || !history) return <PageSkeleton />;

  const add = async (e) => {
    e.preventDefault();
    const r = await api('/assets', { method: 'POST', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setF({ ...f, name: '', value: '' }); load();
  };
  const remove = async (id) => { await api(`/assets/${id}`, { method: 'DELETE' }); load(); };
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Net worth" sub="Every linked account by type, plus anything Plaid can't see, like a house or a loan. Click an account to rename or adjust it." />
      <div className="nwtop mt">
        <NetWorthChart history={history} />
        <Summary accounts={d.accounts} manual={d.manual} />
      </div>
      <WhatMoved />
      {GROUPS.map(([type, title]) => {
        const list = d.accounts.filter((a) => a.type === type);
        if (!list.length) return null;
        const inc = list.filter((a) => a.in_networth);
        const total = inc.reduce((s, a) => s + a.balance, 0);
        // A group with an account that has no history yet can't show a 30-day change.
        const untracked = inc.filter((a) => a.change == null);
        const change = untracked.length ? null : inc.reduce((s, a) => s + a.change, 0);
        const since = untracked.map((a) => a.tracking_since).sort().at(-1);
        return (
          <Panel key={type} className="mt" title={<>{title} <Change v={change} debt={type === 'credit' || type === 'loan'} suffix=" in 30 days" since={since} /></>}
            actions={<b className="amt">{(type === 'credit' || type === 'loan') && total >= 0.5 ? '−' : ''}{usd(total)}</b>}>
            {list.map((a) => <AccountRow key={a.id} a={a} open={open === a.id} setOpen={setOpen} saved={load} />)}
          </Panel>
        );
      })}
      {d.accounts.some((a) => a.estimated) && <p className="small muted mt-sm">Dashed trend lines are estimated from transactions; investments are held at today's value until daily history builds up.</p>}
      <Panel className="mt-lg" title="Other assets and debts">
        <p className="small muted mt-0">Things Plaid can't see, like a house, a car or a personal loan. They count toward net worth and allocation. Update a value by removing and re-adding it.</p>
        <form className="form" onSubmit={add}>
          <label className="lbl">Name<input value={f.name} onChange={on('name')} placeholder="Home" required /></label>
          <label className="lbl">Value<input type="number" min="1" step="any" value={f.value} onChange={on('value')} placeholder="350000" required /></label>
          <label className="lbl">Kind<select value={f.kind} onChange={on('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button className="btn primary" type="submit">Add</button>
        </form>
        {err && <p className="bad small">{err}</p>}
        {d.manual.map((m) => (
          <div className="trow" key={m.id}>
            <span className="tmain"><b>{m.name}</b><span className="small muted">{KINDS[m.kind]}</span></span>
            <span className="btnrow"><b className={`amt${m.kind === 'liability' ? ' bad' : ''}`}>{m.kind === 'liability' ? '−' : ''}{usd2(m.value)}</b>
              <button className="linkbtn" onClick={() => remove(m.id)}>Remove</button></span>
          </div>
        ))}
      </Panel>
    </>
  );
}
