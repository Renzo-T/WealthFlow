import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The small tracked labels must stay readable on the warm sheet: tokens read straight from styles.css.
const css = readFileSync(new URL('../web/src/styles.css', import.meta.url), 'utf8');
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Last declaration of a token inside a block that starts at `from` (light :root, or one of the dark blocks).
const blocks = {
  light: css.indexOf(':root {'),
  darkAuto: css.indexOf(':root:not([data-theme="light"]) {'),
  darkSet: css.indexOf(':root[data-theme="dark"] {'),
};
function token(name, block) {
  const start = blocks[block];
  const end = css.indexOf('\n}', start);
  const m = css.slice(start, end).match(new RegExp(`${name}: *(#[0-9a-fA-F]{6})`));
  assert.ok(m, `${name} is defined in the ${block} block`);
  return m[1];
}
// The richer-planner override of the paper surfaces (bg/card/surface-2) sits in a later block of each kind.
const paper = {
  light: { bg: '#f2f0e9', card: '#fffefc', s2: '#f8f6f0' },
  darkAuto: { bg: '#11141c', card: '#181c27', s2: '#1d2230' },
  darkSet: { bg: '#11141c', card: '#181c27', s2: '#1d2230' },
};

for (const b of Object.keys(blocks)) {
  test(`${b}: muted labels, faded month heads and margin notes reach 4.5:1 on every sheet`, () => {
    for (const name of ['--muted', '--muted-2', '--pencil']) {
      for (const [surf, hex] of Object.entries(paper[b])) {
        const r = ratio(token(name, b), hex);
        assert.ok(r >= 4.5, `${name} on ${surf} is ${r.toFixed(2)}:1`);
      }
    }
  });
  test(`${b}: rail section labels reach 4.5:1 on the lightest end of the rail`, () => {
    const top = toHex(mix(token('--rail-2', b), token('--rail', b), 0.5));
    const r = ratio(token('--rail-ink-2', b), top);
    assert.ok(r >= 4.5, `--rail-ink-2 on the rail is ${r.toFixed(2)}:1`);
  });
}
