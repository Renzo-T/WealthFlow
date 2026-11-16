// The logic behind a sorted row leaving with a stamp (useStampedExit in Stamp.jsx), kept free of React.
// A "ghost" is a row that disappeared from the list: its item, where it was and its key.

// Ghosts after the list went from `prev` to `next`: rows still waiting out their stamp stay, and any row that
// vanished now becomes one. With `reduced` motion nothing is kept, so rows leave at once.
export function nextGhosts(prev, next, ghosts, keyOf, reduced = false) {
  if (reduced) return [];
  const now = new Set((next ?? []).map(keyOf));
  // Positions are taken in the list as it was drawn (earlier ghosts included), so they all agree with each other.
  return exitList(prev, ghosts, keyOf).map((r, index) => ({ item: r.item, key: r.key, index })).filter((g) => !now.has(g.key));
}

// The rows to draw: the current items, with each ghost put back at its old position, marked `leaving`.
export function exitList(items, ghosts, keyOf) {
  const rows = (items ?? []).map((item) => ({ item, key: keyOf(item), leaving: false }));
  for (const g of [...ghosts].sort((a, b) => a.index - b.index)) rows.splice(Math.min(g.index, rows.length), 0, { item: g.item, key: g.key, leaving: true });
  return rows;
}
