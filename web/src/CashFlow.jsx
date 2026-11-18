import { useState } from 'react';
import { usdCompact, niceTicks } from './format.js';
import { INCOME, SPENDING } from './format.js';

import useWidth from './useWidth.js';
import { Panel } from './ui.jsx';
import Tip, { useTip } from './Tip.jsx';
import { usd } from './format.js';

// Drawn at its real width (useWidth), so text stays the same size at any window size.
const H = 200, L = 52, T = 8, B = 24;

export default function CashFlow({ data }) {
  const [ref, W] = useWidth(520);
  const top = Math.max(...data.flatMap((d) => [d.income, d.spending]), 1);
  const { ticks, hi: max } = niceTicks(0, top, 4);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const gw = (W - L) / data.length, bw = gw * 0.26;
  const [tip, show, hide] = useTip();
  const [on, setOn] = useState(null);
  const monthLabel = (m) => new Date(m + '-01T00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <Panel title="Cash flow" actions={<div className="legend"><span><i className="dot" style={{ background: INCOME }} />Income</span><span><i className="dot" style={{ background: SPENDING }} />Spending</span></div>}>
      <div ref={ref} />
      <div className="flowchart">
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income and spending by month" onMouseLeave={() => { hide(); setOn(null); }}>
        {ticks.map((v) => { return <g key={v}><line className="grid" x1={L} x2={W} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{usdCompact(v, 1)}</text></g>; })}
        {data.map((d, i) => {
          const x0 = L + i * gw + gw / 2;
          return (
            <g key={d.month} opacity={(d.partial ? 0.4 : 1) * (on == null || on === i ? 1 : 0.55)}>
              <rect className="cf-bar cf-in" style={{ '--i': i }} x={x0 - bw - 1} y={y(d.income)} width={bw} height={H - B - y(d.income)} rx="3" fill={INCOME} />
              <rect className="cf-bar cf-out" style={{ '--i': i }} x={x0 + 1} y={y(d.spending)} width={bw} height={H - B - y(d.spending)} rx="3" fill={SPENDING} />
              <text x={x0} y={H - 7} textAnchor="middle">{new Date(d.month + '-01T00:00').toLocaleDateString('en-US', { month: 'short' })}</text>
              <rect x={L + i * gw} y={T} width={gw} height={H - T} fill="transparent" onMouseMove={(e) => { setOn(i); show(e, <>
                <b>{monthLabel(d.month)}</b>
                <ul><li><span>Income</span><b className="amt">{usd(d.income)}</b></li><li><span>Spending</span><b className="amt">{usd(d.spending)}</b></li>
                  <li><span>Net</span><b className={`amt ${d.income - d.spending >= 0 ? 'good' : 'bad'}`}>{d.income - d.spending >= 0 ? '+' : '−'}{usd(Math.abs(d.income - d.spending))}</b></li></ul>
                {d.partial && <div className="muted">Missing history from at least one bank.</div>}</>); }} />
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
      </div>
      {data.some((d) => d.partial && (d.income || d.spending)) && <p className="small muted foot">Faded months are missing history from at least one bank.</p>}
    </Panel>
  );
}
