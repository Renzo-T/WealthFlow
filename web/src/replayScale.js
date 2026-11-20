// The month replay's value range. One big move (cash swept to investments on the 2nd, say) shouldn't squash the rest of
// the month into a flat line: when the highest values sit far above everything else, the chart's top is set by the
// rest, and the line runs off the top through an axis break. Only highs are capped: the lows (the lowest day, the
// cushion, going below zero) are what the chart is for, so they always fit.

// Values above the gap count as "far above" when the gap is at least this many times the span of the values under it,
// and they are at most this share of all the points (a few days, not half the month).
const GAP = 1.5, SHARE = 0.25;

// The highest value that belongs with the rest, or null when nothing stands apart.
export function capOf(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < 4) return null;
  const most = Math.floor(v.length * SHARE);
  let best = null;
  for (let k = v.length - 1; k >= v.length - most; k--) {
    const gap = v[k] - v[k - 1], below = v[k - 1] - v[0];
    if (gap > GAP * Math.max(below, 1) && (!best || gap > best.gap)) best = { gap, cap: v[k - 1] };
  }
  return best ? best.cap : null;
}

// [lo, hi, capped]: the padded range the chart draws, and whether values above `hi` run off the top.
export function replayRange({ start, days, cushion }) {
  const vals = [start, ...days.map((d) => d.cash)].filter((x) => x != null);
  const cap = capOf(vals);
  const shown = cap == null ? vals : vals.filter((x) => x <= cap);
  let lo = Math.min(...shown, ...(cushion > 0 ? [cushion] : [])), hi = Math.max(...shown, ...(cushion > 0 ? [cushion] : []));
  if (hi - lo < 200) { const mid = (hi + lo) / 2; lo = mid - 100; hi = mid + 100; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  if (lo > 0 && lo < (hi - lo) * 0.25) lo = 0; // close to zero: show zero
  return [lo, hi, cap != null];
}
