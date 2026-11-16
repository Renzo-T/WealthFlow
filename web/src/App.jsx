import { Fragment, useEffect, useState, useCallback } from 'react';
import Dashboard, { SetupChecklist } from './Dashboard.jsx';
import { InkDefs } from './Stamp.jsx';
import Transactions from './Transactions.jsx';
import Budget from './Budget.jsx';
import Goals from './Goals.jsx';
import Trips from './Trips.jsx';
import Reports from './Reports.jsx';
import Forecast from './Forecast.jsx';
import Investments from './Investments.jsx';
import NetWorth from './NetWorth.jsx';
import Settings from './Settings.jsx';
import Flow from './Flow.jsx';
import Bills from './Bills.jsx';
import NavIcon from './NavIcon.jsx';
import Jump from './Jump.jsx';
import { ConnectBank, UpdateLink, missing } from './Connect.jsx';
import { FirstRun } from './PlaidSetup.jsx';
import { api } from './api.js';
import { sectionOf, tabTarget } from './sections.js';
import { syncLine } from './syncStatus.js';
import { PageHeader, DashboardSkeleton, PageBoundary, Seal } from './ui.jsx';

const HIDE_KEY = 'wealthflow.hideAmounts', THEME_KEY = 'wealthflow.theme';
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const NAV = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'transactions', label: 'Transactions' },
  { id: 'budget', label: 'Budget' }, { id: 'bills', label: 'Bills' }, { id: 'flow', label: 'Money flow' }, { id: 'trips', label: 'Trips' }, { id: 'reports', label: 'Reports' }, { id: 'networth', label: 'Net worth' },
  { id: 'investments', label: 'Investments' }, { id: 'plan', label: 'Plan' }, { id: 'settings', label: 'Settings' },
];
// How the rail groups NAV. A heading shows as a divider when the rail is icons only; `rule` puts a divider above a
// page that stands alone; the last group sits at the foot of the rail.
const RAIL = [
  { ids: ['dashboard'] },
  { head: 'Spending', ids: ['transactions', 'budget', 'bills'] },
  { head: 'Looking back', ids: ['flow', 'reports', 'trips'] },
  { head: 'What you own', ids: ['networth', 'investments'] },
  { ids: ['plan'], rule: true },
  { ids: ['settings'], rule: true, foot: true },
];
// The index tabs on the page's right edge: one per section (Settings has none), the current one raised. Each opens the
// last page you used in its section. The rail stays the main navigation; the tabs are a second way in.
const SECTIONS = [{ label: 'Today', ids: ['dashboard'] }, ...RAIL.filter((g) => g.head).map((g) => ({ label: g.head, ids: g.ids })), { label: 'Plan', ids: ['plan'] }];
const SECTION_KEY = 'wealthflow.sectionPages';
const lastPages = () => { try { return JSON.parse(store.get(SECTION_KEY)) ?? {}; } catch { return {}; } };
const pageLabel = (id) => NAV.find((n) => n.id === id)?.label ?? id;
// What a sync found, in words. Plaid only has what banks have sent it, so "nothing new" is the common answer.
const syncSummary = (r) => {
  const added = r.reduce((s, x) => s + (x.added ?? 0), 0);
  const failed = r.filter((x) => x.status !== 'ok').map((x) => x.institution);
  return [added ? `${added} new transaction${added === 1 ? '' : 's'}` : 'Up to date: nothing new from Plaid yet',
    failed.length ? `${failed.join(', ')} need${failed.length === 1 ? 's' : ''} attention` : ''].filter(Boolean).join('. ');
};
// Pages that were merged into another: old links (bookmarks, the setup checklist) land on the new one.
const MOVED = { accounts: 'networth', goals: 'plan', forecast: 'plan' };
function usePage() {
  const get = () => {
    const [p, q] = window.location.hash.replace('#/', '').split('?'); // "#/transactions?category=…" → transactions
    if (MOVED[p]) { window.history.replaceState(null, '', `#/${MOVED[p]}${q ? `?${q}` : ''}`); return MOVED[p]; }
    return p || 'dashboard';
  };
  const [p, setP] = useState(get);
  const [qs, setQs] = useState(() => window.location.hash.split('?')[1] ?? '');
  useEffect(() => {
    const f = () => { setP(get()); setQs(window.location.hash.split('?')[1] ?? ''); };
    window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f);
  }, []);
  return [p, qs];
}

export default function App() {
  const resume = window.location.pathname === '/oauth';
  const [page, pageQs] = usePage();
  const [lastBySection, setLastBySection] = useState(lastPages);
  useEffect(() => { // remember the last page used in each section
    const sec = sectionOf(SECTIONS, page);
    if (!sec) return;
    setLastBySection((l) => { if (l[sec.label] === page) return l; const n = { ...l, [sec.label]: page }; store.set(SECTION_KEY, JSON.stringify(n)); return n; });
  }, [page]);
  const [meta, setMeta] = useState({ items: [], max: 10 });
  const [s, setS] = useState(null);
  const [extra, setExtra] = useState(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState('');
  // Hide amounts. The body class is set before rendering (not only in the effect below), so text that checks it while
  // rendering (amountsHidden) is right straight away.
  const [hide, setHideState] = useState(() => { const h = store.get(HIDE_KEY) === '1'; document.body.classList.toggle('privacy', h); return h; });
  const setHide = (h) => { document.body.classList.toggle('privacy', h); setHideState(h); };
  const [update, setUpdate] = useState(null); // a newer release? (Settings › Updates)
  useEffect(() => { api('/update').then(setUpdate).catch(() => {}); }, []);
  const [setup, setSetup] = useState(null); // Plaid keys saved yet? Until they are, the first-run screen shows.
  useEffect(() => { api('/link/setup').then(setSetup).catch(() => setSetup({ configured: true })); }, []);
  // Theme: follows the system unless you pick one; picking the system's own choice goes back to following it.
  const [theme, setTheme] = useState(() => store.get(THEME_KEY)); // 'light' | 'dark' | null (system)
  const dark = theme ? theme === 'dark' : systemDark();
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    store.set(THEME_KEY, theme);
  }, [theme]);
  const toggleTheme = () => { const next = dark ? 'light' : 'dark'; setTheme((next === 'dark') === systemDark() ? null : next); };

  const load = useCallback(async () => {
    const [items, sum, recent, cashflow, categories, allocation, upcoming, budgets, goals, insights, watchlist, todo, safe, invest] = await Promise.all(
      ['/items', '/summary', '/transactions?limit=5', '/cashflow', '/categories', '/allocation', '/upcoming', '/budgets', '/goals',
        '/insights', '/watchlist', '/todo', '/safe-to-spend', '/investments/summary'].map((p) => api(p)));
    setMeta(items); setS(sum); setExtra({ recent, cashflow, categories, allocation, upcoming, budgets, goals, insights, watchlist, todo, safe, invest });
  }, []);
  useEffect(() => { if (!resume) load(); }, [page, resume, load]); // refresh when switching pages
  // Hide amounts: blurs every dollar figure (for screen sharing). Remembered in this browser.
  useEffect(() => {
    document.body.classList.toggle('privacy', hide);
    store.set(HIDE_KEY, hide ? '1' : '0');
  }, [hide]);

  const syncTitle = `${syncLine(meta.lastSync, busy)}. Mizo Money checks Plaid when it starts and every ${meta.autoSyncHours} hours while it's running. Plaid gets new data from each bank on its own schedule (transactions a few times a day, investments about daily), so something new at your bank can take up to a day to show here. Click to check now.`;
  const refresh = async () => {
    setBusy(true); setSynced('');
    const r = await api('/sync', { method: 'POST' });
    await load(); setBusy(false);
    setSynced(Array.isArray(r) ? syncSummary(r) : 'Sync failed');
    setTimeout(() => setSynced(''), 8000);
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const loaded = !!(s && extra), ready = loaded && s.history.length > 0;
  const broken = meta.items.filter((i) => i.state === 'sign-in'); // only you can fix these: reconnect
  const failing = meta.items.filter((i) => i.state === 'error'); // the bank, Plaid or the connection: tried again automatically
  const attention = meta.items.filter((i) => i.status !== 'ok' || missing(i).products).length;

  if (resume) return <main className="main"><ConnectBank resume /></main>;
  if (setup && !setup.configured) return <FirstRun onDone={() => window.location.reload()} />;
  return (
    <div className="shell">
      <InkDefs />
      <Jump pages={NAV} />
      <aside className="side">
        <div className="logo"><Seal size={30} /><span className="wordmark">Mizo Money<i className="wm-dot" aria-hidden="true" /></span></div>
        {RAIL.map((g) => (
          <Fragment key={g.ids[0]}>
            {g.head && <div className="navgroup">{g.head}</div>}
            {g.foot && (
              <button className={`syncfoot${busy ? ' spin' : ''}`} onClick={refresh} disabled={busy} title={syncTitle} aria-label={`Refresh data. ${syncLine(meta.lastSync, busy)}`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" /></svg>
                <span className="synclabel" role="status">{syncLine(meta.lastSync, busy)}</span>
              </button>)}
            {g.rule && <div className={`navrule${g.foot ? ' foot' : ''}`} />}
            {g.ids.map((id) => NAV.find((n) => n.id === id)).map((n) => (
              <button key={n.label} className={`nav${n.id === page ? ' on' : ''}`}
                title={n.label} onClick={() => { window.location.hash = `#/${n.id}`; }}><NavIcon id={n.id} /><span className="navlabel">{n.label}</span></button>
            ))}
          </Fragment>
        ))}
      </aside>
      <main className="main">
        <nav className="idxtabs" aria-label="Section tabs">
          {SECTIONS.map((g) => {
            const to = tabTarget(SECTIONS, g, lastBySection), on = g.ids.includes(page);
            return (
              <div key={g.label} className="idxwrap">
                <a href={`#/${to}`} tabIndex={-1} className={`idxtab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} title={`${g.label}: ${pageLabel(to)}`}>{g.label}</a>
                {g.ids.length > 1 && (
                  <div className="idxcard">
                    <b>{g.label}</b>
                    {g.ids.map((id) => <a key={id} href={`#/${id}`} tabIndex={-1} className={id === page ? 'cur' : ''}>{pageLabel(id)}</a>)}
                  </div>)}
              </div>);
          })}
        </nav>
        <div className="topbar">
          {update?.available && <a className="chip-link info" href="#/settings" title={`You have version ${update.version}. See Settings › Updates.`}>Version {update.latest} is available</a>}
          {attention > 0 && <a className="chip-link" href="#/networth" title="See your banks on Accounts & net worth">
            {attention} bank{attention > 1 ? 's' : ''} need{attention > 1 ? '' : 's'} attention</a>}
          {/* What the last Refresh found shows here for a few seconds; the sync time itself lives at the rail's foot. */}
          {synced && <span className="small muted" role="status">{synced}</span>}
          <button className="iconbtn" onClick={toggleTheme} title={`Switch to ${dark ? 'light' : 'dark'} mode${theme ? '' : ' (now following your system setting)'}`} aria-label="Toggle dark mode">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
                : <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />}</svg>
          </button>
          <button className={`iconbtn${hide ? ' on' : ''}`} onClick={() => setHide(!hide)} title={hide ? 'Show amounts' : 'Hide amounts (for screen sharing)'} aria-label={hide ? 'Show amounts' : 'Hide amounts'} aria-pressed={hide}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{hide && <path d="M4 4l16 16" />}</svg>
          </button>
        </div>
        {/* Signing in again is urgent (that bank's data has stopped), so it stays a banner on every page. Other failures
            aren't yours to fix: say why, and that it's tried again (at the next sync, or now with Try again). */}
        {broken.map((i) => (
          <div key={i.id} className="alert"><span title={i.status}>{i.institution} needs you to sign in again.</span><UpdateLink item={i} label="Reconnect" /></div>
        ))}
        {failing.map((i) => (
          <div key={i.id} className="alert warn"><span title={i.status}>Couldn't update {i.institution}: {i.reason}. Mizo Money tries again on its own.</span>
            <button className="btn" onClick={refresh} disabled={busy}>{busy ? 'Trying…' : 'Try again'}</button></div>
        ))}
        {/* Transactions reads its filters from the address once, when it mounts: a new search must remount it. */}
        <PageBoundary key={page === 'transactions' ? `${page}?${pageQs}` : page}>
        {page === 'transactions' ? <Transactions /> : page === 'budget' ? <Budget /> : page === 'plan' ? <><Goals /><Forecast /></> : page === 'trips' ? <Trips /> : page === 'reports' ? <Reports />
          : page === 'investments' ? <Investments /> : page === 'networth' ? <NetWorth onChange={load} />
            : page === 'settings' ? <Settings onChange={load} /> : page === 'flow' ? <Flow /> : page === 'bills' ? <Bills /> : <>
              <PageHeader title={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} sub={`${greeting}. Here's where you stand.`} />
              {loaded && <SetupChecklist />}
              {!loaded ? <DashboardSkeleton /> : ready ? <Dashboard s={s} extra={extra} meta={meta} reload={load} />
                : <div className="card empty mt"><p>No accounts yet. Connect a bank to see your dashboard.</p><ConnectBank /></div>}
            </>}
        </PageBoundary>
      </main>
    </div>
  );
}
