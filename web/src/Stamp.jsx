// The stamps on the month spread and the month replay: ink impressions, not keys. A bill or payday that has happened
// is pressed in solid ink (indigo for bills, green for money in) with its category's drawn icon knocked out in sheet
// colour and slightly uneven edges; one still to come is a dashed pencil box waiting for its stamp. Shape carries the
// meaning as well as colour: money in is round, bills (and moves to savings) are square. Several on one day show a count.
import { useEffect, useState } from 'react';
import { I, iconKey } from './CategoryIcon.jsx';
import { exitList, nextGhosts } from './exitList.js';
import { handRect, handCircle } from './hand.js';

// Money going down into a tray: a big move to savings or investments (the replay).
const TRAY = <><path d="M12 3.5v10M7.5 9.5l4.5 4.5 4.5-4.5" /><path d="M4.5 15.5v4h15v-4" /></>;

// The drawn icon for a stamped bill or payday (a mark from /month-spread or /month-replay).
export const markIcon = (m) => iconKey(m.card ? { kind: 'card' } : { group: m.grp ?? (m.direction === 'in' ? 'Income' : null), sub: m.category });
// The payee's initial, for the hover.
export const initialOf = (name) => (name.match(/[A-Za-z0-9]/)?.[0] ?? '').toUpperCase();

// The uneven ink: the impression's edge wanders a little (displacement by fractal noise) and the ink is a touch denser
// in places (alpha mottled between about 88% and 100%). Three seeds, so neighbouring stamps aren't identical. Rendered
// once by the app; stamps refer to it by id (ink-0, ink-1, ink-2).
export function InkDefs() {
  return (
    <svg className="inkdefs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {[7, 19, 31].map((seed, i) => (
          <filter key={seed} id={`ink-${i}`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed={seed} result="edge" />
            <feDisplacementMap in="SourceGraphic" in2="edge" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="pressed" />
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed={seed + 3} result="grain" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.2 0 0 0 0.84" result="mottle" />
            <feComposite in="pressed" in2="mottle" operator="in" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

// The stamp itself, drawn in an s×s box (SVG content: wrap it in <svg> or a positioned <g>). `kind` is in, out or
// save; `done` inks it; `count` > 1 shows the count instead of an icon; `ink` picks the edge variant; `label` puts a
// letter (the payee's initial, in the hover) in place of the icon.
export function StampArt({ s, kind, done, icon, count = 1, ink = 0, label }) {
  const c = s / 2, w = 0.9;
  const shape = kind === 'in' ? <circle cx={c} cy={c} r={c - w} /> : <rect x={w} y={w} width={s - 2 * w} height={s - 2 * w} rx={s * 0.16} />;
  const text = count > 1 ? String(count) : label;
  const fig = text != null && s >= 11 && <text x={c} y={c} dy=".36em" textAnchor="middle" style={{ fontSize: s * (text.length > 1 ? 0.5 : 0.58) }}>{text}</text>;
  if (!done) {
    // Still to come: a pencil outline drawn by hand (its own wobble per stamp), waiting for the ink.
    const seed = 11 + ink * 7 + s + (text ? text.charCodeAt(0) : 0) + (kind === 'in' ? 3 : 0);
    const d = kind === 'in' ? handCircle(c, c, c - w - 0.3, seed) : handRect(w + 0.4, w + 0.4, s - 2 * w - 0.8, s - 2 * w - 0.8, seed);
    return <g className="st-due"><path d={d} />{(count > 1 || label) && fig}</g>;
  }
  const k = s * (kind === 'in' ? 0.56 : 0.64), sc = k / 24;
  const art = kind === 'save' ? TRAY : I[icon];
  return (
    <g className="st-ink" filter={`url(#ink-${ink % 3})`}>
      {shape}
      {fig || (art && s >= 11 && (
        <svg className="st-mark" x={(s - k) / 2} y={(s - k) / 2} width={k} height={k} viewBox="0 0 24 24" strokeWidth={Math.min(3, 1.15 / sc)}>{art}</svg>
      ))}
    </g>
  );
}

// A stamp that reads: a small inked box with a word and a date in sheet colour ("Reached Oct 2026", "Sep 7 – 12, 2026").
// Only for a dated fact that has happened (a goal reached, a trip taken), like the icon stamps. The ink (uneven edge,
// mottle) is a layer behind the text, so the text stays crisp. `kind` is in (green, good) or out (indigo); `tilt` rests
// it at a slight angle, like one pressed by hand.
export function TextStamp({ kind = 'out', ink = 0, tilt = false, children, className = '' }) {
  return (
    <span className={`tstamp ${kind}${tilt ? ' tilt' : ''} ${className}`.trim()}>
      <i className="tstamp-ink" style={{ filter: `url(#ink-${ink % 3})` }} aria-hidden="true" />
      <span className="tstamp-text">{children}</span>
    </span>
  );
}

// A row that has just been sorted leaves with a stamp pressed on it. `exitList` puts a row that disappeared from `items`
// back in its old place for STAMP_HOLD ms, marked `leaving`, so the stamp can land before the row goes; nothing around
// it moves until then. With reduced motion it returns the items as they are (no stamp, the row leaves at once).
export const STAMP_HOLD = 700;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Rows are { item, key, leaving }. `keyOf` gives an item's stable key.
export function useStampedExit(items, keyOf) {
  const [st, setSt] = useState({ src: items, ghosts: [] });
  if (st.src !== items) {
    const ghosts = nextGhosts(st.src, items, st.ghosts, keyOf, reducedMotion());
    setSt({ src: items, ghosts });
  }
  const ids = st.ghosts.map((g) => g.key).join('\u0001');
  useEffect(() => {
    if (!ids) return undefined;
    const t = setTimeout(() => setSt((s) => ({ ...s, ghosts: [] })), STAMP_HOLD);
    return () => clearTimeout(t);
  }, [ids]);
  return exitList(items, st.ghosts, keyOf);
}
// The impression pressed onto a leaving row (the row is position: relative; see .stampable in styles.css).
export const RowStamp = () => <Stamp kind="out" done icon="check" className="rowstamp" />;

// A stamp in a page (the spread's day columns, the legends, a hover). CSS sets its size; the drawing scales with it.
export function Stamp({ kind = 'out', done = false, icon, count, ink, label, className = '' }) {
  return (
    <svg className={`stamp ${kind}${done ? ' done' : ''} ${className}`.trim()} viewBox="0 0 17 17" aria-hidden="true" focusable="false">
      <StampArt s={17} kind={kind} done={done} icon={icon} count={count} ink={ink} label={label} />
    </svg>
  );
}
