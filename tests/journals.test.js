import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JOURNALS, DEFAULT_JOURNAL, RULING_NAME, journalCss } from '../web/src/journals.js';

// Paper-white: the text on covers and primary buttons, the same in every journal.
const WHITE = '#fffdf7';
const CSS = readFileSync(new URL('../web/src/styles.css', import.meta.url), 'utf8');

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Each journal is a complete ink set, its own neutrals included: [foreground, colour, background, colour, minimum].
function pairs(theme, j) {
  const t = j[theme];
  return [
    ['ink', t.ink, 'bg', t.bg], ['ink', t.ink, 'card', t.card], ['ink', t.ink, 'tint', t.tint], ['ink', t.ink, 'soft', t.soft],
    ['muted', t.muted, 'bg', t.bg], ['muted', t.muted, 'card', t.card], ['muted', t.muted, 'tint', t.tint],
    ['muted2', t.muted2, 'card', t.card], ['pencil', t.pencil, 'card', t.card],
    ['accent', t.accent, 'card', t.card], ['accent', t.accent, 'bg', t.bg], ['accent', t.accent, 'soft', t.soft],
    ['noteInk', t.noteInk, 'soft', t.soft],
    ['railInk', t.railInk, 'rail', t.rail], ['railInk', t.railInk, 'rail2', t.rail2],
    ['white', WHITE, 'rail', t.rail], ['white', WHITE, 'rail2', t.rail2],
    ['white', WHITE, 'btn', t.btn], ['white', WHITE, 'btnHover', t.btnHover],
    ['hiInk', t.hiInk, 'hi', t.hi],
    // A panel's pencil line has to show on the paper (a graphic, not text: 1.4:1 keeps it a line, not a smudge).
    ['lineStrong', t.lineStrong, 'bg', t.bg, 1.4],
  ];
}

for (const [id, j] of Object.entries(JOURNALS)) {
  for (const theme of ['light', 'dark']) {
    test(`journal ${id} ${theme}: contrast >= 4.5`, () => {
      const fails = [];
      for (const [fn, fc, bn, bc, min = 4.5] of pairs(theme, j)) {
        const r = ratio(fc, bc);
        if (r < min) fails.push(`${id} ${theme}: ${fn} ${fc} on ${bn} ${bc} = ${r.toFixed(2)}`);
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
    const j = JOURNALS[id];
    assert.ok(css.includes(`--bg: light-dark(${j.light.bg}, ${j.dark.bg});`), `${id} paper in both themes`);
  }
  assert.ok(!css.includes('undefined'));
});

// The ruling is the layout grid, and it has to show in both themes without getting busy: dots between 1.18 and 1.4
// against the paper (they're small), square-grid and ruled lines quieter (they run through the figures), 1.1 to 1.2.
test('the ruling shows on the paper in both themes', () => {
  const fails = [];
  for (const [id, j] of Object.entries(JOURNALS)) for (const theme of ['light', 'dark']) {
    const r = ratio(j[theme].dot, j[theme].bg), [lo, hi] = j.ruling === 'dots' ? [1.18, 1.4] : [1.1, 1.2];
    if (r < lo || r > hi) fails.push(`${id} ${theme}: ${j.ruling} ${j[theme].dot} on ${j[theme].bg} = ${r.toFixed(2)} (want ${lo}-${hi})`);
  }
  assert.deepEqual(fails, []);
});

// At night the highlighter is a bright marker with the daylight ink on it (DESIGN.md › Highlighter), not a dark smudge.
test('the night highlighter is a bright marker carrying daylight ink', () => {
  for (const [id, j] of Object.entries(JOURNALS)) {
    assert.ok(lum(j.dark.hi) > 0.3, `${id}: night highlighter ${j.dark.hi} is too dark to read as a marker`);
    assert.equal(j.dark.hiInk, j.light.ink, `${id}: night highlighter ink`);
    assert.equal(j.light.hiInk, j.light.ink, `${id}: daylight highlighter ink`);
  }
});

// styles.css carries the default journal's colours for the first paint, before journals.js runs. They must match.
const NAMES = { rail: '--rail', rail2: '--rail-2', railInk: '--rail-ink', railInk2: '--rail-ink-2', btn: '--btn', btnHover: '--btn-hover',
  bg: '--bg', card: '--card', tint: '--surface-2', dot: '--dot', ink: '--ink', muted: '--muted', muted2: '--muted-2', line: '--line',
  lineStrong: '--line-strong', pencil: '--pencil', accent: '--blue', soft: '--soft', noteInk: '--note-ink', inkDot: '--ink-dot', hi: '--hi', hiInk: '--hi-ink' };
const token = (name) => CSS.match(new RegExp(`${name}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\)`, 'i'))?.slice(1);
test("styles.css's first-paint tokens are the default journal's", () => {
  const j = JOURNALS[DEFAULT_JOURNAL];
  for (const [k, name] of Object.entries(NAMES)) assert.deepEqual(token(name), [j.light[k], j.dark[k]], `${name} in styles.css`);
});

// Chart series 1-4 and the grey after them stay apart under protanopia, deuteranopia and tritanopia (Machado 2009,
// full severity): at least 7 ΔE in CIELAB, in both themes. At night they also sit in one lightness band, so no series
// (a debt bar, say) glows brighter than the rest.
test('chart series stay apart for colour-blind eyes, in one lightness band at night', () => {
  const series = ['--s1', '--s2', '--s3', '--s4', '--neutral'].map(token);
  const M = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const lab = ([r, g, b]) => {
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const sim = (hex, m) => { const c = rgb(hex).map(lin); return m.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2]))); };
  for (const [t, theme] of [[0, 'light'], [1, 'dark']]) {
    const cols = series.map((p) => p[t]);
    for (const [kind, m] of Object.entries(M)) for (let i = 0; i < cols.length; i++) for (let k = i + 1; k < cols.length; k++) {
      const [a, b] = [lab(sim(cols[i], m)), lab(sim(cols[k], m))];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(d >= 7, `${theme} ${kind}: ${cols[i]} and ${cols[k]} are only ${d.toFixed(1)} ΔE apart`);
    }
  }
  const L = series.slice(0, 4).map(([, night]) => lab(rgb(night).map(lin))[0]);
  assert.ok(Math.max(...L) - Math.min(...L) <= 12, `night series lightness spread ${(Math.max(...L) - Math.min(...L)).toFixed(1)} L*`);
});
