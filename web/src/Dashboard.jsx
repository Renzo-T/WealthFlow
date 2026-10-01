import { useEffect, useState } from 'react';
import { api } from './api.js';
import { DashboardSkeleton } from './ui.jsx';
import Cards from './Cards.jsx';
import NetWorthChart from './NetWorthChart.jsx';
import AssetAllocation from './AssetAllocation.jsx';
import Upcoming from './Upcoming.jsx';
import CashFlow from './CashFlow.jsx';
import Categories from './Categories.jsx';
import { RecentTransactions } from './Transactions.jsx';
import { BudgetsPanel } from './Budget.jsx';
import { GoalsPanel } from './Goals.jsx';
import { ProjectionPanel } from './Projection.jsx';
import { InsightStrip, FrequentPanel, WatchlistPanel, SafeToSpendPanel, InvestmentsCard } from './Insights.jsx';
import { defaultLayout, mergeLayout } from './layout.js';

// Every dashboard panel, in default order. `span` is its width in a 3-column row (3 = full width); `rail` means it
// sits in the right-hand column on wide screens by default. To add a panel: add it here; saved layouts pick it
// up at its default position automatically.
export const PANELS = [
  { id: 'cards', name: 'Summary tiles', span: 3, render: ({ s }) => <Cards s={s} /> },
  { id: 'insight', name: 'What changed', span: 3, render: ({ extra }) => <InsightStrip changed={extra.insights?.changed} todo={extra.todo} /> },
  { id: 'networth', name: 'Net worth chart', span: 2, render: ({ s }) => <NetWorthChart history={s.history} /> },
  { id: 'allocation', name: 'Asset allocation', span: 1, render: ({ extra }) => <AssetAllocation a={extra.allocation} /> },
  { id: 'investments', name: 'Investments', span: 1, render: ({ extra }) => <InvestmentsCard d={extra.invest} /> },
  { id: 'upcoming', name: 'Upcoming bills & income', span: 1, rail: true, render: ({ extra }) => <Upcoming items={extra.upcoming} /> },
  { id: 'safe', name: 'Free to spend', span: 1, rail: true, render: ({ extra, reload }) => <SafeToSpendPanel d={extra.safe} reload={reload} /> },
  { id: 'recent', name: 'Recent transactions', span: 1, render: ({ extra }) => <RecentTransactions items={extra.recent} /> },
  { id: 'cashflow', name: 'Cash flow', span: 1, render: ({ extra }) => <CashFlow data={extra.cashflow} /> },
  { id: 'top', name: 'Top spending', span: 1, render: ({ extra }) => <Categories c={extra.categories} changes={extra.insights?.groupChanges} /> },
  { id: 'watchlist', name: 'Watchlist', span: 2, render: ({ extra, reload }) => <WatchlistPanel data={extra.watchlist} reload={reload} /> },
  { id: 'frequent', name: 'Frequent spending', span: 1, render: ({ extra }) => <FrequentPanel items={extra.insights?.frequent ?? []} early={extra.insights?.changed?.reason === 'early'} /> },
  { id: 'projection', name: 'Net worth projection', span: 2, render: ({ s, extra }) => <ProjectionPanel s={s} cashflow={extra.cashflow} /> },
  { id: 'budgets', name: 'Budgets', span: 1, render: ({ extra }) => <BudgetsPanel items={extra.budgets.items} suggestions={extra.budgets.suggestions} /> },
  { id: 'goals', name: 'Goals', span: 2, render: ({ extra }) => <GoalsPanel items={extra.goals} /> },
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
        <button className="iconbtn" disabled={i === 0} onClick={() => move(-1)} aria-label={`Move ${p.name} up`}>↑</button>
        <button className="iconbtn" disabled={i === n - 1} onClick={() => move(1)} aria-label={`Move ${p.name} down`}>↓</button>
        {p.span === 1 && <button className="btn" onClick={() => set({ ...layout, rail: inRail ? layout.rail.filter((x) => x !== p.id) : [...layout.rail, p.id] })}
          title="On wide screens (1440px and up), show this in the right-hand column">{inRail ? 'Main area' : 'Side column'}</button>}
        <button className="btn" onClick={() => set({ ...layout, hidden: [...layout.hidden, p.id] })}>Hide</button>
      </span>
    </div>
  );
}

// True while the window is wide enough for the side column (matches the CSS breakpoint).
function useWide() {
  const q = '(min-width: 1440px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
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
            <span className="setupcheck" aria-hidden="true">{s.done ? '✓' : ''}</span>
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
  useEffect(() => { api('/settings/dashboard').then((l) => setLayout(merge(l))); }, []);
  if (!layout) return <DashboardSkeleton />;

  const save = (l) => { setLayout(l); api('/settings/dashboard', { method: 'PUT', body: JSON.stringify(l) }); };
  const reset = () => { setLayout(DEFAULT); api('/settings/dashboard', { method: 'PUT', body: JSON.stringify({ reset: true }) }); };
  const byId = Object.fromEntries(PANELS.map((p) => [p.id, p]));
  const visible = layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => byId[id]);
  // Side column only on wide screens; otherwise every panel flows in your order.
  const railIds = wide ? layout.rail : [];
  const main = visible.filter((p) => !railIds.includes(p.id)), rail = visible.filter((p) => railIds.includes(p.id));
  const cell = (p, list) => (
    <div key={p.id} className={`dcell span${railIds.includes(p.id) ? 1 : p.span}`}>
      {editing && <Controls p={p} i={list.indexOf(p)} n={list.length} layout={layout} set={save} />}
      {p.render(props)}
    </div>
  );

  return (
    <>
      <div className="dashbar">
        {editing ? <>
          <span className="small muted">Move, hide or reset panels. Changes save as you go.</span>
          <button className="btn" onClick={reset}>Reset to default</button>
          <button className="btn primary" onClick={() => setEditing(false)}>Done</button>
        </> : <button className="linkbtn" onClick={() => setEditing(true)}>Customize dashboard</button>}
      </div>
      {editing && layout.hidden.length > 0 && (
        <div className="note"><span>Hidden: {layout.hidden.map((id) => byId[id]?.name).filter(Boolean).join(', ')}</span>
          <span className="btnrow">{layout.hidden.map((id) => byId[id] && (
            <button key={id} className="btn" onClick={() => save({ ...layout, hidden: layout.hidden.filter((x) => x !== id) })}>Show {byId[id].name}</button>))}</span></div>
      )}
      <div className={`dboard${rail.length ? ' has-rail' : ''}${editing ? ' editing' : ''}`}>
        <div className="dmain">{main.map((p) => cell(p, main))}</div>
        {rail.length > 0 && <div className="drail">{rail.map((p) => cell(p, rail))}</div>}
      </div>
    </>
  );
}
