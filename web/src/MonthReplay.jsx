import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, usdCompact } from './format.js';
import useWidth from './useWidth.js';
import { Panel, Skeleton, EmptyState, Chevron } from './ui.jsx';

// The month, replayed: the cash in your everyday accounts at the end of each day, as one stepped line across the
// month's days (planner columns, weekends tinted, today washed). Paydays step it up and bills step it down; they're
// stamped on their day like the month spread, and the biggest are named on the line. Replay draws the month through
// once, day by day, with the readout counting along; hovering a day reads it out. Days ahead are dashed: only
// scheduled paydays and bills, never guessed day-to-day spending.
const H = 300, L = 58, R = 16, T = 30, B = 52, PB = H - B;
const DUR = 3200; // ms for a whole month
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dayName = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const shortDay = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const shift = (m, n) => { const d = new Date(`${m}-01T00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-CA').slice(0, 7); };
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const initial = (list) => (list.length > 1 ? String(list.length) : (list[0].name.match(/[A-Za-z0-9]/)?.[0] ?? '').toUpperCase());
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const PLAY = <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor" /></svg>;

function Chart({ r, p, hover, setHover, playing }) {
  const [ref, W] = useWidth(900);
  const n = r.days.length, colw = (W - L - R) / n;
  const cx = (i) => L + (i + 0.5) * colw;
  const vals = [r.start, ...r.days.map((d) => d.cash)].filter((v) => v != null);
  let lo = Math.min(...vals, ...(r.cushion > 0 ? [r.cushion] : [])), hi = Math.max(...vals);
  if (hi - lo < 200) { const mid = (hi + lo) / 2; lo = mid - 100; hi = mid + 100; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  if (lo > 0 && lo < (hi - lo) * 0.25) lo = 0; // close to zero: show zero
  const y = (v) => T + ((hi - v) * (PB - T)) / (hi - lo);

  // Stepped line: flat through each day, stepping at the day's centre (where its stamps sit).
  const firstI = r.days.findIndex((d) => d.cash != null);
  const todayI = r.days.findIndex((d) => d.today);
  const pastEnd = todayI >= 0 ? todayI : n - 1;
  const seg = (from, to, startV, endX) => {
    let d = `M${(from === 0 ? L : cx(from - 1)).toFixed(1)},${y(startV).toFixed(1)}`;
    for (let i = from; i <= to; i++) d += `H${cx(i).toFixed(1)}V${y(r.days[i].cash).toFixed(1)}`;
    return d + (endX != null ? `H${endX.toFixed(1)}` : '');
  };
  const begin = r.start ?? r.days[firstI]?.cash;
  const past = firstI >= 0 && firstI <= pastEnd ? seg(firstI, pastEnd, firstI === 0 ? begin : r.days[firstI - 1]?.cash ?? r.days[firstI].cash, todayI >= 0 ? undefined : W - R) : null;
  const ahead = todayI >= 0 && todayI < n - 1 ? seg(todayI + 1, n - 1, r.days[todayI].cash, W - R) : null;

  const revealed = (i) => p >= i + 0.5;
  // Name the biggest paydays and bills on the line (up to four, never two crowding the same spot).
  const events = r.days.flatMap((d, i) => d.marks.map((m) => ({ ...m, i }))).sort((a, b) => b.amount - a.amount);
  const labels = [];
  for (const e of events) {
    if (labels.length >= 4 || e.amount < (hi - lo) * 0.06) break;
    const before = e.i ? r.days[e.i - 1].cash : r.start;
    const top = Math.max(before ?? r.days[e.i].cash, r.days[e.i].cash ?? before);
    if (top == null) continue;
    const ly = Math.max(T - 8, y(top) - 9);
    if (labels.some((l) => Math.abs(l.x - cx(e.i)) < 120 && Math.abs(l.y - ly) < 16)) continue;
    labels.push({ ...e, x: cx(e.i), y: ly });
  }
  const low = r.low ? r.days.findIndex((d) => d.date === r.low.date) : -1;
  const head = Math.min(W - R, L + p * colw);
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const move = (e) => {
    if (playing) return;
    const b = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((((e.clientX - b.left) / b.width) * W - L) / colw);
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <>
      <div ref={ref} />
      <svg className="chart replay" width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)}
        role="img" aria-label={`Cash in your everyday accounts each day of ${monthName(r.month)}`}>
        <defs><clipPath id="replay-head"><rect x="0" y="0" width={head} height={H} /></clipPath></defs>
        {r.days.map((d, i) => (d.weekend || d.today) && <rect key={d.date} className={d.today ? 'rp-today' : 'rp-weekend'} x={L + i * colw} y={T - 14} width={colw} height={PB - T + 14} />)}
        {ticks.map((v) => <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{usdCompact(v, 1)}</text></g>)}
        {lo < 0 && <line className="rp-zero" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />}
        {r.cushion > 0 && <g><line className="rp-cushion" x1={L} x2={W - R} y1={y(r.cushion)} y2={y(r.cushion)} />
          <text x={W - R} y={y(r.cushion) - 5} textAnchor="end">Cushion</text></g>}
        {hover != null && <rect className="rp-hover" x={L + hover * colw} y={T - 14} width={colw} height={PB - T + 14} />}
        <g clipPath="url(#replay-head)">
          {past && <path className="rp-line" d={past} />}
          {ahead && <path className="rp-line ahead" d={ahead} />}
        </g>
        {p < n && p > 0 && <line className="rp-head" x1={head} x2={head} y1={T - 14} y2={PB} />}
        {low >= 0 && revealed(low) && <g className="rp-low">
          <circle cx={cx(low)} cy={y(r.low.cash)} r="4.5" />
          <text x={cx(low)} y={y(r.low.cash) + 18} textAnchor="middle">Lowest {usd(r.low.cash)}{r.low.future ? ' est' : ''}</text>
        </g>}
        {labels.map((l) => {
          // Near either edge the label runs inward from its step instead of centring on it.
          const edge = l.x < L + 100 ? 'start' : l.x > W - R - 100 ? 'end' : 'middle';
          const lx = edge === 'start' ? Math.max(L + 4, l.x - 8) : edge === 'end' ? Math.min(W - R - 4, l.x + 8) : l.x;
          return (
          <text key={`${l.i}${l.name}`} className={`rp-label${revealed(l.i) ? ' on' : ''}`} x={lx} y={l.y} textAnchor={edge}>
            {clip(l.name, 16)} <tspan className={l.direction === 'in' ? 'in' : ''}>{l.direction === 'in' ? '+' : '−'}{usd(l.amount)}</tspan>
          </text>
          );
        })}
        {r.days.map((d, i) => {
          const outs = d.marks.filter((m) => m.direction !== 'in'), ins = d.marks.filter((m) => m.direction === 'in');
          const s = Math.min(15, colw - 4), list = [...(ins.length ? [['in', ins]] : []), ...(outs.length ? [['out', outs]] : [])];
          return list.map(([k, ms], j) => (
            <g key={d.date + k} className={`rp-stamp ${k}${ms.every((m) => m.done) ? ' done' : ''}${revealed(i) ? ' on' : ''}`}
              transform={`translate(${cx(i) - s / 2},${PB + 6 + j * (s + 3)})`}>
              <rect width={s} height={s} rx="3" />
              {s >= 12 && <text x={s / 2} y={s / 2 + 3.5} textAnchor="middle">{initial(ms)}</text>}
            </g>
          ));
        })}
        {r.days.map((d, i) => (i === 0 || i === n - 1 || d.today || ((i + 1) % 5 === 0 && i < n - 3 && (todayI < 0 || Math.abs(i - todayI) > 1))) && (
          <text key={d.date} className={d.today ? 'rp-daynum today' : 'rp-daynum'} x={cx(i)} y={H - 6} textAnchor="middle">{i + 1}</text>
        ))}
      </svg>
    </>
  );
}

export default function MonthReplay({ month: wanted }) {
  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);
  const [month, setMonth] = useState(wanted ?? thisMonth);
  const [r, setR] = useState(null);
  const [p, setP] = useState(0);
  const [hover, setHover] = useState(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  useEffect(() => { if (wanted) setMonth(wanted); }, [wanted]);
  useEffect(() => { let on = true; setR(null); api(`/month-replay?month=${month}`).then((x) => on && setR(x)); return () => { on = false; }; }, [month]);

  const play = (n) => {
    cancelAnimationFrame(raf.current);
    if (reduced()) { setP(n); setPlaying(false); return; }
    const start = performance.now();
    setHover(null); setPlaying(true);
    const step = (t) => {
      const k = Math.min(1, (t - start) / DUR);
      setP(n * (k < 1 ? 1 - (1 - k) ** 1.6 : 1));
      if (k < 1) raf.current = requestAnimationFrame(step); else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
  };
  // Plays once when a month arrives; Replay plays it again.
  useEffect(() => { if (r?.days.length) play(r.days.length); return () => cancelAnimationFrame(raf.current); }, [r]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = (
    <span className="spreadnav">
      <span className="legend">
        <span><i className="lkey" />Cash</span>{r?.days.some((d) => d.future) && <span><i className="lkey dash" />Ahead (scheduled only)</span>}
        <span><i className="stamp in done" />Money in</span><span><i className="stamp out done" />Bill paid</span>
      </span>
      <button className="btn replaybtn" onClick={() => r && play(r.days.length)} disabled={!r?.days.length || playing}>{PLAY}Replay</button>
      <button className="iconbtn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month"><Chevron dir="left" /></button>
      <button className="iconbtn" onClick={() => setMonth(shift(month, 1))} disabled={month >= thisMonth} aria-label="Next month"><Chevron /></button>
    </span>
  );
  const title = <>{monthName(month)}, replayed<span className="asof">{month === thisMonth ? 'this month' : 'past'}</span></>;
  if (!r) return <Panel className="mt replaypanel" title={title} actions={nav}><Skeleton h={H + 60} r={12} /></Panel>;
  const has = r.days.some((d) => d.cash != null);
  if (!r.accounts.length || !has) {
    return <Panel className="mt replaypanel" title={title} actions={nav}>
      <EmptyState icon="chart" title={r.accounts.length ? 'No balance history for this month' : 'No everyday accounts yet'}>
        {r.accounts.length ? 'Your banks\' history starts after this month.' : 'Connect a checking account to see your cash move through the month.'}
      </EmptyState>
    </Panel>;
  }

  const n = r.days.length, todayI = r.days.findIndex((d) => d.today);
  const shownI = hover ?? (playing ? Math.min(n - 1, Math.floor(p - 0.5)) : todayI >= 0 ? todayI : n - 1);
  const d = shownI >= 0 ? r.days[shownI] : null;
  const cash = d?.cash ?? r.start;
  const last = r.days.at(-1);
  // The day's paydays and bills by name, then whatever else came in or went out of these accounts that day.
  const named = (dir) => (d?.marks ?? []).filter((m) => m.done && (m.direction === 'in') === (dir === 'in')).reduce((s, m) => s + m.amount, 0);
  const otherIn = d && !d.future ? d.in - named('in') : 0, otherOut = d && !d.future ? d.out - named('out') : 0;
  const pieces = d ? [
    ...d.marks.map((m) => <span key={m.name + m.amount}>{m.name} <b className={m.direction === 'in' ? 'good' : ''}>{m.direction === 'in' ? '+' : '−'}<span className="amt">{usd2(m.amount)}</span></b>{m.done ? '' : <span className="muted"> expected</span>}</span>),
    ...(otherIn > 0.5 ? [<span key="i">{d.marks.length ? 'Other money in' : 'Money in'} <b className="good">+<span className="amt">{usd2(otherIn)}</span></b></span>] : []),
    ...(otherOut > 0.5 ? [<span key="o">{d.marks.length ? 'Other spending and transfers' : 'Spending and transfers'} <b>−<span className="amt">{usd2(otherOut)}</span></b></span>] : []),
  ] : [];
  return (
    <Panel className="mt replaypanel" title={title} actions={nav}>
      <div className="rp-read" aria-live="off">
        <div>
          <span className="slabel">{d ? `Cash at the end of ${dayName(d.date)}` : 'Cash at the start of the month'}{d?.future ? ' (est.)' : ''}</span>
          <span className="rp-fig amt">{cash == null ? '—' : usd(cash)}</span>
        </div>
        <div className="rp-day small">{pieces.length ? pieces : <span className="muted">{d?.future ? 'Nothing scheduled.' : d ? 'No money in or out.' : ''}</span>}</div>
        <div className="rp-sum small muted">
          {r.start != null && <span>Started at <b className="amt">{usd(r.start)}</b></span>}
          {r.low && <span>Lowest <b className="amt">{usd(r.low.cash)}</b> on {shortDay(r.low.date)}{r.low.future ? ' (est.)' : ''}</span>}
          {last?.cash != null && <span>{last.future ? 'Ends near' : 'Ended at'} <b className="amt">{usd(last.cash)}</b></span>}
        </div>
      </div>
      <Chart r={r} p={p} hover={hover} setHover={setHover} playing={playing} />
      <p className="small muted foot">Cash in {r.accounts.join(', ')} at the end of each day.{r.days.some((x) => x.future) && <> Dashed days
        ahead add only scheduled paydays and bills; everyday spending isn't guessed, so the real line will run lower.</>}</p>
    </Panel>
  );
}
