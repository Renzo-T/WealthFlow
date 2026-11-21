// Estimated vs real stretches of a balance line, shared by the net worth chart and the account sparklines so the two
// always agree. `est` is one flag per day. A single estimated day between two real days is a day without a sync, not
// "estimated history": it counts as real (the caller interpolates its value). Two or more in a row stay estimated.
// Runs of real and estimated days share their boundary point, so the line is unbroken where one turns into the other.
export function estRuns(est) {
  const real = est.map((e, i) => !e || (i > 0 && i < est.length - 1 && !est[i - 1] && !est[i + 1]));
  const runs = [];
  real.forEach((r, i) => {
    const last = runs.at(-1);
    if (last && last.est === !r) last.to = i; else runs.push({ est: !r, from: Math.max(0, i - 1), to: i });
  });
  return { real, runs };
}
