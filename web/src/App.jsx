import { useEffect, useState, useCallback } from 'react';
import Dashboard, { SetupChecklist } from './Dashboard.jsx';
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
import { ConnectBank, UpdateLink, missing } from './Connect.jsx';
import { api } from './api.js';
import { PageHeader, DashboardSkeleton, PageBoundary } from './ui.jsx';

const HIDE_KEY = 'wealthflow.hideAmounts', THEME_KEY = 'wealthflow.theme';
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const NAV = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'transactions', label: 'Transactions' },
  { id: 'budget', label: 'Budget' }, { id: 'bills', label: 'Bills' }, { id: 'flow', label: 'Money flow' }, { id: 'trips', label: 'Trips' }, { id: 'reports', label: 'Reports' }, { id: 'networth', label: 'Net worth' },
  { id: 'investments', label: 'Investments' }, { id: 'forecast', label: 'Forecast' },
  { id: 'goals', label: 'Goals' }, { id: 'settings', label: 'Settings' },
];
const ago = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
// What a sync found, in words. Plaid only has what banks have sent it, so "nothing new" is the common answer.
const syncSummary = (r) => {
  const added = r.reduce((s, x) => s + (x.added ?? 0), 0);
  const failed = r.filter((x) => x.status !== 'ok').map((x) => x.institution);
  return [added ? `${added} new transaction${added === 1 ? '' : 's'}` : 'Up to date: nothing new from Plaid yet',
    failed.length ? `${failed.join(', ')} need${failed.length === 1 ? 's' : ''} attention` : ''].filter(Boolean).join('. ');
};
function usePage() {
  const get = () => window.location.hash.replace('#/', '').split('?')[0] || 'dashboard'; // "#/transactions?category=…" → transactions
  const [p, setP] = useState(get);
  useEffect(() => { const f = () => setP(get()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return p;
}

export default function App() {
  const resume = window.location.pathname === '/oauth';
  const page = usePage();
  const [meta, setMeta] = useState({ items: [], max: 10 });
  const [s, setS] = useState(null);
  const [extra, setExtra] = useState(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState('');
  const [hide, setHide] = useState(() => store.get(HIDE_KEY) === '1');
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
  const broken = meta.items.filter((i) => i.status !== 'ok');
  const attention = meta.items.filter((i) => i.status !== 'ok' || missing(i).products).length;

  if (resume) return <main className="main"><ConnectBank resume /></main>;
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">WealthFlow</div>
        <div className="tag">Your money. In focus.</div>
        {NAV.map((n) => (
          <button key={n.label} className={`nav${n.id === page ? ' on' : ''}`}
            title={n.label} onClick={() => { window.location.hash = `#/${n.id}`; }}><NavIcon id={n.id} /><span className="navlabel">{n.label}</span></button>
        ))}
      </aside>
      <main className="main">
        <div className="topbar">
          {attention > 0 && <a className="chip-link" href="#/settings" title="See Settings › Connections">
            {attention} bank{attention > 1 ? 's' : ''} need{attention > 1 ? '' : 's'} attention</a>}
          {meta.lastSync && (
            <span className="small muted" title={`WealthFlow checks Plaid when it starts and every ${meta.autoSyncHours} hours while it's running. Plaid gets new data from each bank on its own schedule (transactions a few times a day, investments about daily), so something new at your bank can take up to a day to show here.`}>
              {busy ? 'Checking for new data…' : synced || `Updated ${ago(meta.lastSync)}`}
            </span>)}
          <button className={`iconbtn${busy ? ' spin' : ''}`} onClick={refresh} disabled={busy} title="Check Plaid for new data now" aria-label="Refresh data">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" /></svg>
          </button>
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
        {/* Signing in again is urgent (that bank's data has stopped), so it stays a banner on every page. */}
        {broken.map((i) => (
          <div key={i.id} className="alert"><span>{i.institution} needs you to sign in again ({i.status}).</span><UpdateLink item={i} label="Reconnect" /></div>
        ))}
        <PageBoundary key={page}>
        {page === 'transactions' ? <Transactions /> : page === 'budget' ? <Budget /> : page === 'goals' ? <Goals /> : page === 'trips' ? <Trips /> : page === 'reports' ? <Reports />
          : page === 'forecast' ? <Forecast /> : page === 'investments' ? <Investments /> : page === 'networth' ? <NetWorth />
            : page === 'settings' ? <Settings onChange={load} /> : page === 'flow' ? <Flow /> : page === 'bills' ? <Bills /> : <>
              <PageHeader title={greeting} sub="Here's your financial overview for today." />
              {loaded && <SetupChecklist />}
              {!loaded ? <DashboardSkeleton /> : ready ? <Dashboard s={s} extra={extra} meta={meta} reload={load} />
                : <div className="card empty mt"><p>No accounts yet. Connect a bank to see your dashboard.</p><ConnectBank /></div>}
            </>}
        </PageBoundary>
      </main>
    </div>
  );
}
