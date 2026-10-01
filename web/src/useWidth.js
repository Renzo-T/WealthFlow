import { useEffect, useRef, useState } from 'react';

// Width of an element in CSS pixels, kept up to date as the window resizes. Charts draw at this width so
// their text stays the same size at any window size instead of scaling with an SVG viewBox.
export default function useWidth(fallback = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
