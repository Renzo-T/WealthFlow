// The page's dot grid as a layout grid (DESIGN.md › Grid unit). One unit U is the dot spacing (--u: 20, 22, 24 or 26px,
// stepping with the window's width; styles.css), and the ruling's marks sit
// at whole units from the page's (.main's) padding-box corner. CSS keeps widths in whole units; this rounds heights up:
// every panel, every section of a ruled panel and every top-level block of the page gets a min-height of whole units,
// so whatever comes next starts on a row of dots. No DOM work at import time: scripts/check-ui.mjs imports the
// selectors to check the same elements.

// The current unit in px, as CSS has it for the page (it steps with the window's width, so never cache it).
export function unit(main) {
  return parseFloat(getComputedStyle(main ?? document.documentElement).getPropertyValue('--u')) || 22;
}

// Panels (DESIGN.md › pencil borders). A panel inside another panel's body isn't snapped: it sits wherever the text
// above it ends. Sections of a ruled panel are, and so are the board's cells' panels, by usePacked (Dashboard.jsx).
export const PANELS = '.card, .ledger, .cards.ruled, .insight, .bstrip, .explain, .watch, .filterbar';
// Sections: the parts of one ruled panel (a ledger's sections, a strip's figures, the month panel's sections).
export const SECTIONS = '.ledger > *, .ledger > .dcell > *, .ledger > .grid2 > *, .cards.ruled > *, .msec';
// Owned by the dashboard board's packing (rows of U, one empty row between panels).
export const PACKED = '.dmain > .dcell, .dmain > .dcell *';

// The elements that must start and end on the grid, innermost first. `main` is the page (.main).
export function snapTargets(main) {
  const shown = (el) => el.offsetParent !== null;
  const placed = (el) => !['absolute', 'fixed', 'sticky'].includes(getComputedStyle(el).position);
  const out = new Set();
  for (const el of main.children) out.add(el);
  for (const el of main.querySelectorAll(SECTIONS)) out.add(el);
  for (const el of main.querySelectorAll(PANELS)) {
    const host = el.parentElement?.closest(PANELS);
    if (!host || main.contains(host) === false || el.matches(SECTIONS)) out.add(el);
  }
  return [...out].filter((el) => !el.matches(PACKED) && shown(el) && placed(el) && el.getClientRects().length > 0);
}

// What must sit on the grid (scripts/check-ui.mjs checks it): the snapped elements and the board's panels.
export function gridTargets(main) {
  const packed = [...main.querySelectorAll('.dmain > .dcell > :last-child')].filter((el) => el.getClientRects().length > 0);
  return [...snapTargets(main), ...packed];
}

// Edges more than 1px off a multiple of U from the page's padding-box corner: [{ el, edge, off }].
export function offGrid(main) {
  const U = unit(main), o = main.getBoundingClientRect(), out = [];
  for (const el of gridTargets(main)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    for (const [edge, v] of [['left', r.left - o.left], ['top', r.top - o.top], ['right', r.right - o.left], ['bottom', r.bottom - o.top]]) {
      const off = ((v % U) + U) % U, d = Math.min(off, U - off);
      if (d > 1) out.push({ el, edge, off: Math.round(off * 10) / 10 });
    }
  }
  return out;
}

const depth = (el, main) => { let n = 0; for (let e = el; e && e !== main; e = e.parentElement) n++; return n; };
const units = (h, U) => Math.max(1, Math.ceil((h - 0.1) / U));

// One pass: clear the min-heights, then, deepest first, read each level's natural heights and round them up. One layout
// per level, not per element; the scroll position is put back if a shorter page moved it in between.
export function snap(main) {
  const U = unit(main), els = snapTargets(main);
  const levels = new Map();
  for (const el of els) { const d = depth(el, main); levels.set(d, [...(levels.get(d) ?? []), el]); }
  const scroller = document.scrollingElement, y = scroller.scrollTop;
  // A subgrid ignores its own min-height (its parent's tracks size it), but its padding sizes its edge tracks, so it grows
  // by --snap-pad instead (CSS adds that to its bottom padding: .goal.view).
  const sub = new Set(els.filter((el) => getComputedStyle(el).gridTemplateRows.startsWith('subgrid')));
  for (const el of els) { el.style.minHeight = ''; el.style.removeProperty('--snap-pad'); }
  for (const d of [...levels.keys()].sort((a, b) => b - a)) {
    const level = levels.get(d), hs = level.map((el) => el.getBoundingClientRect().height);
    level.forEach((el, i) => {
      const h = units(hs[i], U) * U;
      if (sub.has(el)) el.style.setProperty('--snap-pad', `${h - hs[i]}px`); else el.style.minHeight = `${h}px`;
    });
  }
  if (scroller.scrollTop !== y) scroller.scrollTop = y;
  return els;
}

// Keeps the page snapped: after any change of size (the window, a box) or content (a page or data arriving), at most one
// pass per frame. A pass that writes the same heights changes nothing, so the observers settle after it.
export function startGrid(main) {
  let queued = 0, watched = new Set();
  const ro = new ResizeObserver(() => schedule());
  const run = () => {
    queued = 0;
    const els = snap(main), now = new Set(els);
    // Each box's own children too: a box held at its min-height doesn't change size when what's inside it shrinks
    // without a DOM change (the dashboard's board re-packing its panels once the font arrives), so watching the box
    // alone would leave it rows taller than its content until something else moved.
    for (const el of els) for (const kid of el.children) now.add(kid);
    for (const el of watched) if (!now.has(el)) ro.unobserve(el);
    for (const el of now) if (!watched.has(el)) ro.observe(el);
    watched = now;
  };
  const schedule = () => { if (!queued) queued = requestAnimationFrame(run); };
  const mo = new MutationObserver(schedule);
  mo.observe(main, { childList: true, subtree: true, characterData: true });
  ro.observe(main);
  main.addEventListener('transitionend', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
  return () => { cancelAnimationFrame(queued); ro.disconnect(); mo.disconnect(); main.removeEventListener('transitionend', schedule); };
}
