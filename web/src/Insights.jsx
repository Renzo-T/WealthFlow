import { useState } from 'react';
import { api } from './api.js';
import { usd, usd2, allocColor } from './format.js';
import { Panel, EmptyState, Hover, TipList } from './ui.jsx';
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long' });
import CategoryIcon from './CategoryIcon.jsx';

const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// One line at the top of the dashboard: how this month compares with last (everyday spending, bills excluded),
// plus anything waiting for a decision in Transactions.
// What changed this month, and the to-do: one link per kind of thing waiting for you (/todo).
export function InsightStrip({ changed, todo = [] }) {
  const waiting = todo.length;
  let text = null;
  if (changed?.ready && !changed.flat) {
    const more = changed.diff > 0;
    const drivers = changed.drivers.map((d) => `${d.category} (${d.diff > 0 ? '+' : '−'}${usd(Math.abs(d.diff))})`);
    text = <>You've spent <b className={`amt ${more ? 'bad' : 'good'}`}>{usd(Math.abs(changed.diff))} {more ? 'more' : 'less'}</b> than this time last month
      {drivers.length ? <>, mostly {list(drivers)}</> : null}.</>;
  } else if (changed?.ready && changed.flat) {
    text = <>Your everyday spending is about the same as this time last month.</>;
  } else if (changed?.reason === 'early' && changed.last?.total > 0) {
    const top = changed.last.top.map((t) => `${t.category} (${usd(t.total)})`);
    text = <>In {monthName(changed.last.month)} you spent <b className="amt">{usd(changed.last.total)}</b> on everyday things{top.length ? <>, most on {list(top)}</> : null}.
      <span className="muted"> This month's comparison starts on the 5th.</span></>;
  }
  if (!text && !waiting) return null;
  return (
    <div className="insight">
      {text && <span title="Same days of last month, everyday spending only: recurring bills are left out, and banks without history for last month aren't compared.">
        <span className="insight-ic" aria-hidden="true">{changed.reason === 'early' ? '◷' : changed.diff > 0 ? '↑' : changed.flat ? '≈' : '↓'}</span>{text}</span>}
      {waiting > 0 && <span className="todo">{todo.map((t) => <a key={t.key} href={t.href} className="chip-link">{t.label}</a>)}</span>}
    </div>
  );
}

// Merchants you're visiting more often than last month.
export function FrequentPanel({ items, early }) {
  const last = items[0]?.lastMonth;
  return (
    <Panel title={<>{last ? 'Your regulars' : 'Frequent spending'}{last && <span className="asof">last month</span>}</>}>
      {items.length === 0 && <EmptyState icon="bag" title={early ? 'Nothing to compare yet' : 'No new habits'}>
        {early ? 'From the 5th, shops you visit more often than last month show up here.' : "You're not visiting any shop noticeably more often than last month."}</EmptyState>}
      {items.map((f) => (
        <div className="trow" key={f.merchant}>
          <span className="rowicon"><span className="avatar sm">{f.merchant[0]}</span>
            <span className="tmain"><b>{f.merchant}</b>
              <span className="small muted">{f.lastMonth ? `${f.count} visits` : `${f.count} visits vs ${f.prevCount} by now last month`} · {usd2(f.avg)} on average</span></span></span>
          <b className="amt">{usd2(f.total)}</b>
        </div>
      ))}
      {last && <p className="small muted foot">This month's comparison starts on the 5th.</p>}
    </Panel>
  );
}

// Things you've chosen to keep an eye on: a category or a merchant, with an optional monthly target.
// Monthly target, set or changed in place (saving re-adds the same item with the new target; blank clears it).
function WatchTarget({ w, reload }) {
  const [edit, setEdit] = useState(false);
  const save = async (v) => {
    setEdit(false);
    if ((Number(v) || null) === (w.target || null)) return;
    await api('/watchlist', { method: 'POST', body: JSON.stringify({ kind: w.kind, value: w.value, target: v }) });
    reload();
  };
  if (edit) return <input className="mini" type="number" min="1" step="1" autoFocus defaultValue={w.target ?? ''} aria-label={`Monthly target for ${w.value}`}
    onBlur={(e) => save(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEdit(false); }} />;
  return w.target ? <button className="linkbtn plain amt" onClick={() => setEdit(true)} title="Change target"><b>{usd(w.target)}</b></button>
    : <button className="linkbtn small" onClick={() => setEdit(true)}>Set</button>;
}

// This month against the target (or the monthly average when there's none); the tick is where an even pace
// would be today.
function WatchBar({ w, over }) {
  const max = w.target || w.avg;
  if (!max) return null;
  const now = new Date(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pace = (now.getDate() / days) * 100;
  const p = Math.min((w.soFar / max) * 100, 100);
  return (
    <div className="watchbar">
      <div className="bar"><i style={{ width: `${p}%`, background: over ? 'var(--red)' : 'var(--blue)' }} /><b className="tick" style={{ left: `${pace}%` }} title="An even pace for today" /></div>
      <span className="small muted amt">{Math.round((w.soFar / max) * 100)}% of {w.target ? 'your target' : 'your monthly average'}</span>
    </div>
  );
}

export function WatchlistPanel({ data, reload }) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState('');
  if (!data) return null;
  const add = async (e) => {
    e.preventDefault();
    const [kind, value] = pick.split('|');
    const r = await api('/watchlist', { method: 'POST', body: JSON.stringify({ kind, value, target }) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setPick(''); setTarget(''); setAdding(false); reload();
  };
  const remove = async (id) => { await api(`/watchlist/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <Panel title="Watchlist" actions={<button className="linkbtn" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Watch something'}</button>}>
      {adding && (
        <form className="form" onSubmit={add}>
          <label className="lbl">Category or shop
            <select value={pick} onChange={(e) => setPick(e.target.value)} required>
              <option value="" disabled>Choose…</option>
              <optgroup label="Shops you spend most at">{data.merchants.map((m) => <option key={m.merchant} value={`merchant|${m.merchant}`}>{m.merchant}</option>)}</optgroup>
              <optgroup label="Categories">{data.categories.filter((c) => !['Income', 'Salary', 'Dividends', 'Interest', 'Transfer', 'Sweep'].includes(c))
                .map((c) => <option key={c} value={`category|${c}`}>{c}</option>)}</optgroup>
            </select></label>
          <label className="lbl">Monthly target (optional)<input className="mini" type="number" min="1" step="1" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <button className="btn primary" type="submit">Watch</button>
          {err && <span className="bad small">{err}</span>}
        </form>
      )}
      {data.items.length === 0 && !adding && (
        <EmptyState icon="eye" title="Keep an eye on a shop or category"
          actions={<>{[...data.merchants.slice(0, 4).map((m) => ['merchant', m.merchant]), ['category', 'Restaurants'], ['category', 'Groceries']].map(([kind, value]) => (
            <button key={value} className="chipbtn" onClick={async () => { await api('/watchlist', { method: 'POST', body: JSON.stringify({ kind, value }) }); reload(); }}>+ {value}</button>))}
            <button className="chipbtn" onClick={() => setAdding(true)}>Something else…</button></>}>
          See your monthly average, this month so far, and where you're headed. Your most frequent shops are below.
        </EmptyState>)}
      <div className="watchgrid">
        {data.items.map((w) => {
          const over = w.target && (w.projected ?? w.soFar) > w.target;
          return (
            <div className="watch" key={w.id}>
              <div className="row base"><span className="rowicon">{w.kind === 'category' ? <CategoryIcon sub={w.value} group={null} size={26} /> : <span className="avatar sm">{w.value[0]}</span>}<b>{w.value}</b></span>
                <button className="linkbtn" onClick={() => remove(w.id)} aria-label={`Stop watching ${w.value}`}>×</button></div>
              <div className="watchstats">
                <div><span className="small muted">Monthly average</span><b className="amt">{w.avg == null ? '—'
                  : <Hover tip={<TipList title={`Last ${w.history.length} month${w.history.length > 1 ? 's' : ''}`} rows={w.history.map((h) => [monthName(h.month), usd(h.total)])} />}>{usd(w.avg)}</Hover>}</b></div>
                <div><span className="small muted">This year</span><b className="amt">{usd(w.ytd)}</b></div>
              </div>
              <div className="watchnow">
                <div><span className="small muted">This month</span><b className="amt">{usd(w.soFar)}</b></div>
                <div><span className="small muted">Target</span><WatchTarget w={w} reload={reload} /></div>
                <div title="This month so far, continued at the same pace"><span className="small muted">On pace for</span>
                  {w.projected == null ? <b className="muted" title="Starts on the 5th of the month">—</b> : <b className={`amt ${over ? 'bad' : ''}`}>{usd(w.projected)}</b>}</div>
              </div>
              <WatchBar w={w} over={over} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// Cash in checking-type accounts minus the bills due before the next paycheck.
// Free to spend this month: cash, plus income still coming, minus bills, card balances and your cushion.
export function SafeToSpendPanel({ d, reload }) {
  const [edit, setEdit] = useState(false);
  if (!d) return null;
  const until = new Date(`${d.until}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const day = (x) => new Date(`${x}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const saveCushion = async (v) => { setEdit(false); await api('/settings/cushion', { method: 'PUT', body: JSON.stringify({ amount: v }) }); reload?.(); };
  return (
    <Panel title="Free to spend" actions={<a href="#/bills">Bills</a>}>
      <div className={`stsbig amt ${d.free < 0 ? 'bad' : ''}`}>{d.free < 0 ? '−' : ''}{usd(Math.abs(d.free))}</div>
      <p className="small muted mt-0">through {until}, after bills, card balances{d.cushion ? ' and your cushion' : ''}</p>
      <dl className="kv">
        <dt><Hover tip={<TipList title="Everyday accounts" rows={d.accounts.map((a) => [a.name, usd2(a.balance)])} />}>Cash</Hover></dt><dd className="amt">{usd(d.cash)}</dd>
        {d.income.length > 0 && <><dt><Hover tip={<TipList title="Still coming this month" rows={d.income.map((o) => [o.name, usd2(o.amount), day(o.date)])} />}>Income still coming</Hover></dt>
          <dd className="amt good">+{usd(d.incomeTotal)}</dd></>}
        <dt><Hover tip={d.due.length ? <TipList title="Still due this month" rows={d.due.map((o) => [o.name, usd2(o.amount), day(o.date)])} /> : null}>Bills due ({d.due.length})</Hover></dt>
        <dd className="amt">−{usd(d.dueTotal)}</dd>
        {d.cards.length > 0 && <><dt><Hover tip={<TipList title="Owed on cards" rows={d.cards.map((c) => [c.name, usd2(c.balance)])} note="Already spent, so set aside to pay off. Card payments aren't counted again as bills." />}>Card balances</Hover></dt>
          <dd className="amt">−{usd(d.owed)}</dd></>}
        <dt>Cushion</dt>
        <dd>{edit ? <input className="mini" type="number" min="0" step="100" autoFocus defaultValue={d.cushion || ''} aria-label="Cushion to keep aside"
          onBlur={(e) => saveCushion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          : <button className="linkbtn plain amt" onClick={() => setEdit(true)}>{d.cushion ? `−${usd(d.cushion)}` : 'Set'}</button>}</dd>
      </dl>
      {d.planned != null && d.planned > 0 && <p className="small muted foot">Your flexible budget has <b className="amt">{usd(d.planned)}</b> left this month,
        {d.free - d.planned >= 0 ? <> leaving <b className="amt">{usd(d.free - d.planned)}</b> unplanned.</> : <> more than is free.</>}</p>}
    </Panel>
  );
}

// Investments at a glance: value, gain where cost basis is known, and the mix.
export function InvestmentsCard({ d }) {
  if (!d || !d.total) return null;
  return (
    <Panel title="Investments" actions={<a href="#/investments">Details</a>}>
      <div className="row base wraprow"><div className="stsbig amt">{usd(d.total)}</div>
        {d.gain != null && <Hover tip={<TipList title="Unrealized gain" rows={[['Value with a known cost', usd(d.gainOn)], ['Gain on it', `${d.gain >= 0 ? '+' : '−'}${usd(Math.abs(d.gain))}`]]}
          note="401(k) plans usually don't report what you paid, so they're left out." />} className="nowrap"><span className={`amt ${d.gain >= 0 ? 'good' : 'bad'}`}>
          {d.gain >= 0 ? '+' : '−'}{usd(Math.abs(d.gain))} ({Math.round(d.gainPct)}%)</span></Hover>}</div>
      <p className="small muted mt-0">{d.positions} positions · {Math.round((d.taxAdvantaged / d.total) * 100)}% in retirement & HSA accounts</p>
      <div className="splitbar">{d.kinds.filter((k) => k.value / d.total >= 0.002).map((k) => (
        <i key={k.name} style={{ width: `${(k.value / d.total) * 100}%`, background: allocColor(k.name) }} title={`${k.name}: ${usd(k.value)}`} />))}</div>
      <ul className="legend2 compact">{d.kinds.slice(0, 4).map((k) => (
        <li key={k.name}><span><i className="dot" style={{ background: allocColor(k.name) }} />{k.name}</span><span className="amt muted">{Math.round((k.value / d.total) * 100)}%</span></li>))}</ul>
    </Panel>
  );
}
