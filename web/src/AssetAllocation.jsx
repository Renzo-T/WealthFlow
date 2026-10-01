import { usd } from './Cards.jsx';
import { allocColor } from './format.js';
import { Panel } from './ui.jsx';

const R = 54, C = 2 * Math.PI * R;

export default function AssetAllocation({ a }) {
  let offset = 0;
  return (
    <Panel title="Asset allocation">
      {a.items.length === 0 ? <p className="small muted">Link an account with a positive balance to see your allocation.</p> : <>
        <div className="donut">
          <svg className="donutsvg" viewBox="0 0 140 140" role="img" aria-label="Asset allocation by account type">
            <circle cx="70" cy="70" r={R} fill="none" style={{ stroke: 'var(--soft)' }} strokeWidth="16" />
            {a.items.map((i) => {
              const len = (C * i.share) / 100;
              const el = <circle key={i.name} cx="70" cy="70" r={R} fill="none" stroke={allocColor(i.name)} strokeWidth="16"
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
              offset += len;
              return el;
            })}
            <text x="70" y="68" textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: 'var(--ink)' }}>{usd(a.total)}</text>
            <text x="70" y="84" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--muted)' }}>Total assets</text>
          </svg>
          <ul className="legend2">
            {a.items.map((i) => (
              <li key={i.name}><span><i className="dot" style={{ background: allocColor(i.name) }} />{i.name}</span><b>{i.share.toFixed(1)}%</b></li>
            ))}
          </ul>
        </div>
        <p className="small muted foot">By what you own, not which account it's in. IRAs holding ETFs count as ETFs; "Employer plan funds" are the funds only offered inside workplace plans. Bank accounts count as cash. For retirement vs. taxable, see <a href="#/investments">Investments</a>.</p>
      </>}
    </Panel>
  );
}
