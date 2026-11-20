import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOURNALS } from '../web/src/journals.js';

// The small tracked labels must stay readable on every journal's paper, in both themes: tokens read from journals.js,
// the one source of each journal's paper, neutrals and cover.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

for (const [id, j] of Object.entries(JOURNALS)) {
  for (const theme of ['light', 'dark']) {
    const t = j[theme];
    test(`${id} ${theme}: muted labels, faded month heads and margin notes reach 4.5:1 on every sheet`, () => {
      for (const name of ['muted', 'muted2', 'pencil']) {
        for (const surf of ['bg', 'card', 'tint']) {
          const r = ratio(t[name], t[surf]);
          assert.ok(r >= 4.5, `${name} ${t[name]} on ${surf} ${t[surf]} is ${r.toFixed(2)}:1`);
        }
      }
    });
    test(`${id} ${theme}: rail section labels reach 4.5:1 on the lightest end of the rail`, () => {
      const top = toHex(mix(t.rail2, t.rail, 0.5));
      const r = ratio(t.railInk2, top);
      assert.ok(r >= 4.5, `railInk2 on the rail is ${r.toFixed(2)}:1`);
    });
  }
}
