import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, deflate, crossingYear, buildSeries, avgSavings, SCENARIOS } from '../web/src/projectionMath.js';

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

// Hand-worked: 100,000 at 7% a year, compounded monthly (7/12 % a month), no contribution, 10 years.
//   (1 + 0.07/12)^120 = e^(120 · ln 1.0058333…) = e^0.697966… = 2.009661…  →  about 200,966.
test('project: 100,000 at 7% for 10 years, no contribution, in future dollars', () => {
  const v = project(100000, 0, 7, 10);
  assert.equal(v.length, 11, 'one point for today and one for each year');
  assert.equal(v[0], 100000);
  near(v[10], 200966, 1);
  near(v[1], 100000 * (1 + 0.07 / 12) ** 12, 1e-6, 'year 1 is twelve months of growth (7.2290% on 100,000)');
  near(v[1], 107229, 1);
});

test('project: no growth just adds the contribution; growth plus a contribution follows the annuity formula', () => {
  assert.deepEqual(project(1000, 100, 0, 2), [1000, 2200, 3400]);
  // 500 a month for 10 years at 6% (0.5% a month): 500 · ((1.005^120 − 1) / 0.005) = 500 · 163.8793 = 81,939.7
  near(project(0, 500, 6, 10)[10], 81939.67, 0.1);
  // and the start grows alongside it
  near(project(10000, 500, 6, 10)[10], 10000 * 1.005 ** 120 + 81939.67, 0.2);
});

// Today's dollars: divide each year's value by (1 + inflation)^year. Year 0 is already today's money.
//   200,966 / 1.03^10 = 200,966 / 1.343916 = 149,537.
test('deflate: 3% inflation turns the 10-year figure into about 149,537 of today\'s money', () => {
  const real = deflate(project(100000, 0, 7, 10), 3);
  assert.equal(real[0], 100000, 'today is unchanged');
  near(real[10], 149537, 1);
  near(real[1], 107229.0 / 1.03, 1, 'year 1 is divided by 1.03');
  assert.equal(real.length, 11);
});

test('deflate: 0% inflation changes nothing, and it never mutates its input', () => {
  const v = project(5000, 100, 5, 3);
  const copy = [...v];
  assert.deepEqual(deflate(v, 0), v);
  deflate(v, 3);
  assert.deepEqual(v, copy);
});

// Target crossing: the first year whose value is at or above the target.
//   100,000 at 7%: year 5 = 141,763 (short of 150,000), year 6 = 152,073 (over) → year 6.
test('crossingYear: the first yearly point at or above the target', () => {
  const v = project(100000, 0, 7, 10);
  assert.equal(crossingYear(v, 150000), 6);
  assert.equal(crossingYear(v, v[6]), 6, 'reaching it exactly counts');
  assert.equal(crossingYear(v, 100000), 0, 'already there today');
  assert.equal(crossingYear(v, 250000), null, 'not within the horizon');
});

test('crossingYear: in today\'s dollars the same target takes longer (year 11, not year 6)', () => {
  const future = project(100000, 0, 7, 12);
  const real = deflate(future, 3);
  assert.equal(crossingYear(future, 150000), 6);
  near(real[10], 149537, 1); // year 10 still short
  assert.equal(crossingYear(real, 150000), 11);
});

test('crossingYear: no usable target means no answer', () => {
  const v = project(100000, 0, 7, 10);
  assert.equal(crossingYear(v, null), null);
  assert.equal(crossingYear(v, 0), null);
  assert.equal(crossingYear(v, NaN), null);
});

const cashflow = [
  { month: '2026-07', income: 6000, spending: 4000, partial: false },
  { month: '2026-08', income: 6000, spending: 4400, partial: false },
  { month: '2026-09', income: 6000, spending: 4600, partial: false },
  { month: '2026-10', income: 0, spending: 100, partial: false }, // the month in progress is left out
];

test('buildSeries: defaults to today\'s dollars at 3% inflation, and values are what the chart shows', () => {
  const b = buildSeries({ monthly: '0', years: '10', rates: { conservative: '5', expected: '7', optimistic: '9' } }, 100000, cashflow);
  assert.equal(b.inflation, 3);
  assert.equal(b.real, true);
  const exp = b.series.find((s) => s.key === 'expected');
  near(exp.values[10], 149537, 1);
  near(exp.future[10], 200966, 1, 'the future-dollar figure is kept alongside');
  assert.equal(exp.values[0], 100000);
});

test('buildSeries: future dollars leaves the figures as compounded', () => {
  const b = buildSeries({ monthly: '0', years: '10', dollars: 'future', rates: { expected: '7' } }, 100000, cashflow);
  assert.equal(b.real, false);
  near(b.series.find((s) => s.key === 'expected').values[10], 200966, 1);
});

test('buildSeries: each scenario reports the year it reaches the target, in the dollars shown', () => {
  const a = { monthly: '0', years: '30', target: '150000', rates: { conservative: '5', expected: '7', optimistic: '9' } };
  const today = buildSeries(a, 100000, cashflow);
  const future = buildSeries({ ...a, dollars: 'future' }, 100000, cashflow);
  assert.equal(today.target, 150000);
  assert.equal(future.series.find((s) => s.key === 'expected').reaches, 6);
  assert.equal(today.series.find((s) => s.key === 'expected').reaches, 11);
  // more return gets there sooner
  const yrs = today.series.map((s) => s.reaches);
  assert.ok(yrs[0] > yrs[1] && yrs[1] > yrs[2], `conservative, expected, optimistic: ${yrs}`);
  // no target set → no column of answers
  const none = buildSeries({ ...a, target: '' }, 100000, cashflow);
  assert.equal(none.target, null);
  assert.ok(none.series.every((s) => s.reaches === null));
});

test('buildSeries: a target that is out of reach says so (null), not zero', () => {
  const b = buildSeries({ monthly: '0', years: '10', target: '1000000', rates: {} }, 100000, cashflow);
  assert.ok(b.series.every((s) => s.reaches === null));
  assert.equal(b.target, 1000000);
});

test('buildSeries: an empty contribution uses the recent average, an entered one wins', () => {
  near(buildSeries({ monthly: '', years: '5', rates: {} }, 0, cashflow).monthly, 6000 - 13000 / 3, 1e-9); // 6,000 − 4,333.33 a month
  assert.equal(buildSeries({ monthly: '250', years: '5', rates: {} }, 0, cashflow).monthly, 250);
});

test('buildSeries: inflation is read from the field, an empty one means 3%, and silly values are held to a sane range', () => {
  const at = (inflation) => buildSeries({ inflation, years: '5', rates: {} }, 1000, cashflow).inflation;
  assert.equal(at('2.5'), 2.5);
  assert.equal(at(''), 3);
  assert.equal(at(undefined), 3);
  assert.equal(at('0'), 0);
  assert.equal(at('-4'), 0);
  assert.equal(at('400'), 25);
});

test('buildSeries: scenarios use theme series colours, and the optimistic one is not green', () => {
  const b = buildSeries({ years: '5', rates: {} }, 1000, cashflow);
  assert.deepEqual(b.series.map((s) => s.key), ['conservative', 'expected', 'optimistic']);
  for (const s of b.series) assert.match(s.color, /^var\(--s[1-4]\)$/, `${s.key} uses a SERIES variable, not a hex`);
  assert.equal(new Set(b.series.map((s) => s.color)).size, 3, 'three distinct colours');
  assert.ok(SCENARIOS.every((s) => !/#|green|--in\b|--s3/.test(s.color)), '--s3 is the teal that reads as green; --in is money in');
});

test('buildSeries: the horizon is clamped to 1–60 years', () => {
  assert.equal(buildSeries({ years: '999', rates: {} }, 1, cashflow).years, 60);
  assert.equal(buildSeries({ years: '0', rates: {} }, 1, cashflow).years, 1);
});

test('avgSavings: ignores the month in progress and partial months', () => {
  const r = avgSavings([{ month: '2026-08', income: 100, spending: 40, partial: true }, ...cashflow]);
  assert.deepEqual(r.used, ['2026-07', '2026-08', '2026-09']);
  near(r.avg, 6000 - (4000 + 4400 + 4600) / 3, 1e-9);
});
