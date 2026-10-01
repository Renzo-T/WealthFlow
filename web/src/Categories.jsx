import { usd, label, SPENDING, NEUTRAL } from './format.js';
import CategoryIcon from './CategoryIcon.jsx';
import { Panel, EmptyState, Hover, TipList } from './ui.jsx';
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long' });

// Change vs the same days of last month (null = too little to compare, or before the 5th). Spending going up is
// shown in red, down in green.
const Chg = ({ v }) => (v == null ? null : Math.abs(v) < 1 ? <span className="small muted">same</span>
  : <span className={`small ${v > 0 ? 'bad' : 'good'}`} title="vs the same days of last month">{v > 0 ? '↑' : '↓'} {Math.round(Math.abs(v))}%</span>);

export default function Categories({ c, changes = {} }) {
  return (
    <Panel title={<>Top spending{c.fallback && <span className="asof">{monthName(c.month)}</span>}</>}>
      {c.items.length === 0 && <EmptyState title="No spending yet">Spending by group shows here as transactions come in.</EmptyState>}
      {c.items.map((i) => (
        <div className="cat rowicon" key={i.category}>
          <CategoryIcon group={i.category === 'REST' ? null : i.category} kind={i.category === 'REST' ? 'dots' : undefined} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row base">
              <span><Hover className="quiet" tip={i.subs?.length > 1 || i.category === 'REST' ? <TipList title={label(i.category)} rows={i.subs.slice(0, 8).map((x) => [x.name, x.total < 0 ? `−${usd(-x.total)}` : usd(x.total)])}
                note={i.subs.length > 8 ? `and ${i.subs.length - 8} more` : null} /> : null}>{label(i.category)}</Hover> <span className="small muted">{Math.round(i.share)}%</span></span>
              <span className="btnrow"><Chg v={changes[i.category]} /><b className="tamt">{usd(i.total)}</b></span>
            </div>
            <div className="bar"><i style={{ width: `${i.share}%`, background: i.category === 'REST' ? NEUTRAL : SPENDING }} /></div>
          </div>
        </div>
      ))}
      {c.fallback && c.items.length > 0 && <p className="small muted foot">Nothing spent this month yet, so this is {monthName(c.month)}.</p>}
    </Panel>
  );
}
