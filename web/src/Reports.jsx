import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, shortDate, SERIES, NEUTRAL } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList, Trend, Est } from './ui.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { SIZES } from './MonthSpread.jsx';

const mon = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'short' });
const monYear = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const remember = (k, v) => { try { localStorage.setItem(`wf.reports.${k}`, JSON.stringify(v)); } catch { /* unavailable */ } };
const recall = (k, d) => { try { return JSON.parse(localStorage.getItem(`wf.reports.${k}`)) ?? d; } catch { return d; } };

// ---------- Month by month ----------
// Each cell is shaded by how it compares with the row's biggest month, so unusual months stand out.
// A partial month's or the current month's figure is pencil (<Est>); the Hover, when there is one, sits outside so
// its tip still works.
function Figure({ partial, current, tip, children }) {
  const why = partial ? 'Incomplete: missing history from at least one bank.' : current ? "This month isn't over yet" : null;
  const fig = why ? <Est why={why}>{children}</Est> : children;
  return tip ? <Hover className="quiet" tip={tip}>{fig}</Hover> : fig;
}
function Cell({ v, max, partial, current, behind, avg, title, month, focus }) {
  const share = max > 0 ? Math.max(0, v) / max : 0;
  const empty = Math.abs(v) < 0.5;
  const tip = !empty && behind?.count ? <TipList title={`${title}, ${monYear(month)}`}
    rows={behind.top.map((t) => [t.name, `${t.amount < 0 ? '−' : ''}${usd2(Math.abs(t.amount))}`, shortDate(t.date)])}
    note={[behind.count > behind.top.length ? `${behind.count} transactions; the largest ${behind.top.length} shown.` : null,
      avg ? `${v >= avg ? '+' : '−'}${usd(Math.abs(v - avg))} vs the average${current ? ' (month not over yet)' : ''}.` : null,
      partial ? 'Missing history from at least one bank.' : null].filter(Boolean).join(' ') || null} /> : null;
  return (
    <td className={`r amt rcell${partial ? ' partial' : ''}${current ? ' current' : ''}${focus ? ' rfocus' : ''}`} style={{ '--share': share }}>
      {empty ? <span className="muted">—</span> : <Figure partial={partial} current={current} tip={tip}>{usd(v)}</Figure>}
    </td>
  );
}

// Months from `m` to this month, counting both.
const monthsSince = (m) => { const t = new Date(); return (t.getFullYear() - +m.slice(0, 4)) * 12 + t.getMonth() + 1 - +m.slice(5, 7) + 1; };

// `focus` (a month picked in the year at a glance) widens the range to reach it and marks its column.
function MonthTable({ focus }) {
  const [n, setN] = useState(() => {
    const need = focus ? monthsSince(focus) : 0;
    return Math.max(recall('months', 6), need <= 6 ? 6 : need <= 12 ? 12 : 24);
  });
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(() => recall('open', {}));
  useEffect(() => { setD(null); api(`/reports/months?months=${n}`).then(setD); }, [n]);
  useEffect(() => { if (d && focus) document.querySelector('.rtable .rfocus')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [d, focus]);
  if (!d) return <PageSkeleton panels={1} />;
  const toggle = (g) => { const o = { ...open, [g]: !open[g] }; setOpen(o); remember('open', o); };
  const row = (r, opts = {}) => {
    const max = Math.max(...r.values.map(Math.abs), 1);
    return (
      <tr key={opts.key ?? r.name} className={opts.cls}>
        <td>{opts.label ?? r.name}</td>
        {r.values.map((v, i) => <Cell key={d.months[i]} v={v} max={max} partial={d.partial[i]} current={d.months[i] === d.current}
          behind={r.behind?.[i]} avg={r.avg} title={typeof opts.label === 'string' ? opts.label : r.name} month={d.months[i]} focus={d.months[i] === focus} />)}
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
        <thead><tr><th />{d.months.map((m, i) => <th key={m} className={`r${d.partial[i] ? ' partial' : ''}${m === focus ? ' rfocus' : ''}`}>
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
      {(d.partial.some(Boolean) || d.months.includes(d.current)) && <p className="small muted foot">Grey dashed figures aren't final.
        {d.partial.some(Boolean) ? " Months with faded headings are missing history from at least one bank, so they're incomplete and left out of the average." : ''}
        {d.months.includes(d.current) ? ` ${mon(d.current)} isn't over yet, so it's left out of the average too.` : ''}</p>}
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
    <div className="ledger">
      <div className="cards ruled subcards">
        <div className="card"><h3>Every month</h3><div className="big amt">{usd(d.monthly)}</div><div className="small muted">{d.items.length} subscription{d.items.length > 1 ? 's' : ''}</div></div>
        <div className="card"><h3>Every year</h3><div className="big amt">{usd(d.yearly)}</div><div className="small muted">at today's prices</div></div>
        <div className="card"><h3>Price changes</h3><div className="big">{changed.length}</div><div className="small muted">{changed.length ? changed.map((s) => s.name).slice(0, 3).join(', ') : 'None lately'}</div></div>
      </div>
      <Panel title="Subscriptions" actions={<a href="#/bills">Bills</a>}>
        <p className="small muted mt-0">Everything recurring that isn't rent, utilities, insurance or a card payment. Not a subscription? Mark it "Not a bill" on the Bills page.</p>
        {d.items.map((s) => (
          <div className="trow sub" key={s.key}>
            <span className="rowicon"><CategoryIcon group={s.grp} sub={s.category} />
              <span className="tmain"><b>{s.recent?.length ? <Hover className="quiet" tip={<TipList title="Recent charges" rows={s.recent.map((r) => [shortDate(r.date), usd2(r.amount)])}
                note={s.next ? `Next around ${shortDate(s.next)}.` : null} />}>{s.name}</Hover> : s.name}</b><span className="small muted">{s.frequency} · {s.category}{s.account ? ` · ${s.account}` : ''}{s.last ? ` · last ${shortDate(s.last)}` : ''}</span></span></span>
            <span className="r">{s.change && <Hover tip={<TipList title="Price change" rows={[['Before', usd2(s.change.from)], ['Now', usd2(s.change.to)]]} note={`Since ${shortDate(s.change.since)}`} />}>
              <span className={`pchange ${s.change.to > s.change.from ? 'up' : 'down'}`}><Trend up={s.change.to > s.change.from} /> {usd2(Math.abs(s.change.to - s.change.from))}</span></Hover>}</span>
            <span className="r">{s.estimate ? <Est why="Estimate: the amount varies"><b className="amt">{usd2(s.amount)}</b></Est> : <b className="amt">{usd2(s.amount)}</b>}<div className="small muted amt"><Hover className="quiet" tip={<TipList rows={[['A month', usd2(s.monthly)], ['A year', usd2(s.yearly)]]}
              note={s.frequency === 'Monthly' ? null : `${s.frequency}, spread over the year.`} />}>{usd(s.yearly)} a year</Hover></div></span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ---------- Year at a glance ----------
// Twelve small month spreads: one ink dot per day on the dashboard spread's size ramp (shrunk to fit, same eight
// steps), no stamps. A month is a button that opens it in Month by month. Months missing history from a bank are
// pencil, like everywhere else.
const GLANCE_SCALE = 0.62;
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function YearGlance({ glance, byMonth, onOpen }) {
  const today = new Date().toLocaleDateString('en-CA');
  const spent = Object.fromEntries(byMonth.map((x) => [x.m, x.v]));
  return (
    <Panel title="Year at a glance" className="yglance" actions={<span className="legend yg-legend"><span><i className="lgdot" />Spent that day</span></span>}>
      <div className="yg-months">
        {glance.map((g) => {
          const lead = new Date(`${g.m}-01T00:00`).getDay();
          const why = g.partial ? 'Incomplete: missing history from at least one bank.' : g.m === today.slice(0, 7) ? "This month isn't over yet" : null;
          const total = spent[g.m] ?? 0;
          return (
            <button key={g.m} type="button" className={`yg-month${g.partial ? ' partial' : ''}${g.future ? ' future' : ''}`} disabled={g.future}
              onClick={() => onOpen(g.m)} aria-label={`${monYear(g.m)}: open in Month by month`}>
              <span className="yg-head"><b>{mon(g.m)}</b>
                {!g.future && <span className="small amt">{why ? <Est why={why}>{usd(total)}</Est> : usd(total)}</span>}</span>
              <span className="yg-grid" aria-hidden="true">
                {WEEK.map((w, i) => <span key={i} className="yg-wd">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {g.steps.map((st, i) => {
                  const date = `${g.m}-${String(i + 1).padStart(2, '0')}`, wd = (lead + i) % 7, size = st ? Math.round(SIZES[st] * GLANCE_SCALE) : 0;
                  return <span key={date} className={`yg-day${wd === 0 || wd === 6 ? ' weekend' : ''}${date === today ? ' today' : ''}`}>
                    {size > 0 ? <i className="amt" style={{ width: size, height: size }} /> : st === 0 ? <i className="none" /> : null}</span>;
                })}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------- Year in review ----------
function YearInReview({ onOpen }) {
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
      <div className="ledger mt">
      <div className="cards ruled yearcards">
        {d.complete && <div className="card"><h3>Income</h3><div className="big amt good">{usd(d.income)}</div></div>}
        <div className="card"><h3>Spending</h3><div className="big amt"><Hover className="quiet" tip={<TipList title="By month" rows={d.byMonth.map((m) => [monYear(m.m), usd(m.v)])} />}>{usd(d.spending)}</Hover></div>{d.topMonth && <div className="small muted">Most in {monYear(d.topMonth.m)} (<span className="amt">{usd(d.topMonth.v)}</span>)</div>}</div>
        {d.complete && <div className="card"><h3>Saved</h3><div className={`big amt ${d.saved < 0 ? 'bad' : ''}`}><Hover className="quiet" tip={<TipList rows={[['Income', usd(d.income)], ['Spending', `−${usd(d.spending)}`]]}
          note="Transfers, savings and card payments aren't spending." />}>{d.saved < 0 ? '−' : ''}{usd(Math.abs(d.saved))}</Hover></div>
          {d.rate != null && <div className="small muted">{Math.round(d.rate)}% of income</div>}</div>}
        <div className="card"><h3>Trips</h3><div className="big">{d.trips.length ? <Hover className="quiet" tip={<TipList rows={d.trips.map((t) => [t.name, usd(t.total), shortDate(t.start)])} />}>{d.trips.length}</Hover> : 0}</div><div className="small muted">{d.trips.length ? usd(d.trips.reduce((s, t) => s + t.total, 0)) : 'None confirmed'}</div></div>
      </div>
      {d.glance && <YearGlance glance={d.glance} byMonth={d.byMonth} onOpen={onOpen} />}
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
      </div>
    </>
  );
}

const TABS = [['months', 'Month by month'], ['subscriptions', 'Subscriptions'], ['year', 'Year in review']];
export default function Reports() {
  const [tab, setTab] = useState(() => recall('tab', 'months'));
  const [focus, setFocus] = useState(null); // a month opened from the year at a glance
  const pick = useCallback((t) => { setTab(t); setFocus(null); remember('tab', t); }, []);
  const openMonth = useCallback((m) => { setTab('months'); setFocus(m); remember('tab', 'months'); window.scrollTo({ top: 0 }); }, []);
  return (
    <>
      <PageHeader title="Reports" sub="Spending month by month, what you pay on repeat, and how the year went.">
        <div className="ranges">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}</div>
      </PageHeader>
      <div className="mt">{tab === 'months' ? <MonthTable key={focus ?? ''} focus={focus} /> : tab === 'subscriptions' ? <Subscriptions /> : <YearInReview onOpen={openMonth} />}</div>
    </>
  );
}
