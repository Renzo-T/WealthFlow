import { usd } from './format.js';
import { Hover, TipList, Trend } from './ui.jsx';

export { usd } from './format.js'; // older imports get it from here

// Month comparisons use the same number of days of last month (explained on hover; the label stays short).
function Delta({ v, upIsGood = true, unit = '%', vs = 'vs. last month', hint = 'Compared with the same number of days of last month', none = 'No prior data yet' }) {
  if (v == null) return <span className="small muted">{none}</span>;
  const good = v >= 0 === upIsGood;
  return (
    <span className="delta small">
      <span className={good ? 'good' : 'bad'}><Trend up={v >= 0} /> {Math.abs(v).toFixed(1)}{unit}</span>{' '}
      <span className="muted" title={hint}>{vs}</span>
    </span>
  );
}

const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long' });

// This month so far vs the same days of last month, and all of last month.
const monthTip = (s, x, what) => <TipList title={what} rows={[
  ['This month so far', usd(x.value)],
  [`${monthName(s.prevMonth).slice(0, 3)} 1${s.day > 1 ? `–${s.day}` : ''} (same days)`, usd(x.prev)],
  [`All of ${monthName(s.prevMonth)}`, usd(x.lastMonth)],
]} note={s.early ? 'The % comparison starts on the 5th, when there are enough days to compare.' : 'The % compares the same number of days.'} />;

// Where you stand, read first: one ruled strip, net worth largest, then what's free to spend and the month's spending
// against the budget. Income lives in Cash flow and on hover in Reports.
export default function Cards({ s, safe, budgets }) {
  const budgeted = (budgets?.items ?? []).reduce((t, b) => t + (b.amount ?? 0), 0);
  const free = safe && typeof safe.free === 'number' ? safe.free : null;
  return (
    <section className="standing" aria-label="Where you stand">
      <div className="stand lead">
        <span className="slabel">Net worth</span>
        <span className="sfig big">{s.netWorth.ago == null ? usd(s.netWorth.value)
          : <Hover className="quiet" tip={<TipList title="Net worth" rows={[['30 days ago', usd(s.netWorth.ago)], ['Today', usd(s.netWorth.value)],
            ['Change', `${s.netWorth.value >= s.netWorth.ago ? '+' : '−'}${usd(Math.abs(s.netWorth.value - s.netWorth.ago))}`]]} />}>{usd(s.netWorth.value)}</Hover>}</span>
        <Delta v={s.netWorth.change} vs="vs. 30 days ago" hint="Net worth now compared with 30 days ago" />
      </div>
      <div className="stand">
        <span className="slabel">Free to spend</span>
        <span className="sfig big">{free == null ? '—' : <Hover className="quiet" tip={<TipList title="Free to spend" rows={[['Cash in everyday accounts', usd(safe.cash)],
          ['Income still coming', `+${usd(safe.incomeTotal ?? 0)}`], ['Bills still due', `−${usd(safe.dueTotal ?? 0)}`], ['Card balances', `−${usd(safe.owed ?? 0)}`],
          ['Cushion', `−${usd(safe.cushion ?? 0)}`]]} note="Through the end of the month. The Free to spend panel shows each item." />}>{usd(free)}</Hover>}</span>
        <span className="small muted">left this month after bills</span>
      </div>
      <div className="stand">
        <span className="slabel">Spent this month</span>
        <span className="sfig big"><Hover className="quiet" tip={monthTip(s, s.spending, 'Spending')}>{usd(s.spending.value)}</Hover></span>
        {budgeted > 0 && <span className="small muted">of <span className="amt">{usd(budgeted)}</span> budgeted</span>}
        <span className="small">
          <Delta none={s.early ? 'Compared from the 5th' : undefined} v={s.spending.change} upIsGood={false} />
          {s.savings.rate != null && <> · <Hover className="quiet" tip={<TipList title="Savings rate" rows={[['Income', usd(s.income.value)], ['Spending', usd(s.spending.value)],
            ['Kept', `${s.income.value >= s.spending.value ? '' : '−'}${usd(Math.abs(s.income.value - s.spending.value))}`]]}
            note="Share of this month's income you didn't spend. Transfers, savings and card payments aren't spending." />}><span className="muted">{Math.round(s.savings.rate)}% kept</span></Hover></>}
        </span>
      </div>
    </section>
  );
}
