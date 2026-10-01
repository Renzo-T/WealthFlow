import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, shortDate, SERIES, NEUTRAL } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList } from './ui.jsx';
import CategoryIcon from './CategoryIcon.jsx';

const mon = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'short' });
const monYear = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const remember = (k, v) => { try { localStorage.setItem(`wf.reports.${k}`, JSON.stringify(v)); } catch { /* unavailable */ } };
const recall = (k, d) => { try { return JSON.parse(localStorage.getItem(`wf.reports.${k}`)) ?? d; } catch { return d; } };

// ---------- Month by month ----------
// Each cell is shaded by how it compares with the row's biggest month, so unusual months stand out.
function Cell({ v, max, partial, current, behind, avg, title, month }) {
  const share = max > 0 ? Math.max(0, v) / max : 0;
  const empty = Math.abs(v) < 0.5;
  const tip = !empty && behind?.count ? <TipList title={`${title}, ${monYear(month)}`}
    rows={behind.top.map((t) => [t.name, `${t.amount < 0 ? '−' : ''}${usd2(Math.abs(t.amount))}`, shortDate(t.date)])}
    note={[behind.count > behind.top.length ? `${behind.count} transactions; the largest ${behind.top.length} shown.` : null,
      avg ? `${v >= avg ? '+' : '−'}${usd(Math.abs(v - avg))} vs the average${current ? ' (month not over yet)' : ''}.` : null,
      partial ? 'Missing history from at least one bank.' : null].filter(Boolean).join(' ') || null} /> : null;
  return (
    <td className={`r amt rcell${partial ? ' partial' : ''}${current ? ' current' : ''}`} style={{ '--share': share }}>
      {empty ? <span className="muted">—</span> : tip ? <Hover className="quiet" tip={tip}>{usd(v)}</Hover> : usd(v)}
    </td>
  );
}

function MonthTable() {
  const [n, setN] = useState(() => recall('months', 6));
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(() => recall('open', {}));
  useEffect(() => { setD(null); api(`/reports/months?months=${n}`).then(setD); }, [n]);
  if (!d) return <PageSkeleton panels={1} />;
  const toggle = (g) => { const o = { ...open, [g]: !open[g] }; setOpen(o); remember('open', o); };
  const row = (r, opts = {}) => {
    const max = Math.max(...r.values.map(Math.abs), 1);
    return (
      <tr key={opts.key ?? r.name} className={opts.cls}>
        <td>{opts.label ?? r.name}</td>
        {r.values.map((v, i) => <Cell key={d.months[i]} v={v} max={max} partial={d.partial[i]} current={d.months[i] === d.current}
          behind={r.behind?.[i]} avg={r.avg} title={typeof opts.label === 'string' ? opts.label : r.name} month={d.months[i]} />)}
        <td className="r amt ravg">{r.avg == null ? '—' : <Hover className="quiet" tip={<TipList title="Average" rows={d.averaged.map((m) => [monYear(m), usd(r.values[d.months.indexOf(m)])])}
          note="Finished months with history from every bank." />}>{usd(r.avg)}</Hover>}</td>
      </tr>
    );
  };
  const spend = d.groups.filter((g) => g.spending), other = d.groups.filter((g) => !g.spending && !g.income);
  const income = d.groups.find((g) => g.income);
  const section = (list) => list.map((g) => (
    <Fragment key={g.group}>
      {row(g, { cls: 'rgroup', label: <button className="rtoggle" onClick={() => toggle(g.group)} aria-expanded={!!open[g.group]}>
        <svg className={`chev${open[g.group] ? ' open' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        <CategoryIcon group={g.group} size={22} />{g.name}</button> })}
      {open[g.group] && g.categories.map((c) => row(c, { key: `${g.group}/${c.name}`, cls: 'rcat' }))}
    </Fragment>
  ));
  return (
    <Panel className="scroll" title="Month by month" actions={
      <div className="ranges">{[6, 12].map((k) => <button key={k} className={n === k ? 'on' : ''} onClick={() => { setN(k); remember('months', k); }}>{k} months</button>)}</div>}>
      <table className="t rtable">
        <thead><tr><th />{d.months.map((m, i) => <th key={m} className={`r${d.partial[i] ? ' partial' : ''}`}>
          {d.partial[i] && d.missing[i]?.length ? <Hover className="quiet" tip={<TipList title={`${monYear(m)} is incomplete`}
            rows={d.missing[i].map((x) => [x.bank, `from ${shortDate(x.from)}`])} note="These banks' history starts later, so their activity this month is missing." />}>
            {mon(m)}{m === d.current ? ' so far' : ''}</Hover> : <>{mon(m)}{m === d.current ? ' so far' : ''}</>}</th>)}
          <th className="r"><Hover className="quiet" tip={<TipList rows={[]} note="Average of finished months with history from every bank." />}>Average</Hover></th></tr></thead>
        <tbody>
          {income && <>{row(income, { cls: 'rgroup rincome', label: <><CategoryIcon group="Income" size={22} />Income</> })}</>}
          <tr className="rsep"><td colSpan={d.months.length + 2}>Spending</td></tr>
          {section(spend)}
          {row(d.totals.spending, { cls: 'rtotal', label: 'Total spending' })}
          {other.length > 0 && <><tr className="rsep"><td colSpan={d.months.length + 2}>Saving & debt</td></tr>{section(other)}</>}
        </tbody>
      </table>
      {d.partial.some(Boolean) && <p className="small muted foot">Faded months are missing history from at least one bank, so they're incomplete and left out of the average.</p>}
    </Panel>
  );
}

// ---------- Subscriptions ----------
function Subscriptions() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/reports/subscriptions').then(setD); }, []);
  if (!d) return <PageSkeleton panels={1} />;
  if (!d.items.length) return <Panel><EmptyState title="No subscriptions found">Streaming, apps and memberships show up here once they've charged a couple of times.</EmptyState></Panel>;
  const changed = d.items.filter((s) => s.change);
  return (
    <>
      <div className="cards subcards">
        <div className="card"><h3>Every month</h3><div className="big amt">{usd(d.monthly)}</div><div className="small muted">{d.items.length} subscription{d.items.length > 1 ? 's' : ''}</div></div>
        <div className="card"><h3>Every year</h3><div className="big amt">{usd(d.yearly)}</div><div className="small muted">at today's prices</div></div>
        <div className="card"><h3>Price changes</h3><div className="big">{changed.length}</div><div className="small muted">{changed.length ? changed.map((s) => s.name).slice(0, 3).join(', ') : 'None lately'}</div></div>
      </div>
      <Panel className="mt" title="Subscriptions" actions={<a href="#/bills">Bills</a>}>
        <p className="small muted mt-0">Everything recurring that isn't rent, utilities, insurance or a card payment. Not a subscription? Mark it "Not a bill" on the Bills page.</p>
        {d.items.map((s) => (
          <div className="trow sub" key={s.key}>
            <span className="rowicon"><CategoryIcon group={s.grp} sub={s.category} />
              <span className="tmain"><b>{s.recent?.length ? <Hover className="quiet" tip={<TipList title="Recent charges" rows={s.recent.map((r) => [shortDate(r.date), usd2(r.amount)])}
                note={s.next ? `Next around ${shortDate(s.next)}.` : null} />}>{s.name}</Hover> : s.name}</b><span className="small muted">{s.frequency} · {s.category}{s.account ? ` · ${s.account}` : ''}{s.last ? ` · last ${shortDate(s.last)}` : ''}</span></span></span>
            <span className="r">{s.change && <Hover tip={<TipList title="Price change" rows={[['Before', usd2(s.change.from)], ['Now', usd2(s.change.to)]]} note={`Since ${shortDate(s.change.since)}`} />}>
              <span className={`pchange ${s.change.to > s.change.from ? 'up' : 'down'}`}>{s.change.to > s.change.from ? '↑' : '↓'} {usd2(Math.abs(s.change.to - s.change.from))}</span></Hover>}</span>
            <span className="r"><b className="amt">{usd2(s.amount)}</b>{s.estimate && <sup className="est">est</sup>}<div className="small muted amt"><Hover className="quiet" tip={<TipList rows={[['A month', usd2(s.monthly)], ['A year', usd2(s.yearly)]]}
              note={s.frequency === 'Monthly' ? null : `${s.frequency}, spread over the year.`} />}>{usd(s.yearly)} a year</Hover></div></span>
          </div>
        ))}
      </Panel>
    </>
  );
}

// ---------- Year in review ----------
function YearInReview() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api(`/reports/year?year=${year}`).then(setD); }, [year]);
  if (!d) return <PageSkeleton panels={1} />;
  const parts = d.groups.slice(0, 4).map((g, i) => ({ ...g, color: SERIES[i] }));
  const rest = d.groups.slice(4).reduce((s, g) => s + g.v, 0);
  if (rest > 0) parts.push({ name: 'Everything else', v: rest, share: (rest / d.spending) * 100, color: NEUTRAL });
  return (
    <>
      <div className="row base yearpick">
        <div className="ranges">{d.years.map((y) => <button key={y} className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}</div>
        <span className="small muted">{d.soFar ? 'So far this year' : ''}</span>
      </div>
      {!d.complete && <div className="note mt-sm">
        {d.completeFrom ? <>Not every bank's history reaches back to {d.year} (complete from {shortDate(d.completeFrom)}, {d.completeFrom.slice(0, 4)}), </> : <>Some history is missing, </>}
        so income and savings aren't shown, and spending only covers the accounts with history.</div>}
      <div className="cards yearcards">
        {d.complete && <div className="card"><h3>Income</h3><div className="big amt good">{usd(d.income)}</div></div>}
        <div className="card"><h3>Spending</h3><div className="big amt"><Hover className="quiet" tip={<TipList title="By month" rows={d.byMonth.map((m) => [monYear(m.m), usd(m.v)])} />}>{usd(d.spending)}</Hover></div>{d.topMonth && <div className="small muted">Most in {monYear(d.topMonth.m)} (<span className="amt">{usd(d.topMonth.v)}</span>)</div>}</div>
        {d.complete && <div className="card"><h3>Saved</h3><div className={`big amt ${d.saved < 0 ? 'bad' : ''}`}><Hover className="quiet" tip={<TipList rows={[['Income', usd(d.income)], ['Spending', `−${usd(d.spending)}`]]}
          note="Transfers, savings and card payments aren't spending." />}>{d.saved < 0 ? '−' : ''}{usd(Math.abs(d.saved))}</Hover></div>
          {d.rate != null && <div className="small muted">{Math.round(d.rate)}% of income</div>}</div>}
        <div className="card"><h3>Trips</h3><div className="big">{d.trips.length ? <Hover className="quiet" tip={<TipList rows={d.trips.map((t) => [t.name, usd(t.total), shortDate(t.start)])} />}>{d.trips.length}</Hover> : 0}</div><div className="small muted">{d.trips.length ? usd(d.trips.reduce((s, t) => s + t.total, 0)) : 'None confirmed'}</div></div>
      </div>
      <div className="grid2">
        <Panel title="Where it went">
          {parts.length > 0 && <div className="splitbar">{parts.map((p) => <i key={p.name} style={{ width: `${p.share}%`, background: p.color }} />)}</div>}
          <ul className="legend2">{parts.map((p) => <li key={p.name}><span><i className="dot" style={{ background: p.color }} />
            <Hover className="quiet" tip={p.categories?.length ? <TipList title={p.name} rows={p.categories.slice(0, 8).map((c) => [c.name, usd(c.v)])} />
              : d.groups.length > 4 && p.name === 'Everything else' ? <TipList rows={d.groups.slice(4).map((g) => [g.name, usd(g.v)])} /> : null}>{p.name}</Hover></span>
            <span><b className="amt">{usd(p.v)}</b> <span className="muted">{Math.round(p.share)}%</span></span></li>)}</ul>
        </Panel>
        <Panel title="Highlights">
          {d.biggest && <div className="trow"><span className="tmain"><span className="small muted">Biggest purchase</span><b>{d.biggest.name}</b>
            <span className="small muted">{shortDate(d.biggest.date)} · {d.biggest.category}</span></span><b className="amt">{usd2(d.biggest.amount)}</b></div>}
          {d.merchants.length > 0 && <div className="trow"><span className="tmain"><span className="small muted">Most visited</span>
            <b>{d.merchants[0].name}</b><span className="small muted">{d.merchants.slice(1, 4).map((m) => m.name).join(', ')}</span></span>
            <span className="small muted">{d.merchants[0].visits} visits</span></div>}
          {d.trips.map((t) => <div className="trow" key={t.id}><span className="tmain"><span className="small muted">Trip</span><b>{t.name}</b>
            <span className="small muted">{shortDate(t.start)} – {shortDate(t.end)}</span></span><b className="amt">{usd(t.total)}</b></div>)}
        </Panel>
      </div>
    </>
  );
}

const TABS = [['months', 'Month by month'], ['subscriptions', 'Subscriptions'], ['year', 'Year in review']];
export default function Reports() {
  const [tab, setTab] = useState(() => recall('tab', 'months'));
  const pick = useCallback((t) => { setTab(t); remember('tab', t); }, []);
  return (
    <>
      <PageHeader title="Reports" sub="Spending month by month, what you pay for on repeat, and how the year went.">
        <div className="ranges">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}</div>
      </PageHeader>
      <div className="mt">{tab === 'months' ? <MonthTable /> : tab === 'subscriptions' ? <Subscriptions /> : <YearInReview />}</div>
    </>
  );
}
