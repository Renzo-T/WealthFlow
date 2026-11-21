import { usdCompact, niceTicks } from './format.js';
import { useState } from 'react';
import { usd } from './Cards.jsx';
import useWidth from './useWidth.js';
import { Panel, Hover } from './ui.jsx';
import { estRuns } from './estRuns.js';

// Drawn at its real width (useWidth), so text stays the same size at any window size.
const H = 230, L = 58, R = 14, T = 12, B = 26;
const RANGES = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, All: 1e9 };
const day = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Starts on the range that's mostly real data: until daily snapshots build up, a long range is mostly guesswork.
const defaultRange = (history) => { const real = history.filter((d) => !d.est).length; return real >= 180 ? '1Y' : real >= 60 ? '6M' : '3M'; };

export default function NetWorthChart({ history }) {
  const [range, setRange] = useState(() => defaultRange(history));
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth(720);
  const data = history.slice(-(RANGES[range] + 1));
  const hasEst = data.some((d) => d.est);

  let body = <div className="empty">History builds up each day you refresh. Connect accounts with transactions to see estimated history right away.</div>;
  if (data.length > 1) {
    const vals = data.map((d) => d.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    // The axis always spans at least 4% of net worth, so a 0.3% wobble reads as the small move it is.
    const minSpan = Math.max(Math.abs(hi), Math.abs(lo)) * 0.04 || 2;
    if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const pad = (hi - lo) * 0.08;
    const nice = niceTicks(lo - pad, hi + pad, 5); lo = nice.lo; hi = nice.hi;
    const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const { real, runs } = estRuns(data.map((d) => d.est));
    const vs = data.map((d, i) => (d.est && real[i] ? (data[i - 1].value + data[i + 1].value) / 2 : d.value));
    const path = (r) => vs.slice(r.from, r.to + 1).map((v, k) => `${k ? 'L' : 'M'}${x(r.from + k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const h = hover == null ? null : data[hover];
    const move = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const i = Math.round((((e.clientX - r.left) / r.width) * W - L) / ((W - L - R) / (data.length - 1)));
      setHover(Math.max(0, Math.min(data.length - 1, i)));
    };
    body = (
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        {nice.ticks.map((v) => { return <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{usdCompact(v, 1)}</text></g>; })}
        {[0, 1, 2, 3, 4, 5].map((k) => { const i = Math.round((k * (data.length - 1)) / 5); return <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 5 ? 'end' : 'middle'}>{day(data[i].date)}</text>; })}
        <defs>
          <linearGradient id="nw-fade" gradientUnits="userSpaceOnUse" x1="0" y1={T} x2="0" y2={H - B}><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
          <mask id="nw-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect x="0" y="0" width={W} height={H} fill="url(#nw-fade)" /></mask>
        </defs>
        <g className="draw" key={range}>
          <g mask="url(#nw-mask)">
            {runs.filter((r) => !r.est).map((r, k) => <path key={k} className="nw-wash" d={`${path(r)} L${x(r.to).toFixed(1)},${H - B} L${x(r.from).toFixed(1)},${H - B} Z`} style={{ fill: 'var(--blue)' }} stroke="none" />)}
          </g>
          {runs.map((r, k) => <path key={k} d={path(r)} fill="none" style={{ stroke: 'var(--blue)' }} strokeLinejoin="round" strokeLinecap="round"
            strokeWidth={r.est ? 1.75 : 2.75} strokeDasharray={r.est ? '5 4' : undefined} opacity={r.est ? 0.55 : 1} />)}
          <g className="nw-end">
            <circle className="nw-halo" cx={x(data.length - 1)} cy={y(data.at(-1).value)} r="12" style={{ fill: 'var(--blue)' }} />
            <circle cx={x(data.length - 1)} cy={y(data.at(-1).value)} r="5" strokeWidth="2.5" style={{ fill: 'var(--card)', stroke: 'var(--blue)' }} />
          </g>
        </g>
        {h && <g>
          <line className="grid" x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} />
          <circle cx={x(hover)} cy={y(h.value)} r="5" style={{ fill: 'var(--blue)', stroke: 'var(--card)' }} strokeWidth="2" />
          <g transform={`translate(${Math.min(Math.max(x(hover) - 55, L), W - R - 110)},${T})`}>
            <rect width="110" height="38" rx="7" style={{ fill: 'var(--card)', stroke: 'var(--line)' }} />
            <text x="8" y="15">{day(h.date)}{h.est ? ' (est.)' : ''}</text>
            <text x="8" y="31" style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 13 }}>{usd(h.value)}</text>
          </g>
        </g>}
      </svg>
    );
  }

  return (
    <Panel title="Net worth overview" actions={<>
      {hasEst && <span className="legend"><span><i className="lkey" />Actual</span><Hover className="quiet" tip="Dashed = estimated: balances rewound from transactions, investments held at today's value. Each sync adds a real point."><span><i className="lkey dash" />est</span></Hover></span>}
      <div className="ranges">{Object.keys(RANGES).map((r) => <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>
    </>}>
      <div ref={ref} />
      {body}
    </Panel>
  );
}
