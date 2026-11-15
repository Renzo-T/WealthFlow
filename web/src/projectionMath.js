// The forecast's maths, with no React in it so tests/projection.test.js can import it as is.
// projection.js adds the saved-assumptions hook on top.
import { SERIES } from './format.js';

// Colours are theme series variables (never the green kept for money in, nor the teal that reads as green):
// conservative purple, expected blue, optimistic amber.
export const SCENARIOS = [
  { key: 'conservative', label: 'Conservative', rate: 5, color: SERIES[3] },
  { key: 'expected', label: 'Expected', rate: 7, color: SERIES[0] },
  { key: 'optimistic', label: 'Optimistic', rate: 9, color: SERIES[1] },
];
export const DEFAULT_INFLATION = 3;
export const DEFAULTS = {
  monthly: '', years: '30', inflation: String(DEFAULT_INFLATION), dollars: 'today', target: '',
  rates: { conservative: '5', expected: '7', optimistic: '9' },
};
export const num = (v, d) => { const x = parseFloat(v); return v === '' || v == null || !Number.isFinite(x) ? d : x; };

// Average (income - spending) over up to the last 3 finished months that have data from every
// connected bank. null when there's no such month yet.
export function avgSavings(cashflow) {
  const m = cashflow.slice(0, -1).filter((x) => !x.partial && (x.income || x.spending)).slice(-3);
  const mean = (k) => m.reduce((s, x) => s + x[k], 0) / (m.length || 1);
  return { avg: m.length ? mean('income') - mean('spending') : null, months: m.length, income: mean('income'), spending: mean('spending'), used: m.map((x) => x.month) };
}

// One rate applied to the whole balance, compounded monthly, contribution added each month. Yearly points,
// in future dollars (the amounts you'd see on a statement that year).
export function project(start, monthly, ratePct, years) {
  const r = ratePct / 100 / 12;
  let b = start;
  const out = [b];
  for (let m = 1; m <= years * 12; m++) { b = b * (1 + r) + monthly; if (m % 12 === 0) out.push(b); }
  return out;
}

// Yearly future-dollar values in today's money: the value at year i divided by (1 + inflation)^i.
export function deflate(values, inflationPct) {
  const f = 1 + inflationPct / 100;
  return values.map((v, i) => v / f ** i);
}

// The first year (index into the yearly points) whose value is at or above the target; null when it never gets
// there within the points given, or when there is no usable target.
export function crossingYear(values, target) {
  if (!(target > 0)) return null;
  const i = values.findIndex((v) => v >= target);
  return i < 0 ? null : i;
}

// `values` are what the chart and table show: today's dollars unless a.dollars === 'future'. `future` keeps the
// compounded figures. The target is compared in the dollars shown.
export function buildSeries(a, start, cashflow) {
  const { avg, months, income, spending, used } = avgSavings(cashflow);
  const monthly = num(a.monthly, avg ?? 0);
  const years = Math.max(1, Math.min(60, Math.round(num(a.years, 30))));
  const inflation = Math.max(0, Math.min(25, num(a.inflation, DEFAULT_INFLATION)));
  const real = a.dollars !== 'future';
  const t = num(a.target, null);
  const target = t > 0 ? t : null;
  const series = SCENARIOS.map((sc) => {
    const rate = num(a.rates?.[sc.key], sc.rate);
    const future = project(start, monthly, rate, years);
    const values = real ? deflate(future, inflation) : future;
    return { ...sc, rate, values, future, reaches: crossingYear(values, target) };
  });
  return { series, monthly, avg, months, years, income, spending, used, inflation, real, target };
}
