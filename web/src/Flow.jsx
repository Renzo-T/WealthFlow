import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, INCOME, SERIES, NEUTRAL } from './format.js';
import AccountFlow from './AccountFlow.jsx';
import MonthReplay from './MonthReplay.jsx';
import Tip, { useTip } from './Tip.jsx';
import { Panel, PageHeader, Skeleton, askText, Chevron } from './ui.jsx';

const VIEW_KEY = 'wealthflow.flowView';
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) || 'groups'; } catch { return 'groups'; } };

const W = 760, BAR = 8, LX = 190, RX = W - 190 - BAR, HW = 12, HX = W / 2 - HW / 2, GAP = 12, SLOT = 34, TOP = 34;
// Colour by role, never by rank: money in and money kept are green, spending is the planner's indigo ink, saving and
// debt payments are grey, money taken from savings is ochre, refunds teal. Every bar is labelled, so colour never has to
// tell one group from another on its own.
const GREEN = INCOME, AMBER = SERIES[1], TEAL = SERIES[2], INK = 'var(--ink-dot)';
const SMALL = 0.02; // spending groups under 2% of the total fold into "Everything else" (listed on hover)
const monthName = (m) => new Date(m + '-01T00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const short = (s) => (s.length > 24 ? s.slice(0, 23) + '…' : s);
const band = (x0, a0, b0, x1, a1, b1) => {
  const m = (x0 + x1) / 2;
  return `M${x0},${a0} C${m},${a0} ${m},${a1} ${x1},${a1} L${x1},${b1} C${m},${b1} ${m},${b0} ${x0},${b0} Z`;
};

// Income sources → one "income" bar in the middle → spending categories and what was saved.
// Both sides add up to the same total: "From account balances" or "Left over" balances them.
// Shares under 1% say "<1%" rather than a misleading 0%.
const pctOf = (v, t) => { const p = (v / t) * 100; return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`; };
const lastDay = (to) => new Date(Date.parse(to + 'T00:00') - 864e5).toLocaleDateString('en-CA'); // `to` is exclusive

// Changing the period morphs the chart instead of redrawing it: each stream grows, shrinks or slides to its new size,
// a new one grows from nothing and a gone one shrinks away, so what changed is what moves. Nothing animates on arrival.
const MORPH = 480, GEO = ['y', 'hgt', 'hy', 'hh', 'mid'];
const ease = (t) => 1 - (1 - t) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function useMorph(layout) {
  const [shown, setShown] = useState(layout);
  const cur = useRef(layout), raf = useRef(0);
  useEffect(() => {
    const from = cur.current;
    cancelAnimationFrame(raf.current);
    if (from === layout || reduced()) { cur.current = layout; setShown(layout); return undefined; }
    const prev = new Map(from.nodes.filter((x) => !x.exiting).map((x) => [x.id, x]));
    const next = new Set(layout.nodes.map((x) => x.id));
    const pairs = [
      ...layout.nodes.map((x) => [prev.get(x.id) ?? { ...x, hgt: 0, hh: 0, entering: true }, x]),
      ...[...prev.values()].filter((x) => !next.has(x.id)).map((x) => [x, { ...x, hgt: 0, hh: 0, exiting: true }]),
    ];
    const t0 = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / MORPH), e = ease(k);
      const nodes = pairs.filter(([, b]) => !(b.exiting && k === 1)).map(([a, b]) => {
        const o = { ...b, fade: b.exiting ? 1 - e : a.entering ? e : 1 };
        for (const g of GEO) o[g] = lerp(a[g], b[g], e);
        return o;
      });
      const st = k === 1 ? layout : { ...layout, nodes, H: lerp(from.H, layout.H, e), hubTop: lerp(from.hubTop, layout.hubTop, e), hub: lerp(from.hub, layout.hub, e) };
      cur.current = st; setShown(st);
      if (k < 1) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [layout]);
  return shown;
}

// Where everything sits, from the period's figures.
function layoutOf(f) {
  const left = f.sources.map((s) => ({ ...s, color: s.saved ? AMBER : s.credit ? TEAL : GREEN }));
  const total = left.reduce((s, x) => s + x.value, 0);
  const role = (c) => (c.saved ? GREEN : /Savings|Debt/.test(c.name) ? NEUTRAL : INK);
  const big = f.categories.filter((c) => c.saved || /Savings|Debt/.test(c.name) || c.value >= total * SMALL);
  const small = f.categories.filter((c) => !big.includes(c));
  const rest = small.length > 1 ? [{ name: 'Everything else', value: small.reduce((s, c) => s + c.value, 0), rest: small }] : small;
  const spend = [...big.filter((c) => !c.saved && role(c) === INK), ...rest];
  const right = [...spend, ...big.filter((c) => !spend.includes(c))].map((c) => ({ ...c, color: c.rest ? NEUTRAL : role(c) }));
  const n = Math.max(left.length, right.length);
  const k = Math.max(180, n * 28) / total; // px per dollar: the hub is at least 180px tall
  const hub = total * k;
  // A thin bar sits at the top of its slot so the band stays attached; the label is centred in the slot.
  const slots = (nodes) => nodes.reduce((s, x) => s + Math.max(SLOT, x.value * k) + GAP, -GAP);
  const body = Math.max(hub, slots(left), slots(right)) + 4;
  const H = body + TOP; // room above for the hub's label
  const hubTop = TOP + (body - hub) / 2;
  const stack = (nodes, side) => {
    let y = TOP + (body - slots(nodes)) / 2, h = hubTop;
    return nodes.map((x) => {
      const hgt = Math.max(2, x.value * k), slot = Math.max(SLOT, hgt);
      const r = { ...x, id: `${side}:${x.name}`, side, y, hgt, hy: h, hh: x.value * k, mid: y + slot / 2 };
      y += slot + GAP; h += r.hh;
      return r;
    });
  };
  return { total, income: f.income || total, H, hub, hubTop, nodes: [...stack(left, 'l'), ...stack(right, 'r')] };
}

function Sankey({ f, rename, label }) {
  const [hl, setHl] = useState(null); // 'l:<name>' or 'r:<name>'
  const [tip, show, hide] = useTip();
  const layout = useMemo(() => layoutOf(f), [f]);
  const shown = useMorph(layout);
  const { total, income, H, hub, hubTop, nodes } = shown;
  const moving = shown !== layout; // mid-morph: the hover fade must not trail the per-frame opacity
  const L = nodes.filter((x) => x.side === 'l'), R = nodes.filter((x) => x.side === 'r');
  const op = (id) => (hl == null ? 0.3 : hl === id ? 0.62 : 0.07);
  const fade = (x) => (x.fade == null || x.fade === 1 ? undefined : { opacity: x.fade, pointerEvents: 'none' });
  // Hover a band, bar or label: highlight it and explain it. Spending groups open their transactions on click.
  const on = (side, x) => (x.exiting ? {} : {
    onMouseMove: (e) => {
      setHl(`${side}:${x.name}`);
      show(e, side === 'l' ? <>
        <b>{x.name}</b><div>{usd2(x.value)}</div>
        <div className="muted">{x.saved ? "Money you already had: spent or put into savings beyond this period's income" : x.credit ? "Refunds beyond this group's spending: money in, but not income" : `${pctOf(x.value, income)} of income`}</div>
      </> : <>
        <b>{x.name}</b><div>{usd2(x.value)} <span className="muted">· {pctOf(x.value, income)} of income</span></div>
        {x.rest && <ul>{x.rest.map((s) => <li key={s.name}><span>{s.name}</span><span>{usd2(s.value)}</span></li>)}</ul>}
        {x.subs?.length > 0 && <ul>{x.subs.map((s) => <li key={s.name}><span>{s.name}</span><span>{usd2(s.value)}</span></li>)}</ul>}
        {!x.saved && !x.rest && <div className="muted">Click to see these transactions</div>}
      </>);
    },
    onMouseLeave: () => { setHl(null); hide(); },
    onClick: side === 'r' && !x.saved && !x.rest ? () => { window.location.hash = `#/transactions?category=${encodeURIComponent(`g:${x.name}`)}&from=${f.from}&to=${lastDay(f.to)}`; } : undefined,
    style: { cursor: side === 'r' && !x.saved && !x.rest ? 'pointer' : 'default' },
  });
  return (
    <>
    <svg className={`chart sankey${moving ? ' moving' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where your money came from and where it went">
      <g>
        {L.map((x) => <path key={'l' + x.name} className="ribbon" d={band(LX + BAR, x.y, x.y + x.hgt, HX, x.hy, x.hy + x.hh)} fill={x.color} opacity={op(`l:${x.name}`) * (x.fade ?? 1)} {...on('l', x)} />)}
        {R.map((x) => <path key={'r' + x.name} className="ribbon" d={band(HX + HW, x.hy, x.hy + x.hh, RX, x.y, x.y + x.hgt)} fill={x.color} opacity={op(`r:${x.name}`) * (x.fade ?? 1)} {...on('r', x)} />)}
      </g>
      <rect x={HX} y={hubTop} width={HW} height={hub} rx={HW / 2} style={{ fill: 'var(--ink-dot)' }} />
      <text x={W / 2} y={hubTop - 18} textAnchor="middle" className="fl hubname">{label ?? 'This period'}</text>
      <text x={W / 2} y={hubTop - 5} textAnchor="middle" className="amtsvg">{usd(total)} in</text>
      {L.map((x) => (
        <g key={'ln' + x.name} style={fade(x)}>
          <rect x={LX} y={x.y} width={BAR} height={x.hgt} rx={Math.min(BAR / 2, x.hgt / 2)} fill={x.color} {...on('l', x)} />
          <text x={LX - 8} y={x.mid - 2} textAnchor="end" className={`fl${x.key ? ' click' : ''}`}
            onClick={x.key ? () => rename(x.key, x.name) : undefined}><title>{x.key ? 'Click to rename' : x.name}</title>{short(x.name)}</text>
          <text x={LX - 8} y={x.mid + 11} textAnchor="end">{usd2(x.value)}</text>
        </g>
      ))}
      {R.map((x) => (
        <g key={'rn' + x.name} style={fade(x)}>
          <rect x={RX} y={x.y} width={BAR} height={x.hgt} rx={Math.min(BAR / 2, x.hgt / 2)} fill={x.color} {...on('r', x)} />
          <text x={RX + BAR + 8} y={x.mid - 2} className="fl" {...on('r', x)}>{short(x.name)}</text>
          <text x={RX + BAR + 8} y={x.mid + 11}>{usd2(x.value)} · {pctOf(x.value, total)}</text>
        </g>
      ))}
    </svg>
    <Tip tip={tip} />
    </>
  );
}

export default function Flow() {
  const [months, setMonths] = useState([]);
  const [sel, setSel] = useState('days=30');
  const [f, setF] = useState(null);
  const [acc, setAcc] = useState(null);
  const [view, setView] = useState(savedView);
  const [tick, setTick] = useState(0);
  useEffect(() => { api('/cashflow').then((cf) => setMonths(cf.filter((m) => m.income || m.spending))); }, []);
  // The current chart stays (faded) while the next period loads, then morphs into it.
  useEffect(() => { let on = true; api(`/flow?${sel}`).then((r) => on && setF({ ...r, sel })); return () => { on = false; }; }, [sel, tick]);
  useEffect(() => { setAcc(null); if (view === 'accounts') api(`/flow?${sel}&view=accounts`).then(setAcc); }, [sel, view, tick]);
  const pick = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ } };
  const rename = async (key, name) => {
    const label = await askText({ title: 'Name this income source', label: 'Leave empty to reset', value: name });
    if (label === null) return;
    await api('/income-names', { method: 'PUT', body: JSON.stringify({ key, label }) });
    setTick((t) => t + 1);
  };

  // One month at a time, stepped with arrows (the same control as Budget's month), instead of a pill per month.
  const picked = sel.startsWith('month=') ? sel.slice(6) : null;
  const mi = picked ? months.findIndex((m) => m.month === picked) : months.length;
  const step = (d) => { const m = months[Math.max(0, Math.min(months.length - 1, mi + d))]; if (m) setSel(`month=${m.month}`); };
  const net = f ? f.income - f.spending : 0;
  const day = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const period = f ? `${day(f.from)} – ${day(new Date(Date.parse(f.to + 'T00:00') - 864e5).toLocaleDateString('en-CA'))}` : '';
  return (
    <>
      <PageHeader title="Money flow" sub={view === 'groups'
        ? 'Income and spending by budget group, leaving out transfers between your accounts.'
        : 'How money moved from income, through your accounts, to spending and savings.'} />
      <Panel className="mt" actions={<>
        <div className="ranges">
          <button className={view === 'groups' ? 'on' : ''} onClick={() => pick('groups')}>By budget group</button>
          <button className={view === 'accounts' ? 'on' : ''} onClick={() => pick('accounts')}>Through accounts</button>
        </div>
        <div className="ranges">
          <button className={sel === 'days=30' ? 'on' : ''} onClick={() => setSel('days=30')}>Last 30 days</button>
          <button className={sel === 'months=3' ? 'on' : ''} onClick={() => setSel('months=3')}>Last 3 months</button>
          {months.length > 0 && <span className={`rangestep${picked ? ' on' : ''}`}>
            <button aria-label="Earlier month" disabled={mi === 0} onClick={() => step(-1)}><Chevron dir="left" /></button>
            <button className="rangemonth" onClick={() => !picked && setSel(`month=${months.at(-1).month}`)}>{monthName(picked ?? months.at(-1).month)}</button>
            <button aria-label="Later month" disabled={!picked || mi === months.length - 1} onClick={() => step(1)}><Chevron /></button>
          </span>}
        </div>
      </>}>
        {!f && <Skeleton h={420} r={12} />}
        {f && (
          <>
            <div className="flowstats">
              <span>Income <b className="good">{usd2(f.income)}</b></span>
              <span>Spending <b>{usd2(f.spending)}</b></span>
              <span title="Income minus spending. Money moved into savings and investments isn't spending.">{net >= 0 ? 'Left after spending' : 'Spent beyond income'} <b className={net >= 0 ? 'good' : 'bad'}>{usd2(Math.abs(net))}</b></span>
              {f.moved > 0 && <span>Moved between your accounts <b className="muted">{usd2(f.moved)}</b></span>}
            </div>
            {view === 'groups'
              ? (f.income + f.spending > 0 ? <div className={`flowchart${f.sel !== sel ? ' stale' : ''}`} aria-busy={f.sel !== sel}><Sankey f={f} rename={rename} label={period} /></div> : <div className="empty">No income or spending in this period.</div>)
              : acc ? <div className="flowchart"><AccountFlow data={acc} rename={rename} /></div> : <Skeleton h={420} r={12} />}
            {view === 'accounts' && <p className="small muted foot">
              Transfers going both ways between two accounts are shown as the net amount. "Kept in accounts" and "From account balances"
              are the difference between what came into and went out of each account, such as paying off last month's card.</p>}
            {f.gaps?.length > 0 && (
              <div className="gapnote small">
                <b>Incomplete for {period}.</b> Some accounts have no history for the start of this period, so their income and spending before then is missing:
                <ul>{f.gaps.map((g) => <li key={g.account}>{g.account}: nothing before {day(g.first)}</li>)}</ul>
                Banks usually fill in older history within a day of connecting; if it doesn't appear, the bank doesn't provide it.
              </div>
            )}
            {f.income === 0 && f.spending > 0 && <p className="small muted foot">No income found. If your pay arrives as a transfer, mark it as income on the <a href="#/transactions">Transactions</a> page.</p>}
          </>
        )}
      </Panel>
      <MonthReplay month={sel.startsWith('month=') ? sel.slice(6) : undefined} />
    </>
  );
}
