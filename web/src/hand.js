// Hand-drawn pencil marks: lines that wander a little, boxes whose strokes overshoot their corners, circles that don't
// quite close. A material, like the paper grain: it says "drawn by hand" and marks nothing. Seeded, so a mark keeps
// its shape every time it is drawn. Used for the dashed "still due" stamps; figures, dots, bars and chart lines are
// never roughened (DESIGN.md › Hand-drawn marks).

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const jit = (r, amp) => (r() * 2 - 1) * amp;
const f = (n) => Math.round(n * 100) / 100;

// A smooth path through points (quadratic curves between midpoints).
function smooth(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
  }
  const l = pts[pts.length - 1];
  return `${d} L${f(l[0])} ${f(l[1])}`;
}

export function handLine(x1, y1, x2, y2, r, amp = 0.5, n = 3) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + (x1 === x2 ? 0 : jit(r, amp))].map((v, k) => (x1 === x2 && k === 0 ? v + jit(r, amp) : v)));
  }
  return smooth(pts);
}

// A box of four separate strokes, each running a little past its corner.
export function handRect(x, y, w, h, seed, amp = 0.45) {
  const r = rng(seed), o = Math.max(0.6, w * 0.07);
  return [
    handLine(x - o, y + jit(r, 0.3), x + w + jit(r, 0.5), y, r, amp),
    handLine(x + w, y - o * 0.5, x + w + jit(r, 0.3), y + h + o, r, amp),
    handLine(x + w + o, y + h, x + jit(r, 0.5), y + h + jit(r, 0.3), r, amp),
    handLine(x, y + h + o * 0.4, x + jit(r, 0.3), y - o * 0.3, r, amp),
  ].join(' ');
}

// A circle drawn in one stroke that runs slightly past where it started.
export function handCircle(cx, cy, rad, seed, amp = 0.4) {
  const r = rng(seed), n = 12, start = -1.2 + jit(r, 0.4), turn = Math.PI * 2 * 1.07, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * turn, rr = rad + jit(r, amp);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smooth(pts);
}
