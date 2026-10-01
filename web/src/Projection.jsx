import { usdCompact } from './format.js';
import { useState } from 'react';
import { usd } from './Cards.jsx';
import { useAssumptions, buildSeries } from './projection.js';
import { Panel } from './ui.jsx';
import useWidth from './useWidth.js';

// Drawn at its real width (useWidth), like the other charts, so text stays the same size.
const H = 270, L = 62, R = 14, T = 12, B = 26;
const compact = { format: (n) => usdCompact(n, 1) };

export function Legend({ series }) {
  return <div className="legend">{[...series].reverse().map((s) => <span key={s.key}><i className="dot" style={{ background: s.color }} />{s.label} ({s.rate}%)</span>)}</div>;
}

export function ProjectionChart({ series, years }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth(720);
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  let hi = Math.max(...all);
  hi = hi === lo ? lo + 1 : hi + (hi - lo) * 0.05;
  const x = (i) => L + (i * (W - L - R)) / years;
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const [cons, , opt] = series;
  const band = `${path(opt.values)} ${cons.values.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ')} Z`;
  const step = years <= 10 ? 2 : years <= 30 ? 5 : 10;
  const labels = []; for (let i = 0; i <= years; i += step) labels.push(i);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * years);
    setHover(Math.max(0, Math.min(years, i)));
  };
  const bx = hover == null ? 0 : Math.min(Math.max(x(hover) - 95, L), W - R - 190);
  return (
    <>
    <div ref={ref} />
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label="Net worth projection">
      {[0, 1, 2, 3, 4].map((k) => { const v = lo + ((hi - lo) * k) / 4; return <g key={k}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{compact.format(v)}</text></g>; })}
      {labels.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === years ? 'end' : 'middle'}>{i === 0 ? 'Now' : `${i}y`}</text>)}
      <path d={band} style={{ fill: 'var(--blue)' }} opacity=".08" />
      {series.map((s) => <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />)}
      {hover != null && <g>
        <line className="grid" x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} />
        {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={s.color} style={{ stroke: 'var(--card)' }} strokeWidth="2" />)}
        <g transform={`translate(${bx},${T})`}>
          <rect width="190" height="76" rx="7" style={{ fill: 'var(--card)', stroke: 'var(--line)' }} />
          <text x="10" y="16">{hover === 0 ? 'Today' : `In ${hover} years`}</text>
          {[...series].reverse().map((s, k) => (
            <g key={s.key}><circle cx="14" cy={33 + k * 15} r="4" fill={s.color} /><text x="24" y={37 + k * 15}>{s.label}</text>
              <text x="180" y={37 + k * 15} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{usd(s.values[hover])}</text></g>
          ))}
        </g>
      </g>}
    </svg>
    </>
  );
}

export function ProjectionPanel({ s, cashflow, wide }) {
  const [a] = useAssumptions();
  const { series, monthly, avg, years } = buildSeries(a, s.netWorth.value, cashflow);
  return (
    <Panel className={wide ? 'wide' : ''} title="Net worth projection" actions={<><Legend series={series} /><a href="#/forecast">Adjust</a></>}>
      <ProjectionChart series={series} years={years} />
      <p className="small muted foot amt">
        Adds {usd(monthly)} a month{a.monthly !== '' ? '' : avg == null ? ' (no full month of data from every bank yet)' : ` (your recent average is ${usd(avg)})`}. A projection, not a prediction.
      </p>
    </Panel>
  );
}
