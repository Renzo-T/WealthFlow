// Shared building blocks, so every page's cards and headers look and space the same.
import { useState, useRef, Component } from 'react';
import { createPortal } from 'react-dom';

// A card with a header row: title on the left, actions (links, toggles, legends) on the right.
export function Panel({ title, actions, className = '', children, ...rest }) {
  return (
    <section className={`card panel ${className}`.trim()} {...rest}>
      {(title || actions) && <div className="head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

// Page title and subtitle, with optional actions on the right.
export function PageHeader({ title, sub, children }) {
  return <div className="top"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>{children}</div>;
}

// A dollar figure that "Hide amounts" can blur. Use for amounts outside the usual amount classes.
export const Amt = ({ children, className = '' }) => <span className={`amt ${className}`.trim()}>{children}</span>;

// ---- Loading placeholders: grey shapes in the real layout, so nothing jumps when data arrives.
export const Skeleton = ({ h = 14, w = '100%', r = 8, className = '' }) => (
  <span className={`skel ${className}`.trim()} style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />
);

export function PanelSkeleton({ lines = 4, chart = 0 }) {
  return (
    <section className="card panel" aria-busy="true">
      <div className="head"><Skeleton w="40%" h={16} /></div>
      {chart > 0 && <Skeleton h={chart} r={10} />}
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={`${90 - ((i * 17) % 35)}%`} className="skel-line" />)}
    </section>
  );
}

const StatSkeleton = () => (
  <div className="card" aria-busy="true"><Skeleton w="45%" /><Skeleton w="60%" h={30} className="skel-line" /><Skeleton w="35%" className="skel-line" /></div>
);

// Same grid areas as Dashboard.jsx, so the real panels land where the placeholders were.
export function DashboardSkeleton() {
  return (
    <div className="dash" aria-label="Loading your dashboard">
      <div className="a-cards"><div className="cards">{[0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)}</div></div>
      <div className="a-nw"><PanelSkeleton lines={1} chart={230} /></div>
      <div className="a-alloc"><PanelSkeleton lines={5} chart={120} /></div>
      <div className="a-up"><PanelSkeleton lines={8} chart={150} /></div>
      <div className="a-recent"><PanelSkeleton lines={5} /></div>
      <div className="a-cf"><PanelSkeleton lines={0} chart={200} /></div>
      <div className="a-top"><PanelSkeleton lines={5} /></div>
    </div>
  );
}

export function PageSkeleton({ panels = 2 }) {
  return (
    <div aria-label="Loading">
      <div className="top"><div><Skeleton w={220} h={30} /><Skeleton w={360} className="skel-line" /></div></div>
      {Array.from({ length: panels }, (_, i) => <div className="mt" key={i}><PanelSkeleton lines={i ? 6 : 2} chart={i ? 0 : 180} /></div>)}
    </div>
  );
}

// A panel with nothing to show yet: an icon, a short headline, one sentence, and a way to start. Never just a line
// of grey text.
const EMPTY_ICONS = {
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  plan: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5M8 17h3" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
};
export function EmptyState({ icon = 'chart', title, children, actions }) {
  return (
    <div className="estate">
      <span className="estate-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{EMPTY_ICONS[icon]}</svg></span>
      <div><b>{title}</b>{children && <p>{children}</p>}{actions && <div className="estate-actions">{actions}</div>}</div>
    </div>
  );
}

// Hover (or keyboard focus) detail for a number or label: "4 accounts" -> which accounts and how much in each.
// The card is portalled to <body> with fixed positioning, so scrolling tables don't clip it, and it flips
// above or to the left near the window's edges. A dotted underline marks anything with more on hover.
export function Hover({ tip, children, className = '' }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  if (!tip) return children;
  const show = () => {
    const r = ref.current.getBoundingClientRect();
    setPos({ left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      flipX: r.left > window.innerWidth - 320, flipY: r.bottom > window.innerHeight - 240 });
  };
  const hide = () => setPos(null);
  const style = pos && {
    ...(pos.flipX ? { right: window.innerWidth - pos.right } : { left: pos.left }),
    ...(pos.flipY ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.bottom + 6 }),
  };
  return (
    <span ref={ref} className={`hov ${className}`.trim()} tabIndex={0} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && createPortal(<div className="hovtip" role="tooltip" style={style}>{tip}</div>, document.body)}
    </span>
  );
}

// The usual tooltip body: a title, label/value rows (with an optional muted note per row), then an optional note.
export function TipList({ title, rows, note }) {
  return (
    <>
      {title && <div className="hovtitle">{title}</div>}
      <ul>{rows.map(([label, value, sub], i) => (
        <li key={i}><span>{label}{sub && <span className="muted"> · {sub}</span>}</span><b className="amt">{value}</b></li>))}</ul>
      {note && <div className="muted hovnote">{note}</div>}
    </>
  );
}

// If a page throws while drawing, show what went wrong there instead of blanking the whole app; the sidebar and other
// pages keep working (it's keyed by page, so moving to another page starts fresh).
export class PageBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Page error:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mt pageerror" role="alert">
        <b>This page hit a problem.</b>
        <p className="small muted">The rest of WealthFlow still works. Reloading usually fixes it; if not, the details below help find the cause.</p>
        <pre className="small">{String(this.state.error?.message ?? this.state.error)}</pre>
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
