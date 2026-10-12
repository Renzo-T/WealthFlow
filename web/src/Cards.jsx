import { useEffect, useMemo, useRef, useState } from 'react';
import { usd } from './format.js';
import { Hover, TipList, Trend } from './ui.jsx';

// "Changed since your last visit": each figure remembers what it was when you last looked (this browser only). When it
// has changed, the number counts to its new value once and a note says by how much. The baseline is the previous
// visit (at least 2 hours ago); reloading during this visit keeps showing the same change.
const SEEN = 'mizo.lastSeen', BASE = 'mizo.seenBase';
const read = (store, k) => { try { return JSON.parse(store.getItem(k) ?? 'null'); } catch { return null; } };
const write = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
function useSince(values) {
  return useMemo(() => {
    let base = read(sessionStorage, BASE);
    if (!base) {
      const seen = read(localStorage, SEEN);
      base = seen && Date.now() - seen.at > 2 * 3600e3 ? seen : { at: Date.now(), v: {} };
      write(sessionStorage, BASE, base);
    }
    write(localStorage, SEEN, { at: Date.now(), v: values });
    return base;
  }, [JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps
}
const sinceDay = (at) => {
  const days = Math.round((Date.now() - at) / 864e5);
  return days < 1 ? 'earlier today' : `since ${new Date(at).toLocaleDateString('en-US', days < 6 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })}`;
};
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A figure that counts from its last-seen value to now, once (exponential ease-out); otherwise just the value.
function Counter({ value, from }) {
  const [shown, setShown] = useState(from != null && Math.abs(from - value) >= 1 && !reduced() ? from : value);
  const raf = useRef(0);
  useEffect(() => {
    if (shown === value) return undefined;
    const start = performance.now(), a = shown, d = 1100;
    const step = (t) => {
      const p = Math.min(1, (t - start) / d), e = p === 1 ? 1 : 1 - 2 ** (-10 * p);
      setShown(a + (value - a) * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return usd(shown);
}
function Since({ from, value, at, upIsGood }) {
  if (from == null || Math.abs(value - from) < 1) return null;
  const d = value - from, tone = upIsGood == null ? 'muted' : (d > 0) === upIsGood ? 'good' : 'bad';
  return <span className="since small"><span className={`amt ${tone}`}>{d > 0 ? '+' : '−'}{usd(Math.abs(d))}</span> <span className="muted">{sinceDay(at)}</span></span>;
}

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
  const values = { nw: Math.round(s.netWorth.value), free: safe && typeof safe.free === 'number' ? Math.round(safe.free) : null, spent: Math.round(s.spending.value) };
  const base = useSince(values);
  const was = (k) => (base.v?.[k] == null || values[k] == null ? null : base.v[k]);
  const budgeted = (budgets?.items ?? []).reduce((t, b) => t + (b.amount ?? 0), 0);
  const free = safe && typeof safe.free === 'number' ? safe.free : null;
  return (
    <section className="standing" aria-label="Where you stand">
      <div className="stand lead">
        <span className="slabel">Net worth</span>
        <span className="sfig big">{s.netWorth.ago == null ? <Counter value={s.netWorth.value} from={was('nw')} />
          : <Hover className="quiet" tip={<TipList title="Net worth" rows={[['30 days ago', usd(s.netWorth.ago)], ['Today', usd(s.netWorth.value)],
            ['Change', `${s.netWorth.value >= s.netWorth.ago ? '+' : '−'}${usd(Math.abs(s.netWorth.value - s.netWorth.ago))}`]]} />}><Counter value={s.netWorth.value} from={was('nw')} /></Hover>}</span>
        <Since from={was('nw')} value={values.nw} at={base.at} upIsGood />
        <Delta v={s.netWorth.change} vs="vs. 30 days ago" hint="Net worth now compared with 30 days ago" />
      </div>
      <div className="stand">
        <span className="slabel">Free to spend</span>
        <span className="sfig big">{free == null ? '—' : <Hover className="quiet" tip={<TipList title="Free to spend" rows={[['Cash in everyday accounts', usd(safe.cash)],
          ['Income still coming', `+${usd(safe.incomeTotal ?? 0)}`], ['Bills still due', `−${usd(safe.dueTotal ?? 0)}`], ['Card balances', `−${usd(safe.owed ?? 0)}`],
          ['Cushion', `−${usd(safe.cushion ?? 0)}`]]} note="Through the end of the month. The Free to spend panel shows each item." />}><Counter value={free} from={was('free')} /></Hover>}</span>
        <Since from={was('free')} value={values.free ?? 0} at={base.at} upIsGood />
        <span className="small muted">left this month after bills</span>
      </div>
      <div className="stand">
        <span className="slabel">Spent this month</span>
        <span className="sfig big"><Hover className="quiet" tip={monthTip(s, s.spending, 'Spending')}><Counter value={s.spending.value} from={was('spent')} /></Hover></span>
        <Since from={was('spent')} value={values.spent} at={base.at} />
        {budgeted > 0 && <span className="small muted">of <span className="amt">{usd(budgeted)}</span> budgeted</span>}
        <span className="small">
          <Delta none={s.early ? 'Compared from the 5th' : undefined} v={s.spending.change} upIsGood={false} />
          {s.savings.rate != null && <> · <Hover className="quiet" tip={<TipList title="Savings rate" rows={[['Income', usd(s.income.value)], ['Spending', usd(s.spending.value)],
            ['Kept', `${s.income.value >= s.spending.value ? '' : '−'}${usd(Math.abs(s.income.value - s.spending.value))}`]]}
            note="Share of this month's income you didn't spend. Transfers, savings and card payments aren't spending." />}><span className="muted">{s.savings.rate < -0.5 ? '−' : ''}{Math.abs(Math.round(s.savings.rate))}% kept</span></Hover></>}
        </span>
      </div>
    </section>
  );
}
