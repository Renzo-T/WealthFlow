import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOURNALS, DEFAULT_JOURNAL, RULING_NAME, journalCss } from '../web/src/journals.js';

const FIXED = {
  light: { ink: '#1b2030', muted: '#4c5365', white: '#fffdf7' },
  dark: { ink: '#e7e9ef', muted: '#adb3c3', white: '#fffdf7' },
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function pairs(theme, j, f) {
  const t = j[theme];
  const list = [
    ['ink', f.ink, 'bg', t.bg], ['ink', f.ink, 'card', t.card], ['ink', f.ink, 'tint', t.tint],
    ['muted', f.muted, 'bg', t.bg], ['muted', f.muted, 'card', t.card], ['muted', f.muted, 'tint', t.tint],
    ['accent', t.accent, 'card', t.card], ['accent', t.accent, 'soft', t.soft],
    ['noteInk', t.noteInk, 'soft', t.soft],
    ['railInk', t.railInk, 'rail', t.rail], ['railInk', t.railInk, 'rail2', t.rail2],
    ['white', f.white, 'rail', t.rail], ['white', f.white, 'rail2', t.rail2],
    ['white', f.white, 'btn', t.btn], ['white', f.white, 'btnHover', t.btnHover],
    ['ink', f.ink, 'hi', t.hi],
  ];
  return list;
}

for (const [id, j] of Object.entries(JOURNALS)) {
  for (const theme of ['light', 'dark']) {
    test(`journal ${id} ${theme}: contrast >= 4.5`, () => {
      const fails = [];
      for (const [fn, fc, bn, bc] of pairs(theme, j, FIXED[theme])) {
        const r = ratio(fc, bc);
        if (r < 4.5) fails.push(`${id} ${theme}: ${fn} ${fc} on ${bn} ${bc} = ${r.toFixed(2)}`);
      }
      assert.deepEqual(fails, []);
    });
  }
}

test('journal structure', () => {
  const keys = (o) => Object.keys(o).sort().join();
  const base = Object.values(JOURNALS)[0];
  const lightKeys = keys(base.light);
  const darkKeys = keys(base.dark);
  assert.equal(darkKeys, lightKeys);
  for (const [id, j] of Object.entries(JOURNALS)) {
    assert.equal(keys(j.light), lightKeys, `${id} light keys`);
    assert.equal(keys(j.dark), darkKeys, `${id} dark keys`);
    for (const theme of ['light', 'dark'])
      for (const [k, v] of Object.entries(j[theme])) assert.match(v, /^#[0-9a-f]{6}$/i, `${id} ${theme}.${k}`);
    assert.equal(j.tapes.length, 3, `${id} tapes`);
    assert.ok(j.ruling in RULING_NAME, `${id} ruling`);
  }
  assert.ok(DEFAULT_JOURNAL in JOURNALS);
});

test('journalCss covers every journal', () => {
  const css = journalCss();
  for (const id of Object.keys(JOURNALS)) {
    assert.ok(css.includes(`:root[data-journal="${id}"]`), `${id} selector`);
    assert.ok(css.includes(`:root[data-journal="${id}"][data-theme="dark"]`), `${id} dark block`);
  }
  assert.ok(!css.includes('undefined'));
});
