// Journals: the colour presets you pick in Settings › Journal. Each one is a cover (the rail, the net worth cell and
// primary buttons), a paper (page, sheets, tint and ruling), an ink (links, meters, paid stamps), a highlighter, a set
// of three washi tapes and a margin doodle, with its own night steps. Everything else stays the same in every journal:
// the ink and muted text, green and red, amber, the chart series and the vermillion seal (DESIGN.md › Journals).
//
// This file is the one source of the journal tokens: main.jsx injects journalCss() after styles.css, and
// tests/journals.test.js checks every journal's contrast in both themes. No DOM here, so the test can import it.

// rail2 is the cover fold (the active tab). btn is the primary button (the cover in daylight, a lighter cloth
// at night so it reads on dark sheets). noteInk is the text of news chips.
export const JOURNALS = {
  indigo: {
    name: 'Indigo', desc: 'Cloth-bound indigo on warm white dot-grid paper, with a yellow highlighter.', ruling: 'dots', doodle: 'star',
    light: { rail: '#1e2a47', rail2: '#2b3b63', railInk: '#c5ccdd', railInk2: '#a9b2c8', btn: '#1e2a47', btnHover: '#2b3b63', bg: '#f2f0e9', card: '#fffefc', tint: '#f8f6f0', dot: '#d9d9d0', accent: '#2d4a93', soft: '#e8ecf5', noteInk: '#2d4a93', inkDot: '#26355c', hi: '#ffe27a' },
    dark: { rail: '#1a2440', rail2: '#283a66', railInk: '#aab4cc', railInk2: '#8f9bbb', btn: '#3c58a8', btnHover: '#4a67b8', bg: '#11141c', card: '#181c27', tint: '#1d2230', dot: '#191e23', accent: '#9db2ea', soft: '#222a40', noteInk: '#afc0ee', inkDot: '#a9b9e6', hi: '#5a4c12' },
    tapes: [['stripe', '#b9c8ec', '#e2e8f6'], ['dots', '#f6df98', '#fff8e0'], ['grid', '#ece7da', '#c3cbe0']],
  },
  plum: {
    name: 'Plum', desc: 'Aubergine cloth on cream dot-grid paper, with a pink highlighter.', ruling: 'dots', doodle: 'moon',
    light: { rail: '#3a2140', rail2: '#56305e', railInk: '#dccbe0', railInk2: '#bfa9c4', btn: '#3a2140', btnHover: '#56305e', bg: '#f3eee5', card: '#fffcf7', tint: '#f8f2e9', dot: '#dcd2c4', accent: '#6a3a86', soft: '#f1e7f4', noteInk: '#6a3a86', inkDot: '#43285a', hi: '#ffbcd6' },
    dark: { rail: '#2a1630', rail2: '#45274e', railInk: '#c8b4cd', railInk2: '#a892ae', btn: '#6a3f78', btnHover: '#7a4a89', bg: '#15111a', card: '#1e1824', tint: '#251d2c', dot: '#211a27', accent: '#d2aee6', soft: '#2f2338', noteInk: '#ddc0ec', inkDot: '#cdb3e3', hi: '#6b2a4a' },
    tapes: [['stripe', '#efc3cf', '#f8e4e9'], ['grid', '#e2d6f0', '#b9a5d6'], ['solid', '#f6cdb2']],
  },
  charcoal: {
    name: 'Charcoal', desc: 'A black cover on bright white grid paper, with an orange highlighter.', ruling: 'grid', doodle: 'plane',
    light: { rail: '#25262a', rail2: '#3b3d44', railInk: '#c9cbd1', railInk2: '#a9acb4', btn: '#25262a', btnHover: '#3b3d44', bg: '#f3f3f0', card: '#ffffff', tint: '#f7f7f4', dot: '#e0e0db', accent: '#24478f', soft: '#e7ecf6', noteInk: '#24478f', inkDot: '#202226', hi: '#ffc685' },
    dark: { rail: '#1b1c1f', rail2: '#33353b', railInk: '#b9bbc2', railInk2: '#9a9ca4', btn: '#4a4d55', btnHover: '#575a63', bg: '#121213', card: '#1b1b1d', tint: '#222224', dot: '#1d1d20', accent: '#a3bbec', soft: '#24283a', noteInk: '#b6c8f0', inkDot: '#d6d7db', hi: '#6e4519' },
    tapes: [['stripe', '#cfcfca', '#f3f2ee'], ['solid', '#d9bd94'], ['dots', '#ffd9ae', '#e58c3a']],
  },
  saddle: {
    name: 'Saddle', desc: 'Tan leather on kraft-tinted dot-grid paper, with an apricot highlighter.', ruling: 'dots', doodle: 'sprig',
    light: { rail: '#56371f', rail2: '#643f26', railInk: '#ead6c2', railInk2: '#cfb59c', btn: '#56371f', btnHover: '#643f26', bg: '#ebe2d0', card: '#fdf9f0', tint: '#f6eedf', dot: '#d3c4a9', accent: '#2c4a7a', soft: '#e6ebf3', noteInk: '#2c4a7a', inkDot: '#3a2a1c', hi: '#ffcfa6' },
    dark: { rail: '#382313', rail2: '#553722', railInk: '#cdb8a2', railInk2: '#b29c86', btn: '#7a5434', btnHover: '#8a6040', bg: '#16120d', card: '#1f1913', tint: '#271f17', dot: '#221b14', accent: '#a8c0e8', soft: '#252a35', noteInk: '#b9cdee', inkDot: '#e0cdb5', hi: '#6c4320' },
    tapes: [['stripe', '#d2b58f', '#ebdcc6'], ['dots', '#b4c3da', '#eef1f6'], ['gingham', '#e7c27a', '#f8ecd0']],
  },
  slate: {
    name: 'Slate', desc: 'Blue-grey cloth on cool white lined paper, with a lavender highlighter.', ruling: 'lines', doodle: 'cloud',
    light: { rail: '#313f4b', rail2: '#3b4a57', railInk: '#cdd7df', railInk2: '#aebbc6', btn: '#313f4b', btnHover: '#3b4a57', bg: '#edf0f1', card: '#fcfdfd', tint: '#f3f6f7', dot: '#d6dde1', accent: '#2f5786', soft: '#e5edf5', noteInk: '#2f5786', inkDot: '#283846', hi: '#d8c9ff' },
    dark: { rail: '#212b34', rail2: '#34424f', railInk: '#b3c0cb', railInk2: '#95a3af', btn: '#4b6072', btnHover: '#586f83', bg: '#0f1316', card: '#172026', tint: '#1d272e', dot: '#1a2228', accent: '#9fc4e8', soft: '#1f2c38', noteInk: '#b3d2ee', inkDot: '#b5cce0', hi: '#463a72' },
    tapes: [['stripe', '#bcd6ec', '#e5eff8'], ['grid', '#e6dffa', '#b8a8e8'], ['dots', '#dde2e6', '#9aa6b0']],
  },
};
export const DEFAULT_JOURNAL = 'indigo';

// The page's ruling, drawn in --dot. Its marks fall on whole grid units (--u) from the page's padding-box corner, the
// origin every box lines up to (grid.js): a dot centred on each crossing, grid lines and ruled lines on each unit's edge.
// The unit (--u) steps with the window's width, so the ruling does too.
const RULING = {
  dots: 'radial-gradient(circle, var(--dot) 1px, transparent 1.3px) calc(var(--u) / -2) calc(var(--u) / -2) / var(--u) var(--u)',
  grid: 'linear-gradient(var(--dot) 1px, transparent 1px) 0 0 / var(--u) var(--u), linear-gradient(90deg, var(--dot) 1px, transparent 1px) 0 0 / var(--u) var(--u)',
  lines: 'linear-gradient(var(--dot) 1px, transparent 1px) 0 0 / 100% var(--u)',
};
export const RULING_NAME = { dots: 'dot grid', grid: 'square grid', lines: 'ruled lines' };

// A washi tape's pattern: [kind, colour a, colour b].
export function tapeBackground([kind, a, b]) {
  if (kind === 'stripe') return `repeating-linear-gradient(-45deg, ${a} 0 6px, ${b} 6px 12px)`;
  if (kind === 'dots') return `radial-gradient(${b} 1.6px, transparent 2px) 0 0 / 8px 8px, ${a}`;
  if (kind === 'grid') return `linear-gradient(${b} 1px, transparent 1px) 0 0 / 7px 7px, linear-gradient(90deg, ${b} 1px, transparent 1px) 0 0 / 7px 7px, ${a}`;
  if (kind === 'gingham') return `linear-gradient(90deg, color-mix(in srgb, ${a} 55%, transparent) 50%, transparent 50%) 0 0 / 12px 12px, linear-gradient(color-mix(in srgb, ${a} 55%, transparent) 50%, transparent 50%) 0 0 / 12px 12px, ${b}`;
  return `linear-gradient(90deg, rgba(0, 0, 0, .03), transparent 30%, rgba(255, 255, 255, .1) 70%, transparent), ${a}`;
}

// The margin doodles, drawn in pencil (used as a mask, so the stroke colour comes from CSS).
const DOODLE_PATHS = {
  star: '<path d="M20 4.4 L24.3 15.2 L35.7 15.3 L26.8 22.6 L30.6 33.8 L20.2 27.2 L9.6 34.1 L13.3 22.4 L4.2 15.6 L15.8 14.9 Z"/><path d="M33 4 l2 2 M36 9 h3"/>',
  moon: '<path d="M24 5 A15 15 0 1 0 35 27 A11.5 11.5 0 1 1 24 5 Z"/><path d="M33 8 v4 M31 10 h4"/>',
  plane: '<path d="M4 20 L36 6 L26 34 L19 23 Z"/><path d="M19 23 L36 6 M19 23 l-1 8"/><path d="M5 31 q4 -3 8 -1" stroke-dasharray="2 2.5"/>',
  sprig: '<path d="M9 35 C15 27 21 18 32 6"/><path d="M15 27 C10 24 9 19 12 16 C16 19 17 23 15 27 Z"/><path d="M21 19 C17 15 17 10 21 8 C24 12 24 16 21 19 Z"/><path d="M19 24 C24 23 28 25 30 29 C25 30 21 28 19 24 Z"/><path d="M26 13 C30 11 34 12 36 15 C32 17 28 16 26 13 Z"/>',
  cloud: '<path d="M10 28 Q3 28 5 22 Q6 16 13 17 Q15 9 23 11 Q30 8 32 16 Q38 17 36 24 Q35 28 29 28 Z"/><path d="M12 33 l-1 3 M19 33 l-1 3 M26 33 l-1 3"/>',
};
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
export const doodleUrl = (name) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${DOODLE_PATHS[name]}</svg>`);

const NAMES = { rail: '--rail', rail2: '--rail-2', railInk: '--rail-ink', railInk2: '--rail-ink-2', btn: '--btn', btnHover: '--btn-hover',
  bg: '--bg', card: '--card', tint: '--surface-2', dot: '--dot', accent: '--blue', soft: '--soft', noteInk: '--note-ink', inkDot: '--ink-dot', hi: '--hi' };
const decls = (o) => Object.entries(o).map(([k, v]) => `${NAMES[k]}: ${v};`).join(' ');

// The CSS for every journal: daylight tokens on :root[data-journal], night tokens when the system or the toggle is dark.
// Injected after styles.css; the extra attribute in each selector makes it win over styles.css's own token blocks.
export function journalCss() {
  let css = '';
  for (const [id, j] of Object.entries(JOURNALS)) {
    const sel = `:root[data-journal="${id}"]`;
    const shared = `--ruling: ${RULING[j.ruling]}; --doodle: ${doodleUrl(j.doodle)}; ${j.tapes.map((t, i) => `--tape${i + 1}: ${tapeBackground(t)};`).join(' ')}`;
    css += `${sel} { ${decls(j.light)} ${shared} }\n`;
    css += `@media (prefers-color-scheme: dark) { ${sel}:not([data-theme="light"]) { ${decls(j.dark)} } }\n`;
    css += `${sel}[data-theme="dark"] { ${decls(j.dark)} }\n`;
  }
  return css;
}
