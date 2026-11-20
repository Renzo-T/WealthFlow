// Money. Rule of thumb: individual transactions and bills show cents (usd2); totals and summaries show whole
// dollars (usd); chart axes use compact ($633K). Signed amounts use a real minus sign (−), never a hyphen.
// Intl writes negatives with a hyphen-minus ("-$35"); every formatter here swaps it for the real minus sign.
const minus = (s) => s.replace('-', '−');
export const usd2 = (n) => minus(n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
export const usd = (n) => minus(n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
const compactFmt = [0, 1].map((d) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: d }));
export const usdCompact = (n, digits = 1) => minus(compactFmt[digits].format(n));
// Round axis ticks: steps of 1, 2, 2.5, 5 or 10 times a power of ten, about `count` of them. By default the domain
// grows to the outer ticks (lo/hi), so the first and last gridlines frame the data; { expand: false } keeps only the
// ticks inside [min, max] (for a chart whose scale is fixed elsewhere). Returns { ticks, lo, hi }.
export function niceTicks(min, max, count = 5, { expand = true } = {}) {
  if (!(max > min)) { const m = Number.isFinite(min) ? min : 0; min = m; max = m + 1; }
  const raw = (max - min) / Math.max(1, count - 1);
  const p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  let a = Math.ceil(min / step - 1e-9), b = Math.floor(max / step + 1e-9);
  if (expand) { a = Math.floor(min / step + 1e-9); b = Math.ceil(max / step - 1e-9); }
  const ticks = [];
  for (let k = a; k <= b; k++) ticks.push(+(k * step).toPrecision(12));
  return { ticks, lo: expand ? ticks[0] : min, hi: expand ? ticks.at(-1) : max };
}
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
  // Classes named from a fund's name (insights.js holdingKind): darker steps of the four hues, and an "Other" grey that
  // stays visible, so a large slice is never the pale grey.
  'Index funds': 'color-mix(in srgb, var(--s1) 55%, var(--ink))', 'Target date funds': 'color-mix(in srgb, var(--s2) 55%, var(--ink))',
  Bonds: 'color-mix(in srgb, var(--s3) 55%, var(--ink))', Other: 'color-mix(in srgb, var(--neutral) 60%, var(--ink))',
};
export const allocColor = (name) => ALLOC_COLORS[name] ?? NEUTRAL_LIGHT;
export const PALETTE = [...SERIES, NEUTRAL]; // legacy: prefer the named colours above
export const label = (c) =>
  !c ? 'Uncategorized' : c === 'REST' ? 'Everything else' : /[a-z]/.test(c) ? c
    : c.toLowerCase().split('_').map((w) => (w === 'and' ? '&' : w[0].toUpperCase() + w.slice(1))).join(' ');
export const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
