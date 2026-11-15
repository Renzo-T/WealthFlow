import { useState } from 'react';
import { DEFAULTS } from './projectionMath.js';

// The maths lives in projectionMath.js (importable by tests without React); re-exported so pages keep one import.
export { SCENARIOS, project, deflate, crossingYear, avgSavings, buildSeries } from './projectionMath.js';
const KEY = 'wealthflow.forecast';

// Assumptions live in this browser only (localStorage). Empty monthly = use recent average savings.
// Older saved assumptions have no inflation, dollars or target: they get the defaults (3%, today's dollars, none).
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
