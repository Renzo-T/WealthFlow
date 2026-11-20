import { useEffect, useMemo, useRef, useState } from 'react';
import { usd, shortDate } from './format.js';
import { Hover, TipList, Trend, Standing, Stand } from './ui.jsx';
import { api } from './api.js';

// "Changed since your last visit": each figure remembers what it was when you last looked (this browser only). When it
// has changed, the number counts to its new value once and a note says by how much. The baseline is the previous
// visit (at least 2 hours ago); reloading during this visit keeps showing the same change.
const SEEN = 'mizo.lastSeen', BASE = 'mizo.seenBase';
const read = (store, k) => { try { return JSON.parse(store.getItem(k) ?? 'null'); } catch { return null; } };
const write = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
// The previous visit (at least 2 hours ago), fixed for this browser session. `first` marks a visit with nothing to compare to.
export function visitBase() {
  let base = read(sessionStorage, BASE);
  if (!base) {
    const seen = read(localStorage, SEEN);
    base = seen && Date.now() - seen.at > 2 * 3600e3 ? seen : { at: Date.now(), v: {}, first: true };
    write(sessionStorage, BASE, base);
  }
  return base;
}
function useSince(values) {
  return useMemo(() => {
    const base = visitBase();
    write(localStorage, SEEN, { at: Date.now(), v: values });
    return base;
  }, [JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps
}
export const sinceDay = (at) => {
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
    const start = performance.now(), a = shown, d = 700;
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

// This month so far vs the same days of last month, and all of last month. Refunds beyond a group's own spending are
// named, since they aren't taken off the total.
const monthTip = (s, x, what) => <TipList title={what} rows={[
  ['This month so far', usd(x.value)],
  [`${monthName(s.prevMonth).slice(0, 3)} 1${s.day > 1 ? `–${s.day}` : ''} (same days)`, usd(x.prev)],
  [`All of ${monthName(s.prevMonth)}`, usd(x.lastMonth)],
  ...(x.refunds > 0.5 ? [['Refunds not counted', usd(x.refunds)]] : []),
  ...(s.savings?.rate != null && what === 'Spending' ? [['Share of income kept', `${s.savings.rate < -0.5 ? '−' : ''}${Math.abs(Math.round(s.savings.rate))}%`]] : []),
]} note={[s.early ? 'The % comparison starts on the 5th, when there are enough days to compare.' : 'The % compares the same number of days.',
  x.refunds > 0.5 ? "A refund only reduces its own group's spending, never below zero, so a big one doesn't make the rest of the month look free." : null].filter(Boolean).join(' ')} />;

// Where you stand, read first: one ruled strip, net worth largest, then what's free to spend and the month's spending
// against the budget. Income lives in Cash flow and on hover in Reports.
export default function Cards({ s, safe, budgets }) {
  const values = { nw: Math.round(s.netWorth.value), free: safe && typeof safe.free === 'number' ? Math.round(safe.free) : null, spent: Math.round(s.spending.value) };
  const base = useSince(values);
  const was = (k) => (base.v?.[k] == null || values[k] == null ? null : base.v[k]);
  const budgeted = (budgets?.items ?? []).reduce((t, b) => t + (b.amount ?? 0), 0);
  const free = safe && typeof safe.free === 'number' ? safe.free : null;
  // One note per figure. Free to spend: a daily allowance. Spent: against an even pace of the flexible budget.
  const now = new Date(), daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const flex = (budgets?.items ?? []).filter((b) => b.kind === 'flexible' && b.pace > 0 && b.pace < 1);
  const evenPace = flex.reduce((t, b) => t + b.amount * b.pace, 0), flexSpent = flex.reduce((t, b) => t + b.spent, 0), ahead = flexSpent - evenPace;
  const nwChanged = was('nw') != null && Math.abs(values.nw - was('nw')) >= 1;
  return (
    <Standing label="Where you stand">
      <Stand lead label="Net worth" note={nwChanged ? <Since from={was('nw')} value={values.nw} at={base.at} upIsGood />
        : <Delta v={s.netWorth.change} vs="vs. 30 days ago" hint="Net worth now compared with 30 days ago" />}>
        {s.netWorth.ago == null ? <Counter value={s.netWorth.value} from={was('nw')} />
          : <Hover className="quiet" tip={<TipList title="Net worth" rows={[['30 days ago', usd(s.netWorth.ago)], ['Today', usd(s.netWorth.value)],
            ['Change', `${s.netWorth.value >= s.netWorth.ago ? '+' : '−'}${usd(Math.abs(s.netWorth.value - s.netWorth.ago))}`]]} />}><Counter value={s.netWorth.value} from={was('nw')} /></Hover>}
      </Stand>
      <Stand label="Free to spend" note={free == null ? <span className="small muted">left this month after bills</span>
        : free < 1 ? <span className="small muted">Nothing left to spend this month</span>
          : <span className="small muted"><span className="amt">{usd(free / daysLeft)}</span> a day for the next {daysLeft === 1 ? 'day' : `${daysLeft} days`}</span>}>
        {free == null ? '—' : <Hover className="quiet" tip={<TipList title="Free to spend" rows={[['Cash in everyday accounts', usd(safe.cash)],
          ['Income still coming', `+${usd(safe.incomeTotal ?? 0)}`], ['Bills still due', `−${usd(safe.dueTotal ?? 0)}`], ['Card balances', `−${usd(safe.owed ?? 0)}`],
          ['Cushion', `−${usd(safe.cushion ?? 0)}`]]} note="Through the end of the month. Bills shows each one still due." />}><Counter value={free} from={was('free')} /></Hover>}
      </Stand>
      <Stand label="Spent this month" note={<>
        {flex.length > 0 && Math.abs(ahead) >= 1 ? <span className="small muted" title="Flexible spending against an even pace of its budget for today"><span className={`amt ${ahead > 0 ? 'bad' : 'good'}`}>{usd(Math.abs(ahead))}</span> {ahead > 0 ? 'ahead of' : 'under'} an even pace</span>
          : flex.length > 0 ? <span className="small muted">On an even pace</span> : null}
        {budgeted > 0 && <span className="small muted">of <span className="amt">{usd(budgeted)}</span> budgeted</span>}
      </>}>
        <Hover className="quiet" tip={monthTip(s, s.spending, 'Spending')}><Counter value={s.spending.value} from={was('spent')} /></Hover>
      </Stand>
    </Standing>
  );
}

// The dashboard's sub-line: what happened since your last visit, or the plain greeting when there is nothing to compare to.
export function Digest({ greeting }) {
  const [d, setD] = useState(null);
  const base = useMemo(() => visitBase(), []);
  const when = sinceDay(base.at);
  const usable = !base.first && when !== 'earlier today';
  useEffect(() => {
    if (!usable) return;
    api(`/since?from=${new Date(base.at).toLocaleDateString('en-CA')}`).then((r) => { if (r && !r.error_message) setD(r); }).catch(() => {});
  }, [usable, base.at]);
  if (!usable || !d) return greeting;
  const n = (k, one, many = `${one}s`) => (k === 1 ? `1 ${one}` : `${k} ${many}`);
  const got = [d.transactions > 0 && `${n(d.transactions, 'new transaction')}`, d.billsPaid > 0 && `${n(d.billsPaid, 'bill')} paid`, d.incomeReceived > 0 && 'pay arrived'].filter(Boolean);
  const day = d.nextIncome && (() => { const k = Math.round((Date.parse(`${d.nextIncome.date}T00:00`) - Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00`)) / 864e5);
    return k <= 0 ? 'today' : k === 1 ? 'tomorrow' : k < 7 ? new Date(`${d.nextIncome.date}T00:00`).toLocaleDateString('en-US', { weekday: 'short' }) : shortDate(d.nextIncome.date); })();
  const next = d.nextIncome ? ` ${d.nextIncome.name} pays ${day}.` : '';
  return got.length ? `${when[0].toUpperCase()}${when.slice(1)}: ${got.join(', ')}.${next}` : `Nothing new ${when}.${next}`;
}
