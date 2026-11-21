import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, usdCompact, niceTicks, shortDate, SERIES, NEUTRAL } from './format.js';
import useWidth from './useWidth.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList, Trend, Est } from './ui.jsx';
import Tip from './Tip.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import Trips from './Trips.jsx';
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
// `refunded`: refunds beyond the month's spending in this group (or, on the total, all groups), left out of spending.
// `cats`: for a group row, its categories' amounts this month ([name, value]), listed before the largest transactions;
// `card`: a whole tip to use instead (Total spending: the month's breakdown). The whole cell is the hover target, and
// entering it marks its month (`onHot`) in the header and the chart.
const txRow = (t) => [t.name, `${t.amount < 0 ? '−' : ''}${usd2(Math.abs(t.amount))}`, shortDate(t.date)];
function Cell({ v, partial, current, behind, avg, title, month, focus, hot, onHot, refunded = 0, cats, card }) {
  const refund = refunded >= 0.5 ? `${usd(refunded)} in refunds beyond spending, left out.` : null;
  const empty = Math.abs(v) < 0.5 && !refund;
  const split = cats?.filter(([, x]) => Math.abs(x) >= 0.5) ?? [];
  const shown = split.length > 1 ? 3 : behind?.top.length ?? 0;
  const note = [refund, behind?.count > shown ? `${behind.count} transactions; the largest ${shown} shown.` : null,
    avg ? `${v >= avg ? '+' : '−'}${usd(Math.abs(v - avg))} vs the average${current ? ' (month not over yet)' : ''}.` : null,
    partial ? 'Missing history from at least one bank.' : null].filter(Boolean).join(' ') || null;
  const tip = empty ? null : card ?? (split.length > 1
    ? <><TipList title={`${title}, ${monYear(month)}`} rows={split.map(([n, x]) => [n, `${x < 0 ? '−' : ''}${usd(Math.abs(x))}`, v > 0 && x > 0 ? `${Math.round((x / v) * 100)}%` : null])} />
      <div className="hovsub">Largest</div><TipList rows={(behind?.top ?? []).slice(0, 3).map(txRow)} note={note} /></>
    : behind?.count || refund ? <TipList title={`${title}, ${monYear(month)}`} rows={(behind?.top ?? []).map(txRow)} note={note} /> : null);
  return (
    <td className={`r amt rcell${partial ? ' partial' : ''}${current ? ' current' : ''}${focus ? ' rfocus' : ''}${hot ? ' rhot' : ''}`} onMouseEnter={onHot}>
      {empty ? <span className="muted">—</span> : <Figure partial={partial} current={current} tip={tip}>{usd(v)}</Figure>}
    </td>
  );
}

// One month's spending group by group: the breakdown behind a chart column and a Total spending figure. Each group in
// its chart colour, with its share of the month and how far it is from its own average (finished, complete months
// only, and only when it's a real difference); then anything left out.
function MonthBreakdown({ d, i, color, hint }) {
  const m = d.months[i], total = d.totals.spending.values[i], avgT = d.totals.spending.avg;
  const current = m === d.current, partial = d.partial[i], compare = !current && !partial;
  const rows = d.groups.filter((g) => g.spending && g.values[i] >= 0.5).sort((a, b) => b.values[i] - a.values[i]);
  const off = (v, avg) => (compare && avg != null && Math.abs(v - avg) >= Math.max(20, avg * 0.1) ? v - avg : null);
  const refunded = d.totals.spending.refunded?.[i] ?? 0;
  const notes = [refunded >= 0.5 ? `${usd(refunded)} in refunds beyond a group's spending, left out.` : null,
    partial ? 'Missing history from at least one bank.' : current ? "The month isn't over yet." : null, hint].filter(Boolean);
  return (
    <div className="mbk">
      <div className="mbk-head"><span>{monYear(m)}{current ? ' so far' : ''}</span><b className="amt">{usd(total)}</b></div>
      {compare && avgT != null && <div className="mbk-sub">{total >= avgT ? '+' : '−'}{usd(Math.abs(total - avgT))} vs the average month</div>}
      {rows.length > 0 && <div className="mbk-grid">
        <span className="mbk-cols"><span /><span /><span>Share</span><span /><span>{compare ? 'vs avg' : ''}</span></span>
        {rows.map((g) => {
          const v = g.values[i], dx = off(v, g.avg);
          return (
            <span className="mbk-row" key={g.group}>
              <i className="dot" style={{ background: color(g.name) }} />
              <span className="mbk-name">{g.name}</span>
              <span className="mbk-share">{total > 0 ? `${Math.round((v / total) * 100)}%` : ''}</span>
              <b className="amt">{usd(v)}</b>
              <span className={`mbk-delta${dx == null ? '' : dx > 0 ? ' up' : ' down'}`}>{dx == null ? '' : <><Trend up={dx > 0} />{usd(Math.abs(dx))}</>}</span>
            </span>
          );
        })}
      </div>}
      {notes.length > 0 && <div className="hovnote muted">{notes.join(' ')}</div>}
    </div>
  );
}

// The months' shape before their numbers: each month's spending as a stack of its four biggest groups (over the range,
// in series order) and everything else in grey, its total written on top, the average a dashed rule. A month missing
// a bank's history is faded and the month in progress is drawn in outline, the same pencil the table uses.
// The chart's colours: the four biggest spending groups over the range in series order, everything else grey.
function shapeColors(d, cols) {
  const spend = d.groups.filter((g) => g.spending);
  const tot = (g) => cols.reduce((s, i) => s + Math.max(0, g.values[i]), 0);
  const top = [...spend].sort((a, b) => tot(b) - tot(a)).slice(0, 4).filter((g) => tot(g) > 0);
  const rest = spend.filter((g) => !top.includes(g));
  return { top, rest, color: (name) => SERIES[top.findIndex((g) => g.name === name)] ?? NEUTRAL };
}

// Hovering a month anywhere in its column (or focusing it; arrow keys move along) lifts it, fades the rest, marks its
// column in the table and opens its breakdown beside the bar. Clicking marks the month in the table (again: unmarks).
// `hot`: the month index hovered here or in the table.
function MonthShape({ d, cols, hot, onHot, mark, onPick }) {
  const [ref, W] = useWidth(900);
  const [tip, setTip] = useState(null);
  const H = 190, L = 52, T = 22, B = 24;
  const { top, rest, color } = shapeColors(d, cols);
  const stacks = cols.map((i) => {
    const parts = [...top.map((g, k) => ({ name: g.name, v: Math.max(0, g.values[i]), color: SERIES[k] })),
      { name: 'Everything else', v: rest.reduce((s, g) => s + Math.max(0, g.values[i]), 0), color: NEUTRAL }];
    return { i, m: d.months[i], parts, total: parts.reduce((s, p) => s + p.v, 0), partial: d.partial[i], current: d.months[i] === d.current };
  });
  const avg = d.totals.spending.avg;
  const { ticks, hi } = niceTicks(0, Math.max(1, ...stacks.map((s) => s.total), avg ?? 0), 4);
  const y = (v) => T + ((hi - v) * (H - T - B)) / hi;
  const band = (W - L) / Math.max(1, stacks.length), bw = Math.min(88, band * 0.46); // the bars, not the gaps, carry the shape
  const cx = (k) => L + band * (k + 0.5);
  // The card sits beside the bar (right of it; left of it in the right half), level with the top of the plot.
  const enter = (k) => {
    onHot(stacks[k].i);
    const right = k >= stacks.length / 2;
    setTip({ x: right ? cx(k) - bw / 2 + 2 : cx(k) + bw / 2 - 2, y: T - 18, right,
      content: <MonthBreakdown d={d} i={stacks[k].i} color={color} hint={stacks[k].m === mark ? 'Click to unmark it in the table.' : 'Click to mark it in the table.'} /> });
  };
  const leave = () => { setTip(null); onHot(null); };
  const step = (e, k) => {
    const to = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: stacks.length - 1 }[e.key];
    if (to != null) { e.preventDefault(); e.currentTarget.parentNode.querySelectorAll('.rshape-col')[Math.max(0, Math.min(stacks.length - 1, to))]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(stacks[k].m); }
    else if (e.key === 'Escape') leave();
  };
  return (
    <div className={`rshape${hot != null ? ' hot' : ''}`}>
      <div ref={ref} />
      <div className="legend rshape-key">{top.map((g, k) => <span key={g.name}><i className="dot" style={{ background: SERIES[k] }} />{g.name}</span>)}
        {rest.length > 0 && <span><i className="dot" style={{ background: NEUTRAL }} />Everything else</span>}
        {avg != null && <span><i className="rshape-avgkey" />Average</span>}</div>
      <div className="rshape-plot" onMouseLeave={leave}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Spending by month, by group" style={{ '--base': `${y(0)}px` }}>
        {ticks.map((v) => <g key={v}><line className="grid" x1={L} x2={W} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{usdCompact(v, 1)}</text></g>)}
        {stacks.map((s, k) => {
          let base = 0;
          return (
            <g key={s.m} className={`rshape-col${s.partial ? ' partial' : ''}${s.current ? ' current' : ''}${hot === s.i ? ' on' : ''}${mark === s.m ? ' mark' : ''}`} style={{ '--i': k }}
              tabIndex={0} role="button" aria-pressed={mark === s.m} aria-label={`${monYear(s.m)}${s.current ? ' so far' : ''}: ${usd(s.total)} spent. Mark it in the table.`}
              onMouseEnter={() => enter(k)} onFocus={() => enter(k)} onBlur={leave} onClick={() => onPick(s.m)} onKeyDown={(e) => step(e, k)}>
              <rect className="rshape-bg" x={L + band * k + 2} y={T - 18} width={band - 4} height={H - T + 18} rx="6" />
              {s.parts.filter((p) => p.v > 0).map((p) => {
                const y0 = y(base + p.v), h = y(base) - y0; base += p.v;
                return <rect key={p.name} className="rshape-seg" x={cx(k) - bw / 2} y={y0} width={bw} height={Math.max(0, h - 1)} fill={p.color} stroke={s.current ? p.color : undefined} />;
              })}
              <text className="rshape-tot" x={cx(k)} y={y(s.total) - 6} textAnchor="middle">{s.total >= 1000 ? usdCompact(s.total, 1) : usd(s.total)}</text>
              <text className="rshape-mon" x={cx(k)} y={H - 6} textAnchor="middle">{mon(s.m)}{s.current ? ' so far' : ''}</text>
            </g>
          );
        })}
        {avg != null && <line className="rshape-avg" x1={L} x2={W} y1={y(avg)} y2={y(avg)} />}
      </svg>
      <Tip tip={tip} />
      </div>
    </div>
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
  const [mark, setMark] = useState(focus); // the month marked in the table: picked in the year at a glance or the chart
  const [hot, setHot] = useState(null); // the month index under the pointer, in the chart or the table
  useEffect(() => setMark(focus), [focus]);
  useEffect(() => { setD(null); api(`/reports/months?months=${n}`).then(setD); }, [n]);
  useEffect(() => { if (d && focus) document.querySelector('.rtable th.rfocus')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [d, focus]);
  if (!d) return <PageSkeleton panels={1} header={false} />;
  // A month with nothing in any row (before any history) is left out rather than shown as a column of dashes.
  const used = d.months.map((_, i) => i).filter((i) => d.groups.some((g) => Math.abs(g.values[i]) >= 0.5) || Math.abs(d.totals.spending.values[i]) >= 0.5);
  const cols = used.length ? used : d.months.map((_, i) => i);
  const toggle = (g) => { const o = { ...open, [g]: !open[g] }; setOpen(o); remember('open', o); };
  const { color } = shapeColors(d, cols);
  const row = (r, opts = {}) => {
    return (
      <tr key={opts.key ?? r.name} className={opts.cls}>
        <td>{opts.label ?? r.name}</td>
        {cols.map((i) => <Cell key={d.months[i]} v={r.values[i]} partial={d.partial[i]} current={d.months[i] === d.current}
          behind={r.behind?.[i]} refunded={r.refunded?.[i]} avg={r.avg} title={typeof opts.label === 'string' ? opts.label : r.name} month={d.months[i]}
          focus={d.months[i] === mark} hot={hot === i} onHot={() => setHot(i)}
          cats={r.categories?.length > 1 ? r.categories.map((c) => [c.name, c.values[i]]).sort((a, b) => b[1] - a[1]) : undefined}
          card={opts.total ? <MonthBreakdown d={d} i={i} color={color} /> : undefined} />)}
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
      <MonthShape d={d} cols={cols} hot={hot} onHot={setHot} mark={mark} onPick={(m) => setMark(mark === m ? null : m)} />
      <table className="t rtable" onMouseLeave={() => setHot(null)}>
        <thead><tr><th />{cols.map((i) => [d.months[i], i]).map(([m, i]) => <th key={m} className={`r${d.partial[i] ? ' partial' : ''}${m === mark ? ' rfocus' : ''}${hot === i ? ' rhot' : ''}`}>
          {d.partial[i] && d.missing[i]?.length ? <Hover className="quiet" tip={<TipList title={`${monYear(m)} is incomplete`}
            rows={d.missing[i].map((x) => [x.bank, `from ${shortDate(x.from)}`])} note="These banks' history starts later, so their activity this month is missing." />}>
            {mon(m)}{m === d.current ? ' so far' : ''}</Hover> : <>{mon(m)}{m === d.current ? ' so far' : ''}</>}</th>)}
          <th className="r"><Hover className="quiet" tip={<TipList rows={[]} note="Average of finished months with history from every bank." />}>Average</Hover></th></tr></thead>
        <tbody>
          {income && <>{row(income, { cls: 'rgroup rincome', label: <><CategoryIcon group="Income" size={22} />Income</> })}</>}
          <tr className="rsep"><td colSpan={cols.length + 2}>Spending</td></tr>
          {section(spend)}
          {row(d.totals.spending, { cls: 'rtotal', label: 'Total spending', total: true })}
          {other.length > 0 && <><tr className="rsep"><td colSpan={cols.length + 2}>Saving & debt</td></tr>{section(other)}</>}
        </tbody>
      </table>
    </Panel>
  );
}

// ---------- Subscriptions ----------
function Subscriptions() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/reports/subscriptions').then(setD); }, []);
  if (!d) return <PageSkeleton panels={1} header={false} />;
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
            <button key={g.m} type="button" className={`yg-month${g.partial ? ' partial' : ''}${g.nodata ? ' nodata' : ''}${g.future ? ' future' : ''}`} disabled={g.future}
              onClick={() => onOpen(g.m)} aria-label={`${monYear(g.m)}: open in Month by month`}>
              <span className="yg-head"><b>{mon(g.m)}</b>
                {g.nodata ? <span className="small muted yg-nodata" title="No history yet: your banks don't reach back this far.">—</span>
                  : !g.future && <span className="small amt">{why ? <Est why={why}>{usd(total)}</Est> : usd(total)}</span>}</span>
              <span className="yg-grid" aria-hidden="true">
                {WEEK.map((w, i) => <span key={i} className="yg-wd">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {g.steps.map((st, i) => {
                  const date = `${g.m}-${String(i + 1).padStart(2, '0')}`, wd = (lead + i) % 7, size = st ? Math.round(SIZES[st] * GLANCE_SCALE) : 0;
                  return <span key={date} className={`yg-day${wd === 0 || wd === 6 ? ' weekend' : ''}${date === today ? ' today' : ''}`}>
                    {size > 0 ? <i className="amt" style={{ width: size, height: size }} /> : st === 0 && !g.nodata ? <i className="none" /> : null}</span>;
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
  if (!d) return <PageSkeleton panels={1} header={false} />;
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
        {d.complete && <div className="card"><h3>Saved</h3><div className={`big amt ${d.saved < 0 ? 'bad' : ''}`}><Hover className="quiet" tip={<TipList rows={[['Income', usd(d.income)], ['Spending', `−${usd(d.spending)}`],
            ...(d.fromPay > 0 ? [['Put in from your pay', `+${usd(d.fromPay)}`, d.fromPaySince ? `since ${shortDate(d.fromPaySince)}` : '401(k) and similar']] : [])]}
          note={d.fromPay > 0 ? 'Contributions taken from your paycheck count as saved, and the rate is over income plus them.' : "Transfers, savings and card payments aren't spending."} />}>{d.saved < 0 ? '−' : ''}{usd(Math.abs(d.saved))}</Hover></div>
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

const TABS = [['months', 'Month by month'], ['subscriptions', 'Subscriptions'], ['year', 'Year in review'], ['trips', 'Trips']];
// #/reports?tab=trips (what the old #/trips address becomes) picks the tab; otherwise the one you last used.
const hashTab = () => {
  const h = window.location.hash;
  const t = /^#\/trips/.test(h) ? 'trips' : new URLSearchParams(h.split('?')[1] ?? '').get('tab');
  return TABS.some(([k]) => k === t) ? t : null;
};
export default function Reports() {
  const [tab, setTab] = useState(() => hashTab() ?? recall('tab', 'months'));
  useEffect(() => {
    const f = () => { const t = hashTab(); if (t) setTab(t); };
    window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f);
  }, []);
  const [focus, setFocus] = useState(null); // a month opened from the year at a glance
  const pick = useCallback((t) => {
    setTab(t); setFocus(null); remember('tab', t);
    if (window.location.hash.includes('?')) window.history.replaceState(null, '', '#/reports'); // drop a stale ?tab=
  }, []);
  const openMonth = useCallback((m) => { setTab('months'); setFocus(m); remember('tab', 'months'); window.scrollTo({ top: 0 }); }, []);
  return (
    <>
      <PageHeader title="Reports">
        <div className="ranges">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}</div>
      </PageHeader>
      <div className="mt">{tab === 'months' ? <MonthTable key={focus ?? ''} focus={focus} /> : tab === 'subscriptions' ? <Subscriptions /> : tab === 'trips' ? <Trips embedded /> : <YearInReview onOpen={openMonth} />}</div>
    </>
  );
}
