import { useCallback, useEffect, useState } from 'react';

// Width of an element in CSS pixels, kept up to date as the window resizes. Charts draw at this width so
// their text stays the same size at any window size instead of scaling with an SVG viewBox.
// The ref is a callback ref: the observer follows whichever element is attached, including one that mounts after the
// first render or replaces an earlier one (a ref object read once in an effect missed those, and the chart stayed at
// its fallback width while the browser scaled it up).
export default function useWidth(fallback = 600) {
  const [el, setEl] = useState(null);
  const [w, setW] = useState(fallback);
  const ref = useCallback((node) => setEl(node), []);
  useEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, w];
}
