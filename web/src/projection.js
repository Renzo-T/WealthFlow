import { useState } from 'react';

export const SCENARIOS = [
  { key: 'conservative', label: 'Conservative', rate: 5, color: '#7c5cf0' },
  { key: 'expected', label: 'Expected', rate: 7, color: '#2f6bed' },
  { key: 'optimistic', label: 'Optimistic', rate: 9, color: '#1fa971' },
];
const KEY = 'wealthflow.forecast';
const DEFAULTS = { monthly: '', years: '30', rates: { conservative: '5', expected: '7', optimistic: '9' } };
const num = (v, d) => { const x = parseFloat(v); return v === '' || v == null || !Number.isFinite(x) ? d : x; };

// Assumptions live in this browser only (localStorage). Empty monthly = use recent average savings.
export function useAssumptions() {
  const [a, setA] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...DEFAULTS, ...s, rates: { ...DEFAULTS.rates, ...s.rates } }; }
    catch { return DEFAULTS; }
  });
  const update = (patch) => {
    const n = { ...a, ...patch };
    setA(n);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* storage unavailable */ }
  };
  return [a, update];
}

// Average (income - spending) over up to the last 3 finished months that have data from every
// connected bank. null when there's no such month yet.
export function avgSavings(cashflow) {
  const m = cashflow.slice(0, -1).filter((x) => !x.partial && (x.income || x.spending)).slice(-3);
  const mean = (k) => m.reduce((s, x) => s + x[k], 0) / (m.length || 1);
  return { avg: m.length ? mean('income') - mean('spending') : null, months: m.length, income: mean('income'), spending: mean('spending'), used: m.map((x) => x.month) };
}

// One rate applied to the whole balance, compounded monthly, contribution added each month. Yearly points.
export function project(start, monthly, ratePct, years) {
  const r = ratePct / 100 / 12;
  let b = start;
  const out = [b];
  for (let m = 1; m <= years * 12; m++) { b = b * (1 + r) + monthly; if (m % 12 === 0) out.push(b); }
  return out;
}

export function buildSeries(a, start, cashflow) {
  const { avg, months, income, spending, used } = avgSavings(cashflow);
  const monthly = num(a.monthly, avg ?? 0);
  const years = Math.max(1, Math.min(60, Math.round(num(a.years, 30))));
  const series = SCENARIOS.map((sc) => {
    const rate = num(a.rates[sc.key], sc.rate);
    return { ...sc, rate, values: project(start, monthly, rate, years) };
  });
  return { series, monthly, avg, months, years, income, spending, used };
}
