import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, INCOME, SERIES, NEUTRAL } from './format.js';
import AccountFlow from './AccountFlow.jsx';
import MonthReplay from './MonthReplay.jsx';
import Tip, { useTip } from './Tip.jsx';
import { Panel, PageHeader, Skeleton } from './ui.jsx';

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
// Both sides add up to the same total: "From savings" or "Saved" balances them.
// Shares under 1% say "<1%" rather than a misleading 0%.
const pctOf = (v, t) => { const p = (v / t) * 100; return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`; };
const lastDay = (to) => new Date(Date.parse(to + 'T00:00') - 864e5).toLocaleDateString('en-CA'); // `to` is exclusive

function Sankey({ f, rename }) {
  const [hl, setHl] = useState(null); // 'l:<name>' or 'r:<name>'
  const [tip, show, hide] = useTip();
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
  const stack = (nodes) => {
    let y = TOP + (body - slots(nodes)) / 2, h = hubTop;
    return nodes.map((x) => {
      const hgt = Math.max(2, x.value * k), slot = Math.max(SLOT, hgt);
      const r = { ...x, y, hgt, hy: h, hh: x.value * k, mid: y + slot / 2 };
      y += slot + GAP; h += r.hh;
      return r;
    });
  };
  const L = stack(left), R = stack(right);
  const op = (id) => (hl == null ? 0.3 : hl === id ? 0.62 : 0.07);
  const income = f.income || total;
  // Hover a band, bar or label: highlight it and explain it. Spending groups open their transactions on click.
  const on = (side, x) => ({
    onMouseMove: (e) => {
      setHl(`${side}:${x.name}`);
      show(e, side === 'l' ? <>
        <b>{x.name}</b><div>{usd2(x.value)}</div>
        <div className="muted">{x.saved ? 'Spent beyond income this period' : x.credit ? 'Refunds and cash back' : `${pctOf(x.value, income)} of income`}</div>
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
    <svg className="chart sankey" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where your money came from and where it went">
      {/* The streams draw in once, left to right (the flow itself is the motion); reduced-motion shows them at once. */}
      <defs><clipPath id="sankey-draw"><rect className="sankey-draw" x="0" y="0" width={W} height={H} /></clipPath></defs>
      <g clipPath="url(#sankey-draw)">
        {L.map((x) => <path key={'l' + x.name} className="ribbon" d={band(LX + BAR, x.y, x.y + x.hgt, HX, x.hy, x.hy + x.hh)} fill={x.color} opacity={op(`l:${x.name}`)} {...on('l', x)} />)}
        {R.map((x) => <path key={'r' + x.name} className="ribbon" d={band(HX + HW, x.hy, x.hy + x.hh, RX, x.y, x.y + x.hgt)} fill={x.color} opacity={op(`r:${x.name}`)} {...on('r', x)} />)}
      </g>
      <rect x={HX} y={hubTop} width={HW} height={hub} rx={HW / 2} style={{ fill: 'var(--ink-dot)' }} />
      <text x={W / 2} y={hubTop - 18} textAnchor="middle" className="fl hubname">{f.label ?? 'This period'}</text>
      <text x={W / 2} y={hubTop - 5} textAnchor="middle" className="amtsvg">{usd(total)} in</text>
      {L.map((x) => (
        <g key={'ln' + x.name}>
          <rect x={LX} y={x.y} width={BAR} height={x.hgt} rx={Math.min(BAR / 2, x.hgt / 2)} fill={x.color} {...on('l', x)} />
          <text x={LX - 8} y={x.mid - 2} textAnchor="end" className={`fl${x.key ? ' click' : ''}`}
            onClick={x.key ? () => rename(x.key, x.name) : undefined}><title>{x.key ? 'Click to rename' : x.name}</title>{short(x.name)}</text>
          <text x={LX - 8} y={x.mid + 11} textAnchor="end">{usd2(x.value)}</text>
        </g>
      ))}
      {R.map((x) => (
        <g key={'rn' + x.name}>
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
  useEffect(() => { setF(null); api(`/flow?${sel}`).then(setF); }, [sel, tick]);
  useEffect(() => { setAcc(null); if (view === 'accounts') api(`/flow?${sel}&view=accounts`).then(setAcc); }, [sel, view, tick]);
  const pick = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ } };
  const rename = async (key, name) => {
    const label = window.prompt('Name for this income source (leave empty to reset):', name);
    if (label === null) return;
    await api('/income-names', { method: 'PUT', body: JSON.stringify({ key, label }) });
    setTick((t) => t + 1);
  };

  const net = f ? f.income - f.spending : 0;
  const day = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const period = f ? `${day(f.from)} – ${day(new Date(Date.parse(f.to + 'T00:00') - 864e5).toLocaleDateString('en-CA'))}` : '';
  return (
    <>
      <PageHeader title="Money flow" sub={view === 'groups'
        ? 'Where your money came from and where it went, grouped like your budget. Transfers between your own accounts are left out.'
        : 'How money moved: where income landed and which of your accounts it passed through. Hover a band for the amount; switch to By budget group to see what the spending was.'} />
      <Panel className="mt" actions={<>
        <div className="ranges">
          <button className={view === 'groups' ? 'on' : ''} onClick={() => pick('groups')}>By budget group</button>
          <button className={view === 'accounts' ? 'on' : ''} onClick={() => pick('accounts')}>Through accounts</button>
        </div>
        <div className="ranges">
          <button className={sel === 'days=30' ? 'on' : ''} onClick={() => setSel('days=30')}>Last 30 days</button>
          <button className={sel === 'months=3' ? 'on' : ''} onClick={() => setSel('months=3')}>Last 3 months</button>
          {months.map((m) => (
            <button key={m.month} className={sel === `month=${m.month}` ? 'on' : ''} onClick={() => setSel(`month=${m.month}`)}>{monthName(m.month)}</button>
          ))}
        </div>
      </>}>
        {!f && <Skeleton h={420} r={12} />}
        {f && (
          <>
            <div className="flowstats">
              <span>Income <b className="good">{usd2(f.income)}</b></span>
              <span>Spending <b>{usd2(f.spending)}</b></span>
              <span>{net >= 0 ? 'Saved' : 'Overspent'} <b className={net >= 0 ? 'good' : 'bad'}>{usd2(Math.abs(net))}</b></span>
              {f.moved > 0 && <span>Moved between your accounts <b className="muted">{usd2(f.moved)}</b></span>}
            </div>
            {view === 'groups'
              ? (f.income + f.spending > 0 ? <div className="flowchart"><Sankey key={sel} f={{ ...f, label: period }} rename={rename} /></div> : <div className="empty">No income or spending in this period.</div>)
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
