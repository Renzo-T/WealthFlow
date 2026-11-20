// Page-wide switches (theme, journal, Hide amounts) cross-fade instead of cutting. The browser fades one snapshot of the
// window into the next (View Transitions; timing in styles.css), so no element animates on its own, nothing moves, and
// what the page shows at the end is exactly what it would show without the fade. With reduce motion, without View
// Transitions or in a hidden window, the change is immediate.
import { flushSync } from 'react-dom';

export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// `change` must set a value fixed at the click (not flip one), since it may run from either path below, once.
export function crossfade(change) {
  if (!document.startViewTransition || reducedMotion() || document.visibilityState !== 'visible') { change(); return; }
  let done = false;
  const run = () => { if (!done) { done = true; flushSync(change); } };
  document.startViewTransition(run);
  // A window that isn't painting never takes the snapshot, and the switch would wait on it: apply it anyway.
  setTimeout(run, 250);
}
