import { Fragment, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import Dashboard, { SetupChecklist } from './Dashboard.jsx';
import { Digest } from './Cards.jsx';
import { InkDefs } from './Stamp.jsx';
import Transactions from './Transactions.jsx';
import Budget from './Budget.jsx';
import Goals from './Goals.jsx';
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
import { api, apiRefresh, whenSettled } from './api.js';
import { syncLine } from './syncStatus.js';
import { syncThemeColor } from './journal.js';
import { startGrid } from './grid.js';
import { crossfade } from './motion.js';
import { PageHeader, HeaderTools, DashboardSkeleton, PageBoundary, Seal, DialogHost } from './ui.jsx';

const HIDE_KEY = 'wealthflow.hideAmounts', THEME_KEY = 'wealthflow.theme';
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };
const NAV = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'transactions', label: 'Transactions' },
  { id: 'budget', label: 'Budget' }, { id: 'bills', label: 'Bills' }, { id: 'flow', label: 'Money flow' }, { id: 'reports', label: 'Reports' }, { id: 'networth', label: 'Net worth' },
  { id: 'investments', label: 'Investments' }, { id: 'plan', label: 'Plan' }, { id: 'settings', label: 'Settings' },
];
// How the rail groups NAV. A heading shows as a divider when the rail is icons only; `rule` puts a divider above a
// page that stands alone; the last group sits at the foot of the rail.
const RAIL = [
  { ids: ['dashboard'] },
  { head: 'Spending', ids: ['transactions', 'budget', 'bills'] },
  { head: 'Looking back', ids: ['flow', 'reports'] },
  { head: 'What you own', ids: ['networth', 'investments'] },
  { ids: ['plan'], rule: true },
  { ids: ['settings'], rule: true, foot: true },
];
// What a sync found, in words. Plaid only has what banks have sent it, so "nothing new" is the common answer.
const syncSummary = (r) => {
  const added = r.reduce((s, x) => s + (x.added ?? 0), 0);
  const failed = r.filter((x) => x.status !== 'ok').map((x) => x.institution);
  return [added ? `${added} new transaction${added === 1 ? '' : 's'}` : 'Up to date: nothing new from Plaid yet',
    failed.length ? `${failed.join(', ')} need${failed.length === 1 ? 's' : ''} attention` : ''].filter(Boolean).join('. ');
};
// Pages that were merged into another: old links (bookmarks, the setup checklist) land on the new one.
const MOVED = { accounts: 'networth', goals: 'plan', forecast: 'plan', trips: 'reports?tab=trips' };
function usePage() {
  const get = () => {
    const [p, q] = window.location.hash.replace('#/', '').split('?'); // "#/transactions?category=…" → transactions
    if (MOVED[p]) { // a target may carry its own query ("reports?tab=trips")
      const [to, tq] = MOVED[p].split('?'), rest = [tq, q].filter(Boolean).join('&');
      window.history.replaceState(null, '', `#/${to}${rest ? `?${rest}` : ''}`); return to;
    }
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
  // A page's arrival (meters filling, charts drawing, the month inking in) plays the first time you open it in this
  // window. Coming back to it is a plain cut (data-quiet on .main; styles.css), so quick check-ins never wait on motion.
  const seenPages = useRef(new Set());
  const [visit, setVisit] = useState({ page, quiet: false });
  if (visit.page !== page) setVisit({ page, quiet: seenPages.current.has(page) });
  useEffect(() => { seenPages.current.add(page); }, [page]);
  // A page's body waits for its data (at most 0.7s; whenSettled in api.js), then shows whole, so sections that load one
  // after another never push each other down while you watch. The header shows at once (data-settling; styles.css).
  const pageNow = useRef(page); pageNow.current = page; // which data load() fetches
  const haveDash = useRef(false);
  const [settling, setSettling] = useState(true);
  // Marked in the same render that switches the page (as `visit` above), so the new page never shows for a frame first.
  if (visit.page !== page && !settling) setSettling(true);
  useEffect(() => {
    const w = whenSettled(700);
    w.then(() => setSettling(false));
    return w.cancel;
  }, [page]); // not on the query: Transactions keeps its filters there, and typing a search must not blank the list
  const [meta, setMeta] = useState({ items: [], max: 10 });
  const [s, setS] = useState(null);
  const [extra, setExtra] = useState(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState('');
  // Hide amounts. The body class is set before rendering (not only in the effect below), so text that checks it while
  // rendering (amountsHidden) is right straight away.
  const [hide, setHideState] = useState(() => { const h = store.get(HIDE_KEY) === '1'; document.body.classList.toggle('privacy', h); return h; });
  const setHide = (h) => crossfade(() => { document.body.classList.toggle('privacy', h); setHideState(h); });
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
    syncThemeColor();
  }, [theme]);
  // The rail: full, or icons only (your choice, remembered here like the theme). Narrow windows always get icons.
  // The rail is icons only and opens over the page while the pointer (or keyboard focus) is on it, so the page never
  // reflows. A short delay on the way in keeps a pointer passing over it from flashing it open.
  const [railOpen, setRailOpen] = useState(false);
  const railTimer = useRef(0);
  // The active page's fold: one piece of cloth under the rail's items that slides to the page you pick, instead of each
  // item drawing its own and the highlight jumping. Placed without sliding the first time (and when the layout changes).
  const railRef = useRef(null);
  const [fold, setFold] = useState(null);
  const placeFold = useCallback((slide) => {
    const on = railRef.current?.querySelector('.nav.on');
    setFold(on ? { top: on.offsetTop, height: on.offsetHeight, slide } : null);
  }, []);
  useLayoutEffect(() => placeFold(true), [page, update?.available, placeFold]);
  useEffect(() => { // the window or the type size changed: put it back in place without sliding
    const again = () => placeFold(false);
    window.addEventListener('resize', again); document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, [placeFold]);
  const railTo = (open, ms) => { clearTimeout(railTimer.current); railTimer.current = setTimeout(() => setRailOpen(open), ms); };
  // The page snaps its boxes to the dot grid (grid.js), whatever page is showing.
  const mainRef = useRef(null), shown = !resume && !(setup && !setup.configured);
  useEffect(() => (shown && mainRef.current ? startGrid(mainRef.current) : undefined), [shown]);
  // A sticky table head turns opaque only while it's stuck to the top of the window (.stuck; styles.css).
  useEffect(() => {
    const f = () => { for (const el of document.querySelectorAll('.sticky-head')) { const r = el.getBoundingClientRect(); el.classList.toggle('stuck', r.top < 0 && r.bottom > 44); } };
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  // The new theme goes on <html> inside the cross-fade (not only in the effect above), so the fade lands on it.
  const chooseTheme = (t) => { // 'light' | 'dark' | null (follow the system); the rail, Settings and Jump all come here
    if (t === theme) return;
    crossfade(() => {
      if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
      setTheme(t);
    });
  };
  const toggleTheme = () => { const next = dark ? 'light' : 'dark'; chooseTheme((next === 'dark') === systemDark() ? null : next); };
  const themeTip = `Switch to ${dark ? 'light' : 'dark'} mode (now ${dark ? 'dark' : 'light'}${theme ? '' : ', following your system'})`;
  // Settings › Journal › Appearance asks for a theme through this event (like mizo:jump) and hears the current one.
  useEffect(() => {
    const on = (e) => chooseTheme(e.detail);
    window.addEventListener('mizo:theme', on);
    return () => window.removeEventListener('mizo:theme', on);
  });
  useEffect(() => { window.dispatchEvent(new CustomEvent('mizo:themed', { detail: theme })); }, [theme]);

  // Every page needs the banks (the rail's sync line, the banners); only the dashboard needs its own 13 requests. Fetching
  // those on every page would queue them on the server ahead of that page's own data and slow it down.
  const load = useCallback(async () => {
    if (pageNow.current !== 'dashboard') { setMeta(await api('/items')); return; }
    // Back on the dashboard: let its panels get their own data first (the page shows meanwhile), then refresh the rest.
    if (haveDash.current) await whenSettled(1500);
    const [items, sum, recent, cashflow, categories, allocation, upcoming, budgets, goals, insights, watchlist, todo, safe, invest] = await Promise.all(
      ['/items', '/summary', '/transactions?limit=5', '/cashflow', '/categories', '/allocation', '/upcoming', '/budgets', '/goals',
        '/insights', '/watchlist', '/todo', '/safe-to-spend', '/investments/summary'].map((p) => (haveDash.current ? apiRefresh : api)(p)));
    setMeta(items); setS(sum); setExtra({ recent, cashflow, categories, allocation, upcoming, budgets, goals, insights, watchlist, todo, safe, invest });
    haveDash.current = true; // coming back shows these at once and updates them in place
  }, []);
  useEffect(() => { if (!resume) load(); }, [page, resume, load]); // refresh when switching pages (the dashboard's data when it shows)
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

  // Notices (banks needing attention, what a Refresh found) show at the right of the page header's title row (HeaderTools in
  // ui.jsx). The theme and Hide amounts buttons and the update notice live in the rail's foot, and in Jump (Ctrl+K).
  const tools = (
    <span className="hdtools">
      {attention > 0 && <a className="chip-link" href="#/networth" title="See your banks on Net worth">
        {attention} bank{attention > 1 ? 's' : ''} need{attention > 1 ? '' : 's'} attention</a>}
      {/* What the last Refresh found shows here for a few seconds; the sync time itself lives at the rail's foot. */}
      {synced && <span className="small muted" role="status">{synced}</span>}
      {/* While amounts are hidden, every page says so (screen sharing is when you need to be sure), and one click undoes it. */}
      {hide && <button type="button" className="chip-link info" onClick={() => setHide(false)} title="Every dollar figure is blurred for screen sharing. Click to show them.">Amounts hidden</button>}
    </span>
  );

  if (resume) return <main className="main"><ConnectBank resume /></main>;
  if (setup && !setup.configured) return <FirstRun onDone={() => window.location.reload()} />;
  return (
    <div className={`shell${railOpen ? ' railopen' : ' slim'}`}>
      <InkDefs />
      <DialogHost />
      <Jump pages={NAV} commands={[{ label: dark ? 'Switch to light mode' : 'Switch to dark mode', run: toggleTheme }, { label: hide ? 'Show amounts' : 'Hide amounts', run: () => setHide(!hide) }]} />
      <aside className="side" ref={railRef} onMouseEnter={() => railTo(true, 120)} onMouseLeave={() => railTo(false, 200)}
        onFocus={() => railTo(true, 0)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) railTo(false, 0); }}>
        {fold && <span className={`navfold${fold.slide ? "" : " still"}`} aria-hidden="true" style={{ translate: `0 ${fold.top}px`, height: fold.height }} />}
        <div className="logo"><Seal size={30} /><span className="wordmark">Mizo Money</span></div>
        <button className="nav findnav" title="Find a page, transaction, bill or account (Ctrl+K)" onClick={() => window.dispatchEvent(new Event('mizo:jump'))}>
          <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
          <span className="navlabel">Find <kbd>Ctrl K</kbd></span></button>
        {RAIL.map((g) => (
          <Fragment key={g.ids[0]}>
            {g.head && <div className="navgroup">{g.head}</div>}
            {g.foot && (
              <button className={`syncfoot${busy ? ' spin' : ''}`} onClick={refresh} disabled={busy} title={syncTitle} aria-label={`Refresh data. ${syncLine(meta.lastSync, busy)}`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" /></svg>
                <span className="synclabel" role="status">{syncLine(meta.lastSync, busy)}</span>
              </button>)}
            {g.foot && <>
              {update?.available && <a className="railtool update" href="#/settings" title={`Version ${update.latest} is available (you have ${update.version}). See Settings › Updates.`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                <span className="synclabel">Version {update.latest} is available</span></a>}
              <button className="railtool" onClick={toggleTheme} title={themeTip} aria-label={themeTip}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
                    : <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />}</svg>
                <span className="synclabel">{dark ? 'Light mode' : 'Dark mode'}</span>
              </button>
              <button className={`railtool${hide ? ' on' : ''}`} onClick={() => setHide(!hide)} title={hide ? 'Show amounts' : 'Hide amounts (for screen sharing)'} aria-label={hide ? 'Show amounts' : 'Hide amounts'} aria-pressed={hide}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{hide && <path d="M4 4l16 16" />}</svg>
                <span className="synclabel">{hide ? 'Show amounts' : 'Hide amounts'}</span>
              </button>
            </>}
            {g.rule && <div className={`navrule${g.foot ? ' foot' : ''}`} />}
            {g.ids.map((id) => NAV.find((n) => n.id === id)).map((n) => (
              <button key={n.label} className={`nav${n.id === page ? ' on' : ''}`}
                title={n.label} onClick={() => { window.location.hash = `#/${n.id}`; }}><NavIcon id={n.id} /><span className="navlabel">{n.label}</span></button>
            ))}
          </Fragment>
        ))}
      </aside>
      {/* Says it out loud when Hide amounts changes, however it was changed (the rail, the chip or Ctrl+K). */}
      <span className="sr-only" role="status">{hide ? 'Amounts hidden' : ''}</span>
      <main className="main" ref={mainRef} data-page={page} data-quiet={visit.quiet ? '' : undefined} data-settling={settling ? '' : undefined} aria-busy={settling || undefined}>
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
        <HeaderTools.Provider value={tools}>
        <PageBoundary key={page === 'transactions' ? `${page}?${pageQs}` : page}>
        {page === 'transactions' ? <Transactions /> : page === 'budget' ? <Budget /> : page === 'plan' ? <><Goals /><Forecast /></> : page === 'reports' ? <Reports />
          : page === 'investments' ? <Investments /> : page === 'networth' ? <NetWorth onChange={load} />
            : page === 'settings' ? <Settings onChange={load} /> : page === 'flow' ? <Flow /> : page === 'bills' ? <Bills /> : <>
              <PageHeader title={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} sub={<Digest greeting={`${greeting}. Here's where you stand.`} />}><span id="dash-actions" /></PageHeader>
              {loaded && <SetupChecklist />}
              {!loaded ? <DashboardSkeleton /> : ready ? <Dashboard s={s} extra={extra} meta={meta} reload={load} />
                : <div className="card empty mt"><p>No accounts yet. Connect a bank to see your dashboard.</p><ConnectBank /></div>}
            </>}
        </PageBoundary>
        </HeaderTools.Provider>
      </main>
    </div>
  );
}
