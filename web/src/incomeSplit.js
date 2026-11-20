// One income line well past its budget while another, budgeted, has received nothing: often the same paycheck filed
// under two categories (the bank renamed it, say), which double-counts income still to come and inflates "Not yet
// assigned". Says so, and offers to move the idle line's budget onto the one the money actually arrives in.
export function incomeSplit(rows) {
  const budgeted = rows.filter((c) => (c.budget ?? 0) >= 1 && !c.isGroup);
  const over = budgeted.filter((c) => c.actual - c.budget >= 100).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))[0];
  if (!over) return null;
  const idle = budgeted.filter((c) => c !== over && Math.abs(c.actual) < 0.5 && c.budget >= 100).sort((a, b) => b.budget - a.budget)[0];
  return idle ? { over, idle, extra: over.actual - over.budget } : null;
}
