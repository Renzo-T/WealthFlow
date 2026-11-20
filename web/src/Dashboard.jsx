import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { DashboardSkeleton, Trend, Check } from './ui.jsx';
import Cards from './Cards.jsx';
import MonthSpread from './MonthSpread.jsx';
import { GlanceSide, GlanceBudget } from './Glance.jsx';
import NetWorthChart from './NetWorthChart.jsx';
import AssetAllocation from './AssetAllocation.jsx';
import CashFlow from './CashFlow.jsx';
import Categories from './Categories.jsx';
import { RecentTransactions } from './Transactions.jsx';
import { GoalsPanel } from './Goals.jsx';
import { InsightStrip, FrequentPanel, WatchlistPanel, InvestmentsCard } from './Insights.jsx';
import { defaultLayout, mergeLayout } from './layout.js';
import { unit } from './grid.js';

// Every dashboard panel, in default order. `span` is its width in a 3-column row (3 = full width); `rail` means it
// sits in the right-hand column on wide screens by default. To add a panel: add it here; saved layouts pick it
// up at its default position automatically. `span` may be a function of the dashboard's data (Goals sits beside a one-item Watchlist and runs full
// width under a longer one, so the board has no gaps). `hidden` panels start hidden for new or reset layouts only (a saved layout keeps what it shows). `lead` panels (where you stand, this month) run full width above the
// rest, side column included, in your order, as sections of one ruled sheet (separate sheets while you customize).
export const PANELS = [
  { id: 'cards', name: 'Where you stand', span: 3, lead: true, render: ({ s, extra }) => <Cards s={s} safe={extra.safe} budgets={extra.budgets} /> },
  // The month as a calendar with Needs you and Coming up beside it and Budget under it, one panel (it was two: the
  // month spread and the glance sheet; `was` folds a saved layout's old ids into it).
  { id: 'month', was: ['glance'], name: 'This month', span: 3, lead: true, render: ({ extra }) => (
    <MonthSpread aside={<GlanceSide todo={extra.todo} upcoming={extra.upcoming} />} below={<GlanceBudget budgets={extra.budgets} />} />) },
  { id: 'insight', name: 'What changed', span: 3, lead: true, render: ({ extra }) => <InsightStrip changed={extra.insights?.changed} todo={extra.todo} /> },
  // The same chart leads the Net worth page, and net worth with its 30-day change already leads the dashboard, so it
  // starts hidden (a new id, so saved layouts hide it too); Customize brings it back.
  { id: 'nwchart', hidden: true, name: 'Net worth chart', span: 2, render: ({ s }) => <NetWorthChart history={s.history} /> },
  { id: 'allocation', hidden: true, name: 'Asset allocation', span: 1, render: ({ extra }) => <AssetAllocation a={extra.allocation} /> },
  { id: 'investments', hidden: true, name: 'Investments', span: 1, render: ({ extra }) => <InvestmentsCard d={extra.invest} /> },
  { id: 'recent', name: 'Recent transactions', span: 1, render: ({ extra }) => <RecentTransactions items={extra.recent} /> },
  { id: 'cashflow', name: 'Cash flow', span: 2, render: ({ extra }) => <CashFlow data={extra.cashflow} /> },
  { id: 'top', hidden: true, name: 'Top spending', span: 1, rail: true, render: ({ extra }) => <Categories c={extra.categories} changes={extra.insights?.groupChanges} /> },
  { id: 'watchlist', name: 'Watchlist', span: 2, render: ({ extra, reload }) => <WatchlistPanel data={extra.watchlist} reload={reload} /> },
  { id: 'frequent', hidden: true, name: 'Frequent spending', span: 1, render: ({ extra }) => <FrequentPanel items={extra.insights?.frequent ?? []} early={extra.insights?.changed?.reason === 'early'} /> },
  { id: 'goals', name: 'Goals', span: ({ extra }) => ((extra.watchlist?.items.length ?? 0) <= 1 ? 1 : 3), render: ({ extra }) => <GoalsPanel items={extra.goals} /> },
];
const DEFAULT = defaultLayout(PANELS);
const merge = (saved) => mergeLayout(saved, PANELS);

function Controls({ p, i, n, layout, set }) {
  const move = (d) => { const o = [...layout.order]; const j = o.indexOf(p.id); [o[j], o[j + d]] = [o[j + d], o[j]]; set({ ...layout, order: o }); };
  const inRail = layout.rail.includes(p.id);
  return (
    <div className="pctl">
      <b>{p.name}</b>
      <span className="btnrow">
        <button className="iconbtn" disabled={i === 0} onClick={() => move(-1)} aria-label={`Move ${p.name} up`}><Trend up /></button>
        <button className="iconbtn" disabled={i === n - 1} onClick={() => move(1)} aria-label={`Move ${p.name} down`}><Trend up={false} /></button>
        {p.span === 1 && <button className="btn" onClick={() => set({ ...layout, rail: inRail ? layout.rail.filter((x) => x !== p.id) : [...layout.rail, p.id] })}
          title="On wide screens (1440px and up), show this in the right-hand column">{inRail ? 'Main area' : 'Side column'}</button>}
        <button className="btn" onClick={() => set({ ...layout, hidden: [...layout.hidden, p.id] })}>Hide</button>
      </span>
    </div>
  );
}

// True while the window is wide enough for the side column (matches the CSS breakpoint).
const LOOSE = new Set(['cards']);
function useWide() {
  const q = '(min-width: 1440px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
}

// Packs the board on the page's dot grid (grid.js): the grid's rows are one unit (22px) with no gap, and each panel spans
// the whole units its content needs plus one empty row of dots under it (re-measured whenever anything resizes), so
// with dense flow a short panel lets the next one sit right under it instead of leaving a gap. No stretching, no holes.
const NEAR = 4; // panels side by side within NEAR rows of each other share one height
function usePacked(ref, deps) {
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return undefined;
    const fit = () => {
      const U = unit(grid), cells = [...grid.children];
      const above = (cell) => [...cell.children].slice(0, -1).reduce((t, c) => t + c.getBoundingClientRect().height + 8, 0); // edit controls
      const panel = (cell) => cell.lastElementChild;
      cells.forEach((cell) => { if (panel(cell)) panel(cell).style.minHeight = ''; });
      const spans = cells.map((cell) => {
        const h = [...cell.children].reduce((t, c) => t + c.getBoundingClientRect().height, 0) + (cell.children.length - 1) * 8;
        return Math.max(1, Math.ceil((h - 0.1) / U)) + 1;
      });
      const size = (cell, span) => {
        cell.style.gridRowEnd = `span ${span}`;
        if (panel(cell)) panel(cell).style.minHeight = `${(span - 1) * U - above(cell)}px`;
      };
      cells.forEach((cell, i) => size(cell, spans[i]));
      // Neighbours that start on the same line and are nearly the same height end on the same line too: the shorter
      // ones take the tallest's rows and their panel fills them, so a row of panels reads as one band, not a ragged edge.
      // Evening out one band moves the bands below it, so group again (a few times) until the lines settle.
      for (let pass = 0; pass < 4; pass++) {
        const rows = new Map();
        cells.forEach((cell, i) => { const top = cell.offsetTop; rows.set(top, [...(rows.get(top) ?? []), i]); });
        for (const row of rows.values()) {
          if (row.length < 2) continue;
          const max = Math.max(...row.map((i) => spans[i]));
          for (const i of row.filter((j) => max - spans[j] <= NEAR)) { spans[i] = max; size(cells[i], max); }
        }
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    for (const cell of grid.children) for (const c of cell.children) ro.observe(c);
    return () => ro.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// Getting started: shown on the dashboard until every required step is done or it's dismissed.
export function SetupChecklist() {
  const [d, setD] = useState(null);
  const load = () => api('/setup').then(setD);
  useEffect(() => { load(); }, []);
  if (!d || d.dismissed) return null;
  const required = d.steps.filter((s) => !s.optional);
  if (required.every((s) => s.done)) return null;
  const doneCount = d.steps.filter((s) => s.done).length;
  const act = async (a) => { await api(`/setup/${a}`, { method: 'POST' }); load(); };
  return (
    <section className="card setup mt" aria-label="Getting started">
      <div className="row base"><b>Getting started</b>
        <span className="btnrow"><span className="small muted">{doneCount} of {d.steps.length} done</span>
          <button className="linkbtn small" onClick={() => act('dismiss')}>Hide</button></span></div>
      <div className="setupbar"><i style={{ width: `${(doneCount / d.steps.length) * 100}%` }} /></div>
      <ol className="setupsteps">
        {d.steps.map((s) => (
          <li key={s.key} className={s.done ? 'done' : ''}>
            <span className="setupcheck" aria-hidden="true">{s.done ? <Check size={11} /> : ''}</span>
            <span className="tmain"><a href={s.href}><b>{s.label}</b></a>{s.optional && <span className="small muted"> (optional)</span>}
              <span className="small muted">{s.detail}</span></span>
            {!s.done && s.confirm && <button className="linkbtn small" onClick={() => act('home-ok')}>{s.confirm}</button>}
          </li>))}
      </ol>
    </section>
  );
}

export default function Dashboard(props) {
  const wide = useWide();
  const [layout, setLayout] = useState(null);
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState(null); // the page header's actions area (App renders it)
  useLayoutEffect(() => { setSlot(document.getElementById('dash-actions')); }, []);
  const mainRef = useRef(null), railRef = useRef(null);
  useEffect(() => { api('/settings/dashboard').then((l) => setLayout(merge(l))); }, []);
  usePacked(mainRef, [layout, editing, wide, props.extra]);
  if (!layout) return <DashboardSkeleton />;

  const save = (l) => { setLayout(l); api('/settings/dashboard', { method: 'PUT', body: JSON.stringify(l) }); };
  const reset = () => { setLayout(DEFAULT); api('/settings/dashboard', { method: 'PUT', body: JSON.stringify({ reset: true }) }); };
  const byId = Object.fromEntries(PANELS.map((p) => [p.id, p]));
  const visible = layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => byId[id]);
  // Side column only on wide screens; otherwise every panel flows in your order.
  const railIds = wide ? layout.rail : [];
  const lead = visible.filter((p) => p.lead && !railIds.includes(p.id));
  const main = visible.filter((p) => !p.lead && !railIds.includes(p.id)), rail = visible.filter((p) => railIds.includes(p.id));
  // Lead panels share one ruled sheet, except Where you stand, which sits on the paper itself (LOOSE): the one thing
  // without a box, so the eye lands there first. While you customize, they all stay together.
  const leadRuns = [];
  for (const p of lead) {
    const last = leadRuns[leadRuns.length - 1], loose = !editing && LOOSE.has(p.id);
    if (last && !loose && !(!editing && LOOSE.has(last[0].id))) last.push(p); else leadRuns.push([p]);
  }
  const cell = (p, list) => (
    <div key={p.id} className={`dcell span${railIds.includes(p.id) ? 1 : typeof p.span === 'function' ? p.span(props) : p.span}`}>
      {editing && <Controls p={p} i={list.indexOf(p)} n={list.length} layout={layout} set={save} />}
      {p.render(props)}
    </div>
  );

  return (
    <>
      {slot && createPortal(<div className="dashbar">
        {editing ? <>
          <span className="small muted">Move, hide or reset panels. Changes save as you go.</span>
          <button className="btn" onClick={reset}>Reset to default</button>
          <button className="btn primary" onClick={() => setEditing(false)}>Done</button>
        </> : <button className="linkbtn" onClick={() => setEditing(true)}>Customize dashboard</button>}
      </div>, slot)}
      {editing && layout.hidden.length > 0 && (
        <div className="note"><span>Hidden: {layout.hidden.map((id) => byId[id]?.name).filter(Boolean).join(', ')}</span>
          <span className="btnrow">{layout.hidden.map((id) => byId[id] && (
            <button key={id} className="btn" onClick={() => save({ ...layout, hidden: layout.hidden.filter((x) => x !== id) })}>Show {byId[id].name}</button>))}</span></div>
      )}
      {leadRuns.map((r) => <div key={r[0].id} className={`dlead${editing ? ' editing' : LOOSE.has(r[0].id) ? ' loose' : ' ledger'}`}>{r.map((p) => cell(p, lead))}</div>)}
      <div className={`dboard${rail.length ? ' has-rail' : ''}${editing ? ' editing' : ''}`}>
        <div className="dmain" ref={mainRef}>{main.map((p) => cell(p, main))}</div>
        {rail.length > 0 && <div className="drail">{rail.map((p) => cell(p, rail))}</div>}
      </div>
    </>
  );
}
