// Shared building blocks, so every page's cards and headers look and space the same.
import { useState, useRef, useEffect, useContext, createContext, Component } from 'react';
import { createPortal } from 'react-dom';

// The Mizo Money seal: a round ink stamp with an M, like a hanko pressed on a planner page. The logo only; vermillion
// is never used for meaning (red stays "bad / money out").
export function Seal({ size = 30 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--seal)" />
      <circle cx="16" cy="16" r="12.6" fill="none" stroke="var(--seal-ink)" strokeWidth="1" opacity=".55" />
      <path d="M9.6 21.6V10.8l6.4 7 6.4-7v10.8" fill="none" stroke="var(--seal-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Up / down marker for a change (drawn, so it matches the icon set; the number beside it carries the meaning).
export const Trend = ({ up }) => (
  <svg className="trend" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d={up ? 'M5 1.5L9 8.5H1z' : 'M5 8.5L1 1.5h8z'} fill="currentColor" />
  </svg>
);

// Small drawn icons in the same stroke as the navigation, for controls that used to be text glyphs.
const ico = (d, size = 14) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const Chevron = ({ dir = 'right', size }) => ico(<path d={dir === 'left' ? 'M8.5 3L4.5 7l4 4' : 'M5.5 3l4 4-4 4'} />, size);
// The check is drawn by hand: a short dip, then a long stroke that curves as it rises.
export const Check = ({ size }) => ico(<path d="M2.8 7.6c.9.7 1.8 1.6 2.7 2.6C7 8 8.7 6 11.3 4.1" />, size);
// Migrated (bullet-journal ">"): money carried forward into the next month.
export const Migrate = ({ size = 12 }) => ico(<path d="M5 3.3c1.5 1.2 3 2.4 4.4 3.8C8 8.3 6.5 9.5 5.1 10.8" />, size);
export const Close = ({ size = 12 }) => ico(<path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />, size);
export const Repeat = ({ size = 12 }) => ico(<><path d="M3 6.2A4 4 0 0110.4 4.6M11 3v2.2H8.8" /><path d="M11 7.8A4 4 0 013.6 9.4M3 11V8.8h2.2" /></>, size);

// A card with a header row: title on the left, actions (links, toggles, legends) on the right.
export function Panel({ title, actions, className = '', children, ...rest }) {
  return (
    <section className={`card panel ${className}`.trim()} {...rest}>
      {(title || actions) && <div className="head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

// The app's own tools (notice chips, the theme and Hide amounts buttons), set by App.jsx: every page header shows them at
// the right of its title row, after the page's own actions, so no page needs a row above its title.
export const HeaderTools = createContext(null);

// Page title and subtitle, with the page's actions and the app's tools on the right.
export function PageHeader({ title, sub, children }) {
  const tools = useContext(HeaderTools);
  return (
    <div className="top"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
      {(children || tools) && <div className="topact">{children}{tools}</div>}</div>
  );
}

// A dollar figure that "Hide amounts" can blur. Use for amounts outside the usual amount classes.
// Hide amounts is on (for text that can't be blurred, like a native tooltip).
export const amountsHidden = () => document.body.classList.contains('privacy');
// Text for a native tooltip (title=): with Hide amounts on, dollar amounts become "$•••".
export const tipText = (s) => (s && amountsHidden() ? s.replace(/[+−-]?\$\s?[\d,]+(\.\d+)?/g, '$•••') : s);
export const Amt = ({ children, className = '' }) => <span className={`amt ${className}`.trim()}>{children}</span>;

// Ink and pencil: a known figure is ink, an estimated one is pencil (muted, dashed underline). `why` says what makes it an
// estimate, in words only (no dollar amounts). Put it inside an element Hide amounts blurs (.amt, .tamt, td.r, <Amt>).
export const Est = ({ why, children, className = '' }) => <span className={`est-fig ${className}`.trim()} title={why}>{children}</span>;

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

const SkeletonTools = () => useContext(HeaderTools);

export function PageSkeleton({ panels = 2 }) {
  return (
    <div aria-label="Loading">
      <div className="top"><div><Skeleton w={220} h={30} /><Skeleton w={360} className="skel-line" /></div><div className="topact"><SkeletonTools /></div></div>
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
// `art` names a drawing in web/public/art (empty-<art>.webp) shown in place of the icon, for a page's main empty state.
export function EmptyState({ icon = 'chart', art, title, children, actions }) {
  return (
    <div className={`estate${art ? ' has-art' : ''}`}>
      {art ? <span className="estate-art" aria-hidden="true"><img src={`/art/empty-${art}.webp`} alt="" width="96" height="96" loading="lazy" /></span>
        : <span className="estate-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{EMPTY_ICONS[icon]}</svg></span>}
      <div><b>{title}</b>{children && <p>{children}</p>}{actions && <div className="estate-actions">{actions}</div>}</div>
    </div>
  );
}

// Hover (or keyboard focus) detail for a number or label: "4 accounts" -> which accounts and how much in each.
// The card is portalled to <body> with fixed positioning, so scrolling tables don't clip it, and it flips
// above or to the left near the window's edges. A dotted underline marks anything with more on hover.
// `tabbable={false}` when the child is itself focusable (a button): its focus still opens the tip, with one tab stop.
export function Hover({ tip, children, className = '', tabbable = true }) {
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
    <span ref={ref} className={`hov ${className}`.trim()} tabIndex={tabbable ? 0 : undefined} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && createPortal(<div className="hovtip" role="tooltip" style={style}>{tip}</div>, document.body)}
    </span>
  );
}

// The usual tooltip body: a title, label/value rows (with an optional muted note per row), then an optional note.
export function TipList({ title, rows = [], note }) {
  return (
    <>
      {title && <div className="hovtitle">{title}</div>}
      {rows.length > 0 && <ul>{rows.map(([label, value, sub], i) => (
        <li key={i}><span>{label}{sub && <span className="muted"> · {sub}</span>}</span><b className="amt">{value}</b></li>))}</ul>}
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
        <p className="small muted">The rest of Mizo Money still works. Reloading usually fixes it; if not, the details below help find the cause.</p>
        <pre className="small">{String(this.state.error?.message ?? this.state.error)}</pre>
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

// ---- In-app dialogs and the undo toast (replace the browser's alert / confirm / prompt) ----
// A module-level store: callers await a promise, <DialogHost /> (mounted once in App.jsx) renders the current dialog.
const dlg = { state: null, toast: null, subs: new Set(), seq: 0 };
const emit = () => dlg.subs.forEach((f) => f());
const openDialog = (spec) => new Promise((resolve) => {
  dlg.state?.done(dlg.state.kind === 'confirm' ? false : null); // a new dialog replaces an unanswered one
  dlg.state = { ...spec, id: ++dlg.seq, done: (v) => { if (dlg.state?.id === dlg.seq) dlg.state = null; resolve(v); emit(); } };
  emit();
});
export const confirmDialog = ({ title, body, confirm = 'OK', cancel = 'Cancel', danger = false }) =>
  openDialog({ kind: 'confirm', title, body, confirm, cancel, danger });
export const notice = ({ title, body }) => openDialog({ kind: 'notice', title, body, confirm: 'OK' }).then(() => undefined);
export const askText = ({ title, label, value = '' }) => openDialog({ kind: 'text', title, label, value, confirm: 'Save', cancel: 'Cancel' });
let toastTimer = null;
export function toast(message, { undo } = {}) {
  clearTimeout(toastTimer);
  dlg.toast = { id: ++dlg.seq, message, undo };
  emit();
  toastTimer = setTimeout(() => { dlg.toast = null; emit(); }, 6000);
}
const closeToast = () => { clearTimeout(toastTimer); dlg.toast = null; emit(); };

export function DialogHost() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); dlg.subs.add(f); return () => dlg.subs.delete(f); }, []);
  const d = dlg.state, t = dlg.toast;
  return (
    <>
      {d && <DialogSheet key={d.id} d={d} />}
      {t && (
        <div className="toast" role="status" key={t.id}>
          <span>{t.message}</span>
          {t.undo && <button type="button" className="toast-undo" onClick={async () => { closeToast(); await t.undo(); }}>Undo</button>}
        </div>
      )}
    </>
  );
}

function DialogSheet({ d }) {
  const ref = useRef(null), [text, setText] = useState(d.value ?? '');
  useEffect(() => { const el = ref.current; if (el && !el.open) el.showModal(); }, []);
  const cancelled = d.kind === 'confirm' ? false : null;
  const ok = () => d.done(d.kind === 'confirm' ? true : d.kind === 'text' ? text : undefined);
  const paras = d.body ? String(d.body).split('\n\n') : [];
  return (
    <dialog ref={ref} className="dlg" aria-labelledby="dlg-title"
      onCancel={(e) => { e.preventDefault(); d.done(cancelled); }}
      onClick={(e) => { if (e.target === ref.current) d.done(cancelled); }}>
      <form onSubmit={(e) => { e.preventDefault(); ok(); }}>
        <h2 id="dlg-title" className="dlg-title">{d.title}</h2>
        {paras.map((p, i) => <p key={i} className="dlg-body">{p}</p>)}
        {d.kind === 'text' && (
          <label className="dlg-field">{d.label && <span>{d.label}</span>}
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}
        <div className="dlg-actions">
          {d.kind !== 'notice' && <button type="button" className="btn" onClick={() => d.done(cancelled)}>{d.cancel}</button>}
          <button type="submit" autoFocus={d.kind !== 'text'} className={d.danger ? 'btn dlg-danger' : 'btn primary'}>{d.confirm}</button>
        </div>
      </form>
    </dialog>
  );
}
