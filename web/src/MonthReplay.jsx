import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, usdCompact, niceTicks, signed } from './format.js';
import useWidth from './useWidth.js';
import { Panel, Skeleton, EmptyState, Chevron, Est, Hover, tipText } from './ui.jsx';
import { Stamp, StampArt, markIcon } from './Stamp.jsx';
import { replayRange } from './replayScale.js';
import { reducedMotion } from './motion.js';

// The month, replayed: the cash in your everyday accounts at the end of each day, as one stepped line across the
// month's days (planner columns, weekends tinted, today washed). Paydays step it up and bills step it down; they're
// stamped on their day in ink like the month spread (Stamp.jsx), and the biggest are named on the line. The month
// arrives drawn, so the readout shows today at once; Replay draws it through day by day on demand, with the readout
// counting along. Hovering a day reads it out. Days ahead are
// dashed: only scheduled paydays and bills, never guessed day-to-day spending.
const H = 300, L = 58, R = 52, T = 30, B = 30, PB = H - B;
const DUR = 3200; // ms for a whole month
const monthName = (m) => new Date(`${m}-01T00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dayName = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const shortDay = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const shift = (m, n) => { const d = new Date(`${m}-01T00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('en-CA').slice(0, 7); };
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
// The chart's value range (padded, its top capped when a few days sit far above the rest: replayScale.js), shared by
// the chart and the legend's "big move" threshold.
const range = (r) => replayRange(r);
// A step (or a move to savings) worth naming: at least 6% of the chart's height.
const bigAt = (r) => { const [lo, hi] = range(r); return (hi - lo) * 0.06; };
const savedOf = (d) => -(d.parts?.find((x) => x.key === 'saved')?.amount ?? 0);
// The one item that is most of a day's step, if there is one: same direction, at least 60% of the net change and of
// everything that moved that way, and not dwarfing the net (a big move offset by another isn't "the" reason).
function mainItem(d) {
  const sign = Math.sign(d.change), gross = d.parts.filter((x) => Math.sign(x.amount) === sign).reduce((s, x) => s + Math.abs(x.amount), 0);
  const top = d.parts.filter((x) => x.top && Math.sign(x.top.amount) === sign).map((x) => x.top).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const a = Math.abs(top?.amount ?? 0), c = Math.abs(d.change);
  return top && a >= 0.6 * c && a >= 0.6 * gross && a <= 1.4 * c ? top.name : null;
}
const PLAY = <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor" /></svg>;

function Chart({ r, p, hover, setHover, playing }) {
  const [ref, W] = useWidth(900);
  const n = r.days.length, colw = (W - L - R) / n;
  const cx = (i) => L + (i + 0.5) * colw;
  const [lo, hi, capped] = range(r), big = bigAt(r);
  // Above a capped top the line runs along the top edge, and each step across it gets an axis break.
  const CEIL = T - 10;
  const y = (v) => Math.max(CEIL, T + ((hi - v) * (PB - T)) / (hi - lo));

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
  // Days with cash below zero: that day's flat stretch of the line is drawn in the warning colour.
  const under = r.days.map((d, i) => ({ d, i })).filter(({ d }) => d.cash != null && d.cash < 0);

  const revealed = (i) => p >= i + 0.5;
  // Label the biggest steps on the line with the day's net change (up to four, never two crowding the same spot),
  // naming the item only when it is most of the step.
  const steps = r.days.map((d, i) => ({ ...d, i })).filter((d) => d.change != null && Math.abs(d.change) >= big)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  // Stamps sit beside the line at their day's step: money in above it, bills and moves to savings below it, stacked
  // outward. Each is a box so the labels and the "Lowest" note can keep clear of them. Never smaller than a stamp can
  // be drawn (the first frame, before the width is measured, can be very narrow).
  const sz = Math.max(4, Math.min(15, colw - 4)), gap = 3, hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const stamps = [];
  r.days.forEach((d, i) => {
    if (d.cash == null) return;
    const outs = d.marks.filter((m) => m.direction !== 'in'), ins = d.marks.filter((m) => m.direction === 'in');
    const saved = savedOf(d);
    const before = i ? r.days[i - 1].cash : r.start;
    const yTop = y(Math.max(before ?? d.cash, d.cash)), yBot = y(Math.min(before ?? d.cash, d.cash));
    if (ins.length) stamps.push({ i, k: 'in', ms: ins, y0: yTop - 4 - sz });
    let down = yBot + 4;
    for (const [k, ms] of [...(outs.length ? [['out', outs]] : []), ...(saved >= big ? [['save', saved]] : [])]) {
      stamps.push({ i, k, ms, y0: Math.min(down, H - 16 - sz) });
      down += sz + gap;
    }
  });
  for (const s of stamps) Object.assign(s, { x0: cx(s.i) - sz / 2, x1: cx(s.i) + sz / 2, y1: s.y0 + sz });
  const labels = [];
  for (const e of steps) {
    if (labels.length >= 4) break;
    const before = e.i ? r.days[e.i - 1].cash : r.start;
    const top = Math.max(before ?? e.cash, e.cash ?? before);
    if (top == null) continue;
    let ly = Math.max(T - 8, y(top) - 9);
    // Lift the label over any stamp it would sit on.
    const name = mainItem(e), wd = ((name ? Math.min(name.length, 16) + 1 : 0) + 7) * 6.6, x = cx(e.i);
    const edge = x < L + 100 ? 'start' : x > W - R - 100 ? 'end' : 'middle';
    const x0 = edge === 'start' ? Math.max(L + 4, x + 6) : edge === 'end' ? Math.min(W - R - 4, x - 6) - wd : x - wd / 2;
    for (let g = 0, hit; g < 4 && (hit = stamps.find((s) => hits({ x0, x1: x0 + wd, y0: ly - 12, y1: ly + 3 }, s))); g++) ly = hit.y0 - 5;
    // Labels never overlap: compare whole boxes (a label near the right edge runs left from its step), and a label
    // that would sit on another goes just above it, or is left out when there's no room.
    const box = (yy) => ({ x0: x0 - 6, x1: x0 + wd + 6, y0: yy - 13, y1: yy + 4 });
    const over = labels.find((l) => hits(box(ly), l.box));
    if (over) ly = over.box.y0 - 5;
    if (ly < 10 || labels.some((l) => hits(box(ly), l.box))) continue;
    labels.push({ i: e.i, change: e.change, name, x, y: ly, box: box(ly) });
  }
  const low = r.low ? r.days.findIndex((d) => d.date === r.low.date) : -1;
  // "Lowest $…" goes under the point; if a stamp is there, to the side of it.
  let lowAt = null;
  if (low >= 0) {
    const lx = cx(low), ly = y(r.low.cash) + 18, wd = 112, half = sz / 2 + 5;
    const opts = [{ a: 'middle', x: lx, x0: lx - wd / 2 }, { a: 'start', x: lx + half, x0: lx + half }, { a: 'end', x: lx - half, x0: lx - half - wd }];
    lowAt = opts.find((o) => !stamps.some((s) => hits({ x0: o.x0, x1: o.x0 + wd, y0: ly - 11, y1: ly + 3 }, s))) ?? opts[0];
    lowAt = { ...lowAt, y: ly };
  }
  // "Cushion" sits over its line at the right end, or wherever along it (left end, or under the line) no stamp is.
  let cushAt = null;
  if (r.cushion > 0) {
    const cy = y(r.cushion) - 5, wd = 52 + 6.6 * usd(r.cushion).length;
    const opts = [{ a: 'end', x: W - R, x0: W - R - wd, y: cy }, { a: 'start', x: L + 4, x0: L + 4, y: cy },
      { a: 'end', x: W - R, x0: W - R - wd, y: cy + 17 }, { a: 'start', x: L + 4, x0: L + 4, y: cy + 17 }];
    cushAt = opts.find((o) => !stamps.some((s) => hits({ x0: o.x0, x1: o.x0 + wd, y0: o.y - 11, y1: o.y + 3 }, s))) ?? opts[0];
  }
  // With days ahead, "Cash" is written over the solid line's end, clear of stamps.
  let cashAt = null;
  if (ahead && todayI >= 0 && r.days[todayI].cash != null) {
    const tx = cx(todayI), ty = y(r.days[todayI].cash) - 7, wd = 30;
    const opts = [{ x: tx - 4, y: ty }, { x: tx - 4, y: ty + 20 }];
    cashAt = opts.find((o) => !stamps.some((s) => hits({ x0: o.x - wd, x1: o.x, y0: o.y - 11, y1: o.y + 3 }, s))) ?? null;
  }
  const breaks = capped ? r.days.map((d, i) => ({ i, before: i ? r.days[i - 1].cash : r.start, cash: d.cash }))
    .filter(({ before, cash }) => before != null && cash != null && (before > hi) !== (cash > hi))
    .map(({ i, before, cash }) => ({ i, top: Math.max(before, cash) })) : [];
  const head = Math.min(W - R, L + p * colw);
  const ticks = niceTicks(lo, hi, 4, { expand: false }).ticks;
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
          <text x={cushAt.x} y={cushAt.y} textAnchor={cushAt.a}>Cushion {usd(r.cushion)}</text></g>}
        {hover != null && <rect className="rp-hover" x={L + hover * colw} y={T - 14} width={colw} height={PB - T + 14} />}
        <g clipPath="url(#replay-head)">
          {past && <path className="rp-line" d={past} />}
          {ahead && <path className="rp-line ahead" d={ahead} />}
          {under.map(({ d, i }) => <line key={d.date} className={`rp-line neg${d.future ? ' ahead' : ''}`} x1={cx(i)} x2={i === n - 1 ? W - R : cx(i + 1)} y1={y(d.cash)} y2={y(d.cash)} />)}
        </g>
        {/* The lines are named where they end (the right margin), so the legend can keep to the stamps. */}
        {(ahead || past) && <text className="rp-end" x={W - R + 6} y={y(r.days.at(-1).cash ?? r.days[pastEnd].cash) + 4}>{ahead ? 'Ahead' : 'Cash'}</text>}
        {ahead && cashAt && <text className="rp-end" x={cashAt.x} y={cashAt.y} textAnchor="end">Cash</text>}
        {under.length > 0 && <text className="rp-end neg" x={W - R + 6} y={y(under.at(-1).d.cash) + (ahead && under.at(-1).i > todayI ? 4 : 18)}>Below $0</text>}
        {breaks.map(({ i, top }) => (
          <g key={`b${i}`} className={`rp-break${revealed(i) ? ' on' : ''}`} transform={`translate(${cx(i)},${T + 18})`}>
            <title>{tipText(`Above the scale: ${usd(top)}`)}</title>
            <path className="gap" d="M-7,0 L7,-5 L7,1 L-7,6 Z" /><path d="M-7,0 L7,-5 M-7,6 L7,1" />
          </g>
        ))}
        {p < n && p > 0 && <line className="rp-head" x1={head} x2={head} y1={T - 14} y2={PB} />}
        {low >= 0 && revealed(low) && <g className="rp-low">
          <circle cx={cx(low)} cy={y(r.low.cash)} r="4.5" />
          <text x={lowAt.x} y={lowAt.y} textAnchor={lowAt.a}>Lowest {usd(r.low.cash)}{r.low.future ? ' est' : ''}</text>
        </g>}
        {labels.map((l) => {
          // Near either edge the label runs inward from just past its step (clear of the line) instead of centring on it.
          const edge = l.x < L + 100 ? 'start' : l.x > W - R - 100 ? 'end' : 'middle';
          const lx = edge === 'start' ? Math.max(L + 4, l.x + 6) : edge === 'end' ? Math.min(W - R - 4, l.x - 6) : l.x;
          return (
          <text key={l.i} className={`rp-label${revealed(l.i) ? ' on' : ''}`} x={lx} y={l.y} textAnchor={edge}>
            {l.name && `${clip(l.name, 16)} `}<tspan className={l.change > 0 ? 'in' : ''}>{signed(l.change, (v) => usdCompact(v, 1))}</tspan>
          </text>
          );
        })}
        {stamps.map(({ i, k, ms, y0 }) => {
          const s = sz, d = r.days[i];
          const tip = k === 'save' ? `Moved to savings or investments −${usd(ms)}`
            : ms.map((m) => `${m.name} ${k === 'in' ? '+' : '−'}${usd2(m.amount)}${m.done ? '' : ' (expected)'}`).join('\n');
          const done = k === 'save' || ms.every((m) => m.done);
          return (
            <g key={d.date + k} className={`rp-stamp ${k}${done ? ' done' : ''}${revealed(i) ? ' on' : ''}`}
              transform={`translate(${cx(i) - s / 2},${y0})`}>
              <title>{tipText(tip)}</title>
              <StampArt s={s} kind={k} done={done} icon={k === 'save' ? null : markIcon(ms[0])} count={k === 'save' ? 1 : ms.length} ink={i + (k === 'in' ? 1 : 0)} />
            </g>
          );
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
    if (reducedMotion()) { setP(n); setPlaying(false); return; }
    const start = performance.now();
    setHover(null); setPlaying(true);
    const step = (t) => {
      const k = Math.min(1, (t - start) / DUR);
      setP(n * (k < 1 ? 1 - (1 - k) ** 1.6 : 1));
      if (k < 1) raf.current = requestAnimationFrame(step); else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
  };
  // A month arrives already drawn (an animation on every visit would hold back today's figure); Replay plays it.
  useEffect(() => {
    cancelAnimationFrame(raf.current); setPlaying(false); if (r?.days.length) setP(r.days.length);
    return () => cancelAnimationFrame(raf.current);
  }, [r]);

  const nav = (
    <span className="spreadnav">
      <span className="legend">
        <span><Stamp kind="in" done icon="arrowin" />Money in</span><span><Stamp kind="out" done icon="receipt" />Bill paid</span>
        {r?.days.some((d) => d.marks.some((m) => !m.done && m.direction !== 'in')) && <span><Stamp kind="out" />Bill due</span>}
        {r?.days.some((d) => d.parts && savedOf(d) >= bigAt(r)) && <span><Stamp kind="save" done />Moved to savings</span>}
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
  // The day's change in its parts: paydays, bills, moves to savings, money moved in, everyday spending, anything else.
  // A part made of one item names it.
  const pieces = (d?.parts ?? []).map((x) => (
    <span key={x.key}>{x.label}{x.count === 1 && x.key !== 'spending' && <span className="muted"> · {clip(x.top.name, 22)}</span>}{' '}
      <b className={x.amount > 0 ? 'good' : ''}><span className="amt">{signed(x.amount)}</span></b>{d.future && <span className="muted"> expected</span>}</span>
  ));
  return (
    <Panel className="mt replaypanel" title={title} actions={nav}>
      <div className="rp-read" aria-live="off">
        <div className="rp-now">
          <span className="slabel">{d ? `Cash at the end of ${dayName(d.date)}` : 'Cash at the start of the month'}</span>
          <span className="rp-fig amt">{cash == null ? '—' : d?.future ? <Est why="Estimate: from scheduled paydays and bills only">{usd(cash)}</Est> : usd(cash)}</span>
          <div className="rp-day small">{pieces.length ? pieces : <span className="muted">{d?.future ? 'Nothing scheduled.' : d ? 'No money in or out.' : ''}</span>}</div>
        </div>
        <div className="rp-sum small muted">
          {r.start != null && <span>Started at <b className="amt">{usd(r.start)}</b></span>}
          {r.low && <span>Lowest <b className="amt">{r.low.future ? <Est why="Estimate: from scheduled paydays and bills only">{usd(r.low.cash)}</Est> : usd(r.low.cash)}</b> on {shortDay(r.low.date)}</span>}
          {last?.cash != null && <span>{last.future ? 'Ends near' : 'Ended at'} <b className="amt">{last.future ? <Est why="Days ahead add only scheduled paydays and bills">{usd(last.cash)}</Est> : usd(last.cash)}</b></span>}
        </div>
      </div>
      <Chart r={r} p={p} hover={hover} setHover={setHover} playing={playing} />
      <p className="small muted foot"><Hover tip={<>
        <div className="hovtitle">Everyday accounts</div>
        <ul>{r.accounts.map((a) => <li key={a}>{a}</li>)}</ul>
        <div className="muted">Cash at the end of each day.{r.days.some((x) => x.future) && " Days ahead add only scheduled paydays and bills; everyday spending isn't guessed, so the real line will run lower."}</div>
      </>}><span>{r.accounts.length} everyday account{r.accounts.length === 1 ? '' : 's'}</span></Hover></p>
    </Panel>
  );
}
