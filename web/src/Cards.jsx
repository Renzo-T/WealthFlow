import { INCOME, SPENDING, usd } from './format.js';
import { Hover, TipList } from './ui.jsx';

export { usd } from './format.js'; // older imports get it from here

// Month comparisons use the same number of days of last month (explained on hover; the label stays short).
function Delta({ v, upIsGood = true, unit = '%', vs = 'vs. last month', hint = 'Compared with the same number of days of last month', none = 'No prior data yet' }) {
  if (v == null) return <span className="small muted">{none}</span>;
  const good = v >= 0 === upIsGood;
  return (
    <span className="small">
      <span className={good ? 'good' : 'bad'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}{unit}</span>
      <br /><span className="muted" title={hint}>{vs}</span>
    </span>
  );
}

function Line({ data, color }) {
  if (data.length < 2) return <svg className="spark" />;
  const lo = Math.min(...data), span = Math.max(...data) - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 120},${40 - ((v - lo) / span) * 36}`).join(' ');
  return <svg className="spark" viewBox="0 0 120 44"><polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function Bars({ data, color }) {
  const max = Math.max(...data, 1);
  return (
    <svg className="spark" viewBox="0 0 120 44">
      {data.map((v, i) => { const h = Math.max((v / max) * 40, 2); return <rect key={i} x={i * 15 + 2} y={42 - h} width="10" height={h} rx="2" fill={color} opacity={0.35 + (i / data.length) * 0.65} />; })}
    </svg>
  );
}

function Ring({ pct }) {
  const c = 2 * Math.PI * 26, p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg className="ring" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="26" fill="none" style={{ stroke: 'var(--soft)' }} strokeWidth="6" />
      <circle cx="32" cy="32" r="26" fill="none" style={{ stroke: 'var(--blue)' }} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--ink)' }}>{pct == null ? '—' : `${Math.round(pct)}%`}</text>
    </svg>
  );
}

const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long' });

// This month so far vs the same days of last month, and all of last month.
const monthTip = (s, x, what) => <TipList title={what} rows={[
  ['This month so far', usd(x.value)],
  [`${monthName(s.prevMonth).slice(0, 3)} 1${s.day > 1 ? `–${s.day}` : ''} (same days)`, usd(x.prev)],
  [`All of ${monthName(s.prevMonth)}`, usd(x.lastMonth)],
]} note={s.early ? 'The % comparison starts on the 5th, when there are enough days to compare.' : 'The % compares the same number of days.'} />;

export default function Cards({ s }) {
  return (
    <div className="cards">
      <div className="card">
        <div className="row"><h3>Total net worth</h3><span className="chip" style={{ background: 'var(--soft)', color: 'var(--blue)' }}>↗</span></div>
        <div className="big">{s.netWorth.ago == null ? usd(s.netWorth.value)
          : <Hover className="quiet" tip={<TipList title="Net worth" rows={[['30 days ago', usd(s.netWorth.ago)], ['Today', usd(s.netWorth.value)],
            ['Change', `${s.netWorth.value >= s.netWorth.ago ? '+' : '−'}${usd(Math.abs(s.netWorth.value - s.netWorth.ago))}`]]} />}>{usd(s.netWorth.value)}</Hover>}</div>
        <div className="row"><Delta v={s.netWorth.change} vs="vs. 30 days ago" hint="Net worth now compared with 30 days ago" /><Line data={s.netWorth.spark} color="var(--blue)" /></div>
      </div>
      <div className="card">
        <div className="row"><h3>Income this month</h3><span className="chip" style={{ background: `${INCOME}22`, color: INCOME }}>↓</span></div>
        <div className="big"><Hover className="quiet" tip={monthTip(s, s.income, 'Income')}>{usd(s.income.value)}</Hover></div>
        <div className="row"><Delta none={s.early ? 'Compared from the 5th' : undefined} v={s.income.change} /><Bars data={s.income.bars} color={INCOME} /></div>
      </div>
      <div className="card">
        <div className="row"><h3>Spending this month</h3><span className="chip" style={{ background: `${SPENDING}22`, color: SPENDING }}>◔</span></div>
        <div className="big"><Hover className="quiet" tip={monthTip(s, s.spending, 'Spending')}>{usd(s.spending.value)}</Hover></div>
        <div className="row"><Delta none={s.early ? 'Compared from the 5th' : undefined} v={s.spending.change} upIsGood={false} /><Bars data={s.spending.bars} color={SPENDING} /></div>
      </div>
      <div className="card">
        <h3>Savings rate</h3>
        <div className="row" style={{ alignItems: 'center' }}>
          <div><div className="big"><Hover className="quiet" tip={<TipList title="Savings rate" rows={[['Income', usd(s.income.value)], ['Spending', usd(s.spending.value)],
            ['Kept', `${s.income.value >= s.spending.value ? '' : '−'}${usd(Math.abs(s.income.value - s.spending.value))}`]]}
            note="Share of this month's income you didn't spend. Transfers, savings and card payments aren't spending." />}>{s.savings.rate == null ? '—' : `${Math.round(s.savings.rate)}%`}</Hover></div><Delta none={s.early ? 'Compared from the 5th' : undefined} v={s.savings.change} unit=" pts" /></div>
          <Ring pct={s.savings.rate} />
        </div>
      </div>
    </div>
  );
}
