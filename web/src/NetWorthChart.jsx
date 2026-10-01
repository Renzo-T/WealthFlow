import { usdCompact } from './format.js';
import { useState } from 'react';
import { usd } from './Cards.jsx';
import useWidth from './useWidth.js';
import { Panel } from './ui.jsx';

// Drawn at its real width (useWidth), so text stays the same size at any window size.
const H = 230, L = 58, R = 14, T = 12, B = 26;
const RANGES = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, All: 1e9 };
const compact = { format: (n) => usdCompact(n, 1) };
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
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(data.length - 1)},${H - B} L${L},${H - B} Z`;
    // Split into runs of estimated vs. real days; neighbouring runs share their boundary point so the line is unbroken.
    const runs = [];
    data.forEach((d, i) => {
      const last = runs.at(-1);
      if (last && last.est === !!d.est) last.to = i; else runs.push({ est: !!d.est, from: Math.max(0, i - 1), to: i });
    });
    const path = (r) => data.slice(r.from, r.to + 1).map((d, k) => `${k ? 'L' : 'M'}${x(r.from + k).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
    const h = hover == null ? null : data[hover];
    const move = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const i = Math.round((((e.clientX - r.left) / r.width) * W - L) / ((W - L - R) / (data.length - 1)));
      setHover(Math.max(0, Math.min(data.length - 1, i)));
    };
    body = (
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="nw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--blue)' }} stopOpacity=".18" /><stop offset="1" style={{ stopColor: 'var(--blue)' }} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((k) => { const v = lo + ((hi - lo) * k) / 4; return <g key={k}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{compact.format(v)}</text></g>; })}
        {[0, 1, 2, 3, 4, 5].map((k) => { const i = Math.round((k * (data.length - 1)) / 5); return <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 5 ? 'end' : 'middle'}>{day(data[i].date)}</text>; })}
        <path d={area} fill="url(#nw)" opacity={hasEst ? 0.5 : 1} />
        {runs.map((r, k) => <path key={k} d={path(r)} fill="none" style={{ stroke: 'var(--blue)' }} strokeLinejoin="round"
          strokeWidth={r.est ? 1.75 : 2.5} strokeDasharray={r.est ? '5 4' : undefined} opacity={r.est ? 0.55 : 1} />)}
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
      {hasEst && <span className="legend"><span><i className="lkey" />Actual</span><span><i className="lkey dash" />Estimated</span></span>}
      <div className="ranges">{Object.keys(RANGES).map((r) => <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>
    </>}>
      <div ref={ref} />
      {body}
      {hasEst && <p className="small muted foot">Dashed = estimated: bank and card balances rewound from transactions, investments held at today's value (Plaid doesn't provide their history). Each day WealthFlow syncs adds a real point.</p>}
    </Panel>
  );
}
