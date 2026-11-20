import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { usd, INCOME, SERIES, NEUTRAL } from './format.js';
import AccountFlow from './AccountFlow.jsx';
import MonthReplay from './MonthReplay.jsx';
import Tip, { useTip } from './Tip.jsx';
import { Panel, PageHeader, Skeleton, askText, Chevron } from './ui.jsx';
import { duration, easeOut, reducedMotion } from './motion.js';

const VIEW_KEY = 'wealthflow.flowView';
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) || 'groups'; } catch { return 'groups'; } };

const W = 760, BAR = 8, LX = 190, RX = W - 190 - BAR, HW = 12, HX = W / 2 - HW / 2, GAP = 12, SLOT = 34, TOP = 34;
// Colour by role, never by rank: money in and money that stays yours (savings & investments, left over) are green,
// spending is the planner's indigo ink, debt payments are grey, refunds teal. Every bar is labelled, so colour never has
// to tell one group from another on its own. Figures here are totals, so they're whole dollars (format.js's rule).
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
// Whole dollars that still add up: each figure rounds down, then the ones that lost the most get the dollars back
// until the parts sum to the rounded total (so the ledger's parts and the hub never disagree by a dollar).
const whole = (vals) => {
  const out = vals.map((v) => Math.floor(v));
  let left = Math.round(vals.reduce((s, v) => s + v, 0)) - out.reduce((s, v) => s + v, 0);
  for (const [, i] of vals.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])) { if (left <= 0) break; out[i] += 1; left -= 1; }
  return out;
};
const withWhole = (nodes) => { const w = whole(nodes.map((x) => x.value)); return nodes.map((x, i) => ({ ...x, shown: w[i] })); };
const pctOf = (v, t) => { const p = (v / t) * 100; return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`; };
const lastDay = (to) => new Date(Date.parse(to + 'T00:00') - 864e5).toLocaleDateString('en-CA'); // `to` is exclusive

// Changing the period morphs the chart instead of redrawing it: each stream grows, shrinks or slides to its new size,
// a new one grows from nothing and a gone one shrinks away, so what changed is what moves. Nothing animates on arrival.
const GEO = ['y', 'hgt', 'hy', 'hh', 'mid'];
const lerp = (a, b, t) => a + (b - a) * t;
function useMorph(layout) {
  const [shown, setShown] = useState(layout);
  const cur = useRef(layout), raf = useRef(0);
  useEffect(() => {
    const from = cur.current;
    cancelAnimationFrame(raf.current);
    if (from === layout || reducedMotion()) { cur.current = layout; setShown(layout); return undefined; }
    const prev = new Map(from.nodes.filter((x) => !x.exiting).map((x) => [x.id, x]));
    const next = new Set(layout.nodes.map((x) => x.id));
    const pairs = [
      ...layout.nodes.map((x) => [prev.get(x.id) ?? { ...x, hgt: 0, hh: 0, entering: true }, x]),
      ...[...prev.values()].filter((x) => !next.has(x.id)).map((x) => [x, { ...x, hgt: 0, hh: 0, exiting: true }]),
    ];
    const t0 = performance.now(), span = duration('--t-arrive') || 1; // the app's timing and curve (motion.js)
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / span), e = easeOut(k);
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
  // Income-only: money that came from balances you already had isn't "your pay", so that source goes, and what's put
  // into savings or debt shrinks by the same amount (the full figure stays in the hover). "Through accounts" shows the rest.
  let cats = f.categories;
  if (f.sources.some((s) => s.saved)) {
    const gone = f.sources.filter((s) => s.saved).reduce((s, x) => s + x.value, 0);
    let over = gone;
    const isSave = (c) => /Savings|Debt/.test(c.name);
    const trimmed = new Map();
    for (const c of [...cats.filter(isSave), ...cats.filter((c) => !isSave(c) && !c.saved)]) {
      const cut = Math.min(over, c.value - (c.fromPay ?? 0)); // what came straight from pay stays
      if (cut > 0) { trimmed.set(c, cut); over -= cut; }
    }
    cats = cats.map((c) => (trimmed.has(c) ? { ...c, value: c.value - trimmed.get(c), full: c.value } : c)).filter((c) => c.value > 0.005);
  }
  const left = withWhole(f.sources.filter((s) => !s.saved).map((s) => ({ ...s, color: s.credit ? TEAL : GREEN })));
  const total = left.reduce((s, x) => s + x.value, 0);
  const role = (c) => (c.saved || /Savings/.test(c.name) ? GREEN : /Debt/.test(c.name) ? NEUTRAL : INK);
  const big = cats.filter((c) => c.saved || /Savings|Debt/.test(c.name) || c.value >= total * SMALL);
  const small = cats.filter((c) => !big.includes(c));
  const rest = small.length > 1 ? [{ name: 'Everything else', value: small.reduce((s, c) => s + c.value, 0), rest: small }] : small;
  const spend = [...big.filter((c) => !c.saved && role(c) === INK), ...rest];
  const right = withWhole([...spend, ...big.filter((c) => !spend.includes(c))].map((c) => ({ ...c, color: c.rest ? NEUTRAL : role(c), spending: !!c.rest || (!c.saved && role(c) === INK) })));
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

function Sankey({ f, layout, rename, label }) {
  const [hl, setHl] = useState(null); // 'l:<name>' or 'r:<name>'
  const [tip, show, hide] = useTip();
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
        <b>{x.name}</b><div>{usd(x.shown)}</div>
        <div className="muted">{x.pay ? 'Taken from your paycheck before it was deposited (may include an employer match)' : x.saved ? "Money you already had: spent or put into savings beyond this period's income" : x.credit ? "Refunds beyond what was spent in their group this period: money in, but not income" : `${pctOf(x.value, income)} of income`}</div>
        {x.parts?.length > 0 && <ul>{x.parts.map((p) => <li key={p.name}><span>{p.name}</span><span>{usd(p.value)}</span></li>)}</ul>}
      </> : <>
        <b>{x.name}</b><div>{usd(x.shown)} <span className="muted">· {pctOf(x.value, income)} of income</span></div>
        {x.fromPay > 0 && <div className="muted">{usd(x.fromPay)} of it straight from your pay</div>}
        {x.full && <div className="muted">{usd(x.full)} in all; the rest came from balances you already had</div>}
        {x.rest && <ul>{x.rest.map((s) => <li key={s.name}><span>{s.name}</span><span>{usd(s.value)}</span></li>)}</ul>}
        {x.subs?.length > 0 && <ul>{x.subs.map((s) => <li key={s.name}><span>{s.name}</span><span>{usd(s.value)}</span></li>)}</ul>}
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
          <text x={LX - 8} y={x.mid + 11} textAnchor="end">{usd(x.shown)}</text>
        </g>
      ))}
      {R.map((x) => (
        <g key={'rn' + x.name} style={fade(x)}>
          <rect x={RX} y={x.y} width={BAR} height={x.hgt} rx={Math.min(BAR / 2, x.hgt / 2)} fill={x.color} {...on('r', x)} />
          <text x={RX + BAR + 8} y={x.mid - 2} className="fl" {...on('r', x)}>{short(x.name)}</text>
          <text x={RX + BAR + 8} y={x.mid + 11}>{usd(x.shown)} · {pctOf(x.value, total)}</text>
        </g>
      ))}
    </svg>
    <Tip tip={tip} />
    </>
  );
}

// The period as a two-line ledger that adds up to the chart's hub: what came in (income, money taken from your pay before
// it was deposited, refunds beyond their group's spending) and where it went (spending, then each thing that stayed
// yours). Both lines total the hub's "in" figure, in the same whole dollars as the chart's labels.
function Ledger({ f, layout }) {
  const L = layout.nodes.filter((x) => x.side === 'l'), R = layout.nodes.filter((x) => x.side === 'r');
  const sum = (xs) => xs.reduce((s, x) => s + x.shown, 0);
  const total = sum(L);
  const into = [
    ['Income', sum(L.filter((x) => !x.pay && !x.credit)), 'Take-home pay and other income that reached your accounts.'],
    ['From your pay', sum(L.filter((x) => x.pay)), "Taken from your paycheck into a 401(k) or similar before the rest was deposited, so it isn't in Income."],
    ['Refunds', sum(L.filter((x) => x.credit)), 'Refunds beyond what was spent in their own group this period: money in, but not income.'],
  ].filter(([, v]) => v > 0);
  const out = [
    ['Spending', sum(R.filter((x) => x.spending)), 'Refunds lower spending in their own group, never below zero.'],
    ...R.filter((x) => !x.spending).map((x) => [x.name, x.shown, x.full ? `${usd(x.full)} in all; the rest came from balances you already had.` : undefined]),
  ].filter(([, v]) => v > 0);
  const income = into.find(([k]) => k === 'Income')?.[1] ?? 0, spent = out.find(([k]) => k === 'Spending')?.[1] ?? 0, net = income - spent;
  const row = (tag, parts, cls) => (
    <div className="flrow">
      <span className="fltag">{tag}</span>
      <span className="flparts">{parts.map(([k, v, why], i) => <span key={k} className="flpart" title={why}>{i > 0 && <i aria-hidden="true">+</i>}{k} <b className={`amt ${cls(k)}`}>{usd(v)}</b></span>)}</span>
      <span className="fltotal"><i aria-hidden="true">=</i> <b className="amt">{usd(total)}</b></span>
    </div>
  );
  return (
    <div className="flowledger">
      {row('In', into, () => 'good')}
      {row('Out', out, (k) => (k === 'Spending' ? '' : /Savings|Left over/.test(k) ? 'good' : ''))}
      <p className="flnote">
        {income > 0 && <span title="Income minus spending. Money moved into savings and investments isn't spending.">{net >= 0 ? 'Left after spending' : 'Spent beyond income'} <b className={`amt ${net >= 0 ? 'good' : 'bad'}`}>{usd(Math.abs(net))}</b>.</span>}
        {f.moved > 0 && <span> Moved between your accounts <b className="amt">{usd(f.moved)}</b>, not counted above.</span>}
      </p>
    </div>
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
  const layout = useMemo(() => (f && f.income + f.spending > 0 ? layoutOf(f) : null), [f]);
  const day = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const period = f ? `${day(f.from)} – ${day(new Date(Date.parse(f.to + 'T00:00') - 864e5).toLocaleDateString('en-CA'))}` : '';
  return (
    <>
      <PageHeader title="Money flow" />
      <Panel className="mt" actions={<>
        <div className="ranges">
          <button className={view === 'groups' ? 'on' : ''} onClick={() => pick('groups')} title="Your income and where it went, by budget group. Transfers between your accounts are left out.">Your pay</button>
          <button className={view === 'accounts' ? 'on' : ''} onClick={() => pick('accounts')} title='How money moved from income, through your accounts, to spending and savings. Transfers both ways between two accounts show as the net amount; "Kept in accounts" and "From account balances" are the difference between what came into and went out of each account, such as paying off last month&apos;s card.'>Through accounts</button>
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
            {layout && view === 'groups' && <Ledger f={f} layout={layout} />}
            {view === 'groups'
              ? (layout ? <div className={`flowchart${f.sel !== sel ? ' stale' : ''}`} aria-busy={f.sel !== sel}><Sankey f={f} layout={layout} rename={rename} label={period} /></div> : <div className="empty">No income or spending in this period.</div>)
              : acc ? <div className="flowchart"><AccountFlow data={acc} rename={rename} /></div> : <Skeleton h={420} r={12} />}
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
