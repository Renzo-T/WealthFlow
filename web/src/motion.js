// Page-wide switches (theme, journal, Hide amounts) cross-fade instead of cutting. The browser fades one snapshot of the
// window into the next (View Transitions; timing in styles.css), so no element animates on its own, nothing moves, and
// what the page shows at the end is exactly what it would show without the fade. With reduce motion, without View
// Transitions or in a hidden window, the change is immediate.
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A duration token from styles.css (--t-quick, --t-base, --t-arrive, --t-draw) in milliseconds, for motion run from JS,
// so it keeps the same timing as the CSS. 0 with reduce motion.
const FALLBACK = { '--t-quick': 120, '--t-base': 200, '--t-arrive': 600, '--t-draw': 900 };
export function duration(token) {
  if (reducedMotion()) return 0;
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : '';
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : FALLBACK[token];
}

// The app's curve (--ease, an exponential ease-out) for motion run from JS.
export const easeOut = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

// `change` must set a value fixed at the click (not flip one), since it may run from either path below, once.
export function crossfade(change) {
  if (!document.startViewTransition || reducedMotion() || document.visibilityState !== 'visible') { change(); return; }
  let done = false;
  const run = () => { if (!done) { done = true; flushSync(change); } };
  document.startViewTransition(run);
  // A window that isn't painting never takes the snapshot, and the switch would wait on it: apply it anyway.
  setTimeout(run, 250);
}

// Keeps the last item on screen for a moment after it goes, marked `leaving`, so it can fade out (dialogs, the toast).
export function useLeaving(item, token = '--t-quick') {
  const [kept, setKept] = useState(item);
  useEffect(() => {
    if (item) { setKept(item); return undefined; }
    const t = setTimeout(() => setKept(null), duration(token));
    return () => clearTimeout(t);
  }, [item, token]);
  return [item ?? kept, !item && !!kept];
}
