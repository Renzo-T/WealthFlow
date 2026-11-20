import { usdCompact, niceTicks } from './format.js';
import { useState } from 'react';
import { usd } from './Cards.jsx';
import useWidth from './useWidth.js';

// Drawn at its real width (useWidth), like the other charts, so text stays the same size.
const H = 270, L = 62, T = 12, B = 26;
const compact = { format: (n) => usdCompact(n, 1) };
// One range, one hue: the expected line is solid indigo; optimistic and conservative are the band's dashed edges,
// each named at its right end, so there is no legend.

export function ProjectionChart({ series, years, target = null, real = true }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth(720);
  const R = W >= 560 ? 150 : 14, labelled = R > 14;
  const all = series.flatMap((s) => s.values);
  let top = Math.max(...all);
  // The target rule is drawn only when it is within reach of the lines (up to a quarter above the top one);
  // a target far out of range would flatten the scenarios, and the table says "not within N years" for it.
  const showTarget = target > Math.min(0, ...all) && target <= top * 1.25;
  if (showTarget) top = Math.max(top, target);
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...all), top, 5);
  const x = (i) => L + (i * (W - L - R)) / years;
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const [cons, mid, opt] = series;
  // End-of-line labels, nudged apart so they never overlap.
  const ends = [...series].reverse().map((s) => ({ s, y: y(s.values.at(-1)) }));
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);
  const lastLow = ends.at(-1).y - (H - B - 4); if (lastLow > 0) ends.forEach((e) => { e.y -= lastLow; });
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
    <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)} role="img" aria-label={`Net worth projection in ${real ? "today's" : 'future'} dollars`}>
      {ticks.map((v) => { return <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{compact.format(v)}</text></g>; })}
      {labels.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === years ? 'end' : 'middle'}>{i === 0 ? 'Now' : `${i}y`}</text>)}
      {showTarget && <g className="tgt">
        <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} />
        <text x={W - R} y={y(target) - 5} textAnchor="end">Target {compact.format(target)}</text>
      </g>}
      <g className="draw">
        <path className="band" d={band} />
        {[cons, opt].map((s) => <path key={s.key} className="edge" d={path(s.values)} />)}
        <path className="mid" d={path(mid.values)} />
        {labelled && ends.map(({ s, y: ly }) => <text key={s.key} className={`endlab${s.key === 'expected' ? ' mid' : ''}`} x={W - R + 8} y={ly + 4}>{s.label} {s.rate}% · {compact.format(s.values.at(-1))}</text>)}
      </g>
      {hover != null && <g>
        <line className="grid" x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} />
        {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={s.key === 'expected' ? 4.5 : 3.5} style={{ fill: s.key === 'expected' ? 'var(--blue)' : 'var(--card)', stroke: 'var(--blue)' }} strokeWidth="2" />)}
        <g transform={`translate(${bx},${T})`}>
          <rect width="190" height="76" rx="7" style={{ fill: 'var(--card)', stroke: 'var(--line)' }} />
          <text x="10" y="16">{hover === 0 ? 'Today' : `In ${hover} years`}</text>
          {[...series].reverse().map((s, k) => (
            <g key={s.key}><circle cx="14" cy={33 + k * 15} r="3.5" style={{ fill: s.key === 'expected' ? 'var(--blue)' : 'var(--card)', stroke: 'var(--blue)' }} strokeWidth="2" /><text x="24" y={37 + k * 15}>{s.label}</text>
              <text x="180" y={37 + k * 15} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{hover === 0 ? usd(s.values[hover]) : compact.format(s.values[hover])}</text></g>
          ))}
        </g>
      </g>}
    </svg>
    </>
  );
}
