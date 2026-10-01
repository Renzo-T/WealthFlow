import { useEffect, useState } from 'react';
import { api } from './api.js';
import { ConnectBank, UpdateLink, missing } from './Connect.jsx';
import { Panel, PageHeader } from './ui.jsx';

// Where charts and reports start: 3 months before the first bank connection (default), or all history.
function HistorySetting() {
  const [h, setH] = useState(null);
  useEffect(() => { api('/settings/history').then(setH); }, []);
  if (!h) return null;
  const set = async (capped) => setH(await api('/settings/history', { method: 'PUT', body: JSON.stringify({ capped }) }));
  const day = h.start && h.start !== '0000-00-00' ? new Date(`${h.start}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  return (
    <Panel className="mt" title="History">
      <label className="check"><input type="checkbox" checked={h.capped} onChange={(e) => set(e.target.checked)} />
        Start charts and reports {day ? `on ${day}` : '3 months before your first bank connection'}</label>
      <p className="small muted">Banks share very different amounts of history (some two years, some about 90 days), so totals across your banks
        only compare fairly from about 3 months before you connected. Older history stays saved, shows in Transactions, and is still used to spot
        bills, subscriptions and yearly charges. Turn this off to show everything in charts and reports, with incomplete months marked.</p>
    </Panel>
  );
}

// The app: installing it as its own window (Chrome/Edge), and starting it when you sign in (Windows).
const standalone = () => window.matchMedia('(display-mode: standalone)').matches;
function AppSetting() {
  const [a, setA] = useState(null), [err, setErr] = useState('');
  const [canInstall, setCanInstall] = useState(() => !!window.installPrompt);
  useEffect(() => { api('/app').then(setA); }, []);
  useEffect(() => { const f = () => setCanInstall(!!window.installPrompt); window.addEventListener('installable', f); return () => window.removeEventListener('installable', f); }, []);
  if (!a) return null;
  const install = async () => { const p = window.installPrompt; if (!p) return; p.prompt(); await p.userChoice; window.installPrompt = null; setCanInstall(false); };
  const startup = async (enabled) => {
    setErr('');
    const r = await api('/app/startup', { method: 'PUT', body: JSON.stringify({ enabled }) });
    if (r.error_message) setErr(r.error_message); else setA(r);
  };
  const quit = async () => {
    if (!window.confirm('Stop WealthFlow?\n\nIt stops updating until it starts again (when you next sign in, or with npm run app). This window will show that it isn\'t running.')) return;
    await api('/app/quit', { method: 'POST' });
    setTimeout(() => window.location.reload(), 800);
  };
  return (
    <Panel className="mt" title="App">
      <div className="row wraprow mid">
        {standalone() ? <span className="small muted">You're using the installed app.</span>
          : canInstall ? <button className="btn primary" onClick={install}>Install WealthFlow</button>
            : <span className="small muted">To install it, use Chrome or Edge's Install button at the right of the address bar.</span>}
      </div>
      <p className="small muted">Installed, WealthFlow opens in its own window from the Start menu or taskbar, like any other app. Your data stays in
        WealthFlow's folder on this computer either way.</p>
      {a.startup.supported ? <>
        <label className="check mt"><input type="checkbox" checked={a.startup.enabled} onChange={(e) => startup(e.target.checked)} />
          Start WealthFlow when I sign in</label>
        <p className="small muted">Runs it in the background from sign-in, so the app opens straight away and your banks update every few hours
          even when the window is closed (that's also what builds your day-by-day balance history).
          {a.startup.enabled && !a.startup.here && ' It currently starts a copy in another folder; turn this off and on to use this one.'}</p>
      </> : <p className="small muted">Starting at sign-in is only set up for Windows so far. Run <code>npm run app</code> to start it.</p>}
      {err && <p className="err">{err}</p>}
      <div className="row wraprow mid">
        <span className="small muted">{a.mode === 'app' ? 'Running in the background.' : 'Running from npm start (development).'}</span>
        {a.mode === 'app' && <button className="btn" onClick={quit}>Stop WealthFlow</button>}
      </div>
    </Panel>
  );
}

export default function Settings({ onChange }) {
  const [sys, setSys] = useState(null);
  const [meta, setMeta] = useState(null);
  const [rules, setRules] = useState([]);
  const [cats, setCats] = useState([]);
  const [backups, setBackups] = useState([]);
  useEffect(() => { api('/backups').then(setBackups); }, []);
  useEffect(() => { api('/system').then(setSys); api('/items').then(setMeta); api('/rules').then(setRules); api('/categories/all').then(setCats); }, []);
  const removeRule = async (id) => { await api(`/rules/${id}`, { method: 'DELETE' }); setRules(await api('/rules')); };
  const changeRule = async (id, category) => { await api(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify({ category }) }); setRules(await api('/rules')); };

  const remove = async (i) => {
    if (!window.confirm(`Remove ${i.institution}?\n\nThis disconnects it from Plaid and deletes its accounts, transactions, and history from WealthFlow. On the Trial plan it does NOT free up a connection slot.`)) return;
    let r = await api(`/items/${i.id}`, { method: 'DELETE' });
    if (r.can_force && window.confirm(`Plaid couldn't remove it: ${r.error_message}\n\nRemove it from WealthFlow anyway?`))
      r = await api(`/items/${i.id}?force=1`, { method: 'DELETE' });
    setMeta(await api('/items'));
    onChange?.();
  };
  const reload = async () => { setMeta(await api('/items')); onChange?.(); };

  return (
    <>
      <PageHeader title="Settings" sub="Connections and backups for this copy of WealthFlow." />
      <Panel className="mt" title={<>Connections <span className="badge">{sys?.plaidEnv ?? '…'}</span></>}
        actions={meta && meta.items.length < meta.max && <ConnectBank />}>
        {sys?.plaidEnv === 'sandbox' && <p className="small muted">Sandbox shows test data only. Set PLAID_ENV=production in .env to link real banks.</p>}
        {meta && <p className="small muted">{meta.items.length} of {meta.max} Plaid connections used. On the Trial plan, removing a connection does not free a slot.</p>}
        {meta && <p className="small muted">WealthFlow updates from Plaid when it starts and every {meta.autoSyncHours} hours while it's running{meta.lastSync ? ` (last: ${new Date(meta.lastSync).toLocaleString()})` : ''}.
          Plaid gets new data from each bank on its own schedule, usually a few times a day for transactions and about once a day for investments.
          A newly connected bank can take several hours to fill in its history and holdings.</p>}
        {/* Each bank: its status, and anything it still needs from you (sign in again, or approve more data). */}
        {meta?.items.map((i) => {
          const more = missing(i);
          return (
            <div className="trow" key={i.id}>
              <span className="tmain"><b>{i.institution}</b>
                {i.status !== 'ok' ? <span className="small bad">Needs you to sign in again ({i.status})</span>
                  : more.products ? <span className="small hint">Can also share {more.text}</span>
                    : <span className="small good">Connected</span>}</span>
              <span className="btnrow">
                {i.status !== 'ok' && <UpdateLink item={i} label="Reconnect" className="btn primary" />}
                {i.status === 'ok' && more.products && <UpdateLink item={i} label="Approve" products={more.products} onDone={reload} />}
                <button className="linkbtn" onClick={() => remove(i)}>Remove</button>
              </span>
            </div>
          );
        })}
        <p className="small muted foot">To hide a single account without disconnecting its bank, untick it on the Net worth page.</p>
      </Panel>
      <AppSetting />
      <HistorySetting />
      <Panel className="mt" title="Category rules">
        <p className="small muted">Created when you change a category for every transaction with the same description, or choose "Always for" a person. Newer rules win.</p>
        {rules.length === 0 && <p className="small muted">No rules yet. Change a category on the Transactions page to add one.</p>}
        {rules.map((r) => {
          // A person rule matches `Name "` (every Venmo-style payment with them).
          const person = /^(.+) "$/.exec(r.pattern)?.[1];
          return (
            <div className="trow rule" key={r.id}>
              <div className="tmain"><b>{person ? <>Payments with {person}</> : r.pattern}</b>
                <span className="small muted">{person ? 'Person' : 'Description contains this'} · {r.matches} transaction{r.matches === 1 ? '' : 's'}</span></div>
              <span className="btnrow">
                <select className="catsel" value={r.category} onChange={(e) => changeRule(r.id, e.target.value)} aria-label={`Category for ${r.pattern}`}>
                  {!cats.some((g) => g.subs.includes(r.category)) && <option value={r.category}>{r.category}</option>}
                  {cats.map(({ group, subs }) => <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
                </select>
                <button className="linkbtn" onClick={() => removeRule(r.id)}>Remove</button>
              </span>
            </div>
          );
        })}
      </Panel>
      <Panel className="mt" title="Backup">
        <p className="small muted">WealthFlow saves a copy of your database automatically once a day, after the first sync, and keeps the last 14 in <code>data/backups</code>.
          {(() => { const last = backups.find((b) => b.auto); return last ? ` Latest: ${last.name.slice(5, 15)}.` : ' The first one is saved after the next sync.'; })()}
          {' '}Your daily net worth history can't be re-downloaded from Plaid later, so these are worth keeping.</p>
        <p className="small muted">Download backup saves a copy now, to your computer (the five newest downloads are also kept in <code>data/backups</code>).</p>
        <p className="small muted">Bank connections are stored encrypted, and the key is in your <code>.env</code> file. To restore on another machine you need both the backup and that <code>.env</code>. Forecast assumptions live in your browser and aren't included.</p>
        <a className="btn primary linkbtn-solid" href="/api/backup/download">Download backup</a>
      </Panel>
    </>
  );
}
