// When a goal that follows an account reached its target: the first day of the run of daily balances at or over it that
// is still going today (a goal that dipped below and came back counts from the comeback). null when it isn't over the
// target now, or when the history already starts over it, so the day it crossed can't be known.
export function reachedOn(hist, target) {
  if (!hist?.length || hist.at(-1).balance < target) return null;
  let i = hist.length - 1;
  while (i > 0 && hist[i - 1].balance >= target) i--;
  return i === 0 ? null : hist[i].date;
}
