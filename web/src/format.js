// Money. Rule of thumb: individual transactions and bills show cents (usd2); totals and summaries show whole
// dollars (usd); chart axes use compact ($633K). Signed amounts use a real minus sign (−), never a hyphen.
export const usd2 = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactFmt = [0, 1].map((d) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: d }));
export const usdCompact = (n, digits = 1) => compactFmt[digits].format(n);
export const signed = (n, fmt = usd2) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;
// Chart colours. SERIES is four hues that stay distinct in every pairing, including for colour-blind readers
// (checked with the dataviz validator); anything beyond four is grey or folded into "Other". Colour follows the
// thing, not its rank. Red and green are kept for meaning (bad/good, money out/in), never as "series 5".
export const SERIES = ['#2f6bed', '#d9771c', '#0e9aa7', '#9b3bb5'];
export const NEUTRAL = '#8a96ab', NEUTRAL_LIGHT = '#c3ccd9';
export const INCOME = '#1fa971', SPENDING = '#9b3bb5';
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
