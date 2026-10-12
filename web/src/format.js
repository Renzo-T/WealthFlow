// Money. Rule of thumb: individual transactions and bills show cents (usd2); totals and summaries show whole
// dollars (usd); chart axes use compact ($633K). Signed amounts use a real minus sign (−), never a hyphen.
export const usd2 = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactFmt = [0, 1].map((d) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: d }));
export const usdCompact = (n, digits = 1) => compactFmt[digits].format(n);
export const signed = (n, fmt = usd2) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;
// Chart colours. SERIES is four hues that stay distinct in every pairing, including for colour-blind readers
// (checked with the dataviz validator, each theme against its own surface); anything beyond four is grey or folded into
// "Other". Colour follows the thing, not its rank. Red and green are kept for meaning (bad/good, money out/in), never
// as "series 5". They're theme variables (styles.css: --s1..--s4), so dark mode gets its own validated steps.
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
export const NEUTRAL = 'var(--neutral)', NEUTRAL_LIGHT = 'var(--neutral-light)';
export const INCOME = 'var(--in)', SPENDING = 'var(--s4)';
// A colour at a given strength over the page (for icon chips and soft fills): works with theme variables.
export const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
export const ALLOC_COLORS = {
  ETFs: SERIES[0], 'Employer plan funds': SERIES[1], Stocks: SERIES[2], 'Mutual funds': SERIES[3], Cash: NEUTRAL,
  Taxable: SERIES[0], Retirement: SERIES[1], HSA: SERIES[3],
};
export const allocColor = (name) => ALLOC_COLORS[name] ?? NEUTRAL_LIGHT;
export const PALETTE = [...SERIES, NEUTRAL]; // legacy: prefer the named colours above
export const label = (c) =>
  !c ? 'Uncategorized' : c === 'REST' ? 'Everything else' : /[a-z]/.test(c) ? c
    : c.toLowerCase().split('_').map((w) => (w === 'and' ? '&' : w[0].toUpperCase() + w.slice(1))).join(' ');
export const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
