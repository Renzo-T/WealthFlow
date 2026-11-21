import { useCallback, useEffect, useState } from 'react';

// A card the window holds while the page scrolls past it (CSS gives it position: sticky): Budget's side column, slid down
// the page like an index card as you work through the ledger. A paper planner doesn't scroll, so a card that stays put
// isn't drawn on the paper any more: while it's held it carries `.stuck`, and CSS makes it the solid sheet, so the
// ruling never slides through its pencil lines (DESIGN.md › The Held Card Rule). A card taller than the window is held
// by its foot instead (--stick-top goes negative), so every part of it can still be reached.
// Returns a callback ref, like useWidth: it follows whichever element is attached.
export default function useStuck() {
  const [el, setEl] = useState(null);
  const ref = useCallback((node) => setEl(node), []);
  useEffect(() => {
    if (!el) return undefined;
    let raf = 0;
    const place = () => {
      raf = 0;
      const sticky = getComputedStyle(el).position === 'sticky';
      if (sticky) {
        const u = parseFloat(getComputedStyle(el).getPropertyValue('--u')) || 22;
        const top = Math.min(u, window.innerHeight - el.getBoundingClientRect().height - u);
        el.style.setProperty('--stick-top', `${Math.round(top)}px`);
      } else el.style.removeProperty('--stick-top');
      // Held = moved down from where it sits in its column (at rest the two tops are the same).
      const held = sticky && el.getBoundingClientRect().top - el.parentElement.getBoundingClientRect().top > 0.5;
      el.classList.toggle('stuck', held);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
    const ro = new ResizeObserver(queue);
    ro.observe(el);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    queue();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue);
    };
  }, [el]);
  return ref;
}
