import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Panel, PageHeader, Hover, confirmDialog } from './ui.jsx';
import { PlaidKeys } from './PlaidSetup.jsx';
import { JOURNALS, RULING_NAME, rulingAt } from './journals.js';
import { currentJournal, setJournal, decorationOn, setDecoration } from './journal.js';
import { crossfade } from './motion.js';

// Appearance: light, dark, or follow the system. App.jsx owns the theme (the rail's toggle and Ctrl+K share it); this asks
// for a change with mizo:theme and hears the current one on mizo:themed.
const THEME_KEY = 'wealthflow.theme';
const savedTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const APPEARANCE = [[null, 'System'], ['light', 'Light'], ['dark', 'Dark']];
function Appearance() {
  const [theme, setTheme] = useState(savedTheme);
  useEffect(() => {
    const on = (e) => setTheme(e.detail ?? null);
    window.addEventListener('mizo:themed', on);
    return () => window.removeEventListener('mizo:themed', on);
  }, []);
  return (
    <div className="appearance">
      <span className="small" id="appearance-label">Appearance</span>
      <span className="ranges" role="radiogroup" aria-labelledby="appearance-label">
        {APPEARANCE.map(([v, label]) => (
          <button key={label} type="button" role="radio" aria-checked={theme === v} className={theme === v ? 'on' : ''}
            onClick={() => window.dispatchEvent(new CustomEvent('mizo:theme', { detail: v }))}>{label}</button>))}
      </span>
      <span className="small muted">{theme ? `Always ${theme}.` : `Following your system, which is ${systemDark() ? 'dark' : 'light'} now.`}</span>
    </div>
  );
}

// One journal's page in the current theme: its paper and ruling, its cover down the left edge, a swipe of its highlighter
// behind a word, and a line and dot in its ink accent.
function JournalTile({ j, dark }) {
  const c = dark ? j.dark : j.light;
  return (
    <span className="jprev" aria-hidden="true" style={{ '--pb': c.bg, '--pr': c.rail, '--ph': c.hi, '--pa': c.accent, '--pk': c.card, '--pi': c.hiInk, background: `${rulingAt(j.ruling, c.dot)}, ${c.bg}` }}>
      <i className="jcover" /><i className="jsheet" /><span className="jword"><i />Rent</span><i className="jline" /><i className="jdot" /></span>
  );
}

// The journal: cover, paper, ink, highlighter and tapes (journals.js), and whether the tape and doodles show.
// Remembered in this browser, like the light/dark choice.
function JournalSetting() {
  const [id, setId] = useState(currentJournal);
  const [deco, setDeco] = useState(decorationOn);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : systemDark());
  useEffect(() => { // the theme changed (rail, Ctrl+K or the choice above) or the system's did
    const read = () => setDark(document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : systemDark());
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    window.addEventListener('mizo:themed', read); mq?.addEventListener?.('change', read);
    return () => { window.removeEventListener('mizo:themed', read); mq?.removeEventListener?.('change', read); };
  }, []);
  const pick = (k) => { if (k !== id) crossfade(() => { setJournal(k); setId(k); }); };
  return (
    <Panel className="mt" title="Journal">
      <Appearance />
      <div className="jpicker" role="radiogroup" aria-label="Journal">
        {Object.entries(JOURNALS).map(([k, j]) => (
          <button key={k} type="button" role="radio" aria-checked={id === k} className={`jpick${id === k ? ' on' : ''}`} onClick={() => pick(k)}>
            <JournalTile j={j} dark={dark} />
            <span className="jname"><b>{j.name}</b><span className="small muted">{RULING_NAME[j.ruling]}</span></span>
          </button>
        ))}
      </div>
      <p className="small muted">{JOURNALS[id].desc}</p>
      <label className="check"><input type="checkbox" checked={deco} onChange={(e) => { setDecoration(e.target.checked); setDeco(e.target.checked); }} />
        Show washi tape and margin doodles</label>
    </Panel>
  );
}

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
        <Hover className="quiet" tip="Banks share very different amounts of history, so totals only compare fairly from about 3 months before you connected. Older history stays saved and still helps spot bills. Turn this off to chart everything, with incomplete months marked." tabbable={false}>
          Start charts and reports {day ? `on ${day}` : '3 months before your first bank connection'}</Hover></label>
      <p className="small muted">Older history stays saved and still helps spot bills.</p>
    </Panel>
  );
}

// "Tell me when something needs me" (Windows): a notification after a sync for the few things that can't wait.
// Off by default. The words never include an amount or account number, since they can show on the lock screen.
function NotifySetting() {
  const [n, setN] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/settings/notify').then(setN).catch(() => {}); }, []);
  if (!n?.supported) return null;
  const save = async (body) => {
    setErr('');
    const r = await api('/settings/notify', { method: 'PUT', body: JSON.stringify(body) });
    if (r.error_message) setErr(r.error_message); else setN(r);
  };
  const kind = (k) => ({ type: 'checkbox', checked: n.kinds[k], onChange: (e) => save({ kinds: { [k]: e.target.checked } }) });
  return <>
    <label className="check mt"><input type="checkbox" checked={n.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
      Tell me when something needs me</label>
    <p className="small muted">Windows notifications, once each, never with an amount or account number.</p>
    {n.enabled && <>
      <label className="check"><input {...kind('signin')} /> A bank needs me to sign in again</label>
      <div className="row wraprow mid">
        <label className="check"><input {...kind('bill')} /> A large bill is due tomorrow</label>
        <span className="small muted">Large means $<input className="mini" type="number" min="0" step="50" defaultValue={n.billMin} key={n.billMin}
          aria-label="Smallest bill to tell me about" onBlur={(e) => Number(e.target.value) !== n.billMin && save({ billMin: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /> or more</span>
      </div>
      <label className="check"><input {...kind('free')} /> Free to spend drops below zero</label>
    </>}
    {err && <p className="err">{err}</p>}
  </>;
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
  const change = async (what, enabled) => {
    setErr('');
    const r = await api(`/app/${what}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    if (r.error_message) setErr(r.error_message); else setA(r);
  };
  const quit = async () => {
    if (!await confirmDialog({ title: 'Stop Mizo Money?', body: "It stops updating until it starts again (when you next sign in, or with npm run app). This window will show that it isn't running.", confirm: 'Stop Mizo Money', danger: true })) return;
    await api('/app/quit', { method: 'POST' });
    setTimeout(() => window.location.reload(), 800);
  };
  return (
    <Panel className="mt" title="App">
      <div className="row wraprow mid">
        {standalone() ? <span className="small muted">You're using the installed app.</span>
          : canInstall ? <button className="btn primary" onClick={install}>Install Mizo Money</button>
            : <span className="small muted">To install it, use Chrome or Edge's Install button at the right of the address bar.</span>}
      </div>
      {a.startup.supported ? <>
        <label className="check mt"><input type="checkbox" checked={a.startup.enabled} onChange={(e) => change('startup', e.target.checked)} />
          <Hover className="quiet" tip="Runs quietly in the background (about 90 MB) and checks your banks every 6 hours. It keeps daily balances complete (Plaid can't supply past days later), makes daily backups, and means no wait on opening. Without it, transactions still catch up when you open the app." tabbable={false}>Start Mizo Money when I sign in</Hover></label>
        <p className="small muted">Keeps daily balances and backups complete.</p>
        {a.startup.enabled && !a.startup.here && <p className="small muted">It currently starts a copy in another folder; turn this off and on to use this one.</p>}
        <label className="check mt"><input type="checkbox" checked={a.launcher.enabled} onChange={(e) => change('launcher', e.target.checked)} />
          Let the app window start Mizo Money</label>
        <p className="small muted">Shows a Start button when it isn't running.
          {a.launcher.enabled && !a.launcher.here && ' It currently starts a copy in another folder; turn this off and on to use this one.'}</p>
        <NotifySetting />
      </> : <p className="small muted">Starting at sign-in is only set up for Windows so far. Run <code>npm run app</code> to start it.</p>}
      {err && <p className="err">{err}</p>}
      <div className="row wraprow mid">
        <span className="small muted">{a.mode === 'app' ? 'Running in the background.' : 'Running from npm start (development).'}</span>
        {a.mode === 'app' && <button className="btn" onClick={quit}>Stop Mizo Money</button>}
      </div>
    </Panel>
  );
}

// Updates: this copy's version, and a notice when a newer release is out (also in the top bar).
function UpdateSetting() {
  const [u, setU] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { api('/update').then(setU).catch(() => {}); }, []);
  if (!u) return null;
  const day = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const check = async () => { setBusy(true); setU(await api('/update/check', { method: 'POST' })); setBusy(false); };
  const toggle = async (enabled) => setU(await api('/update', { method: 'PUT', body: JSON.stringify({ enabled }) }));
  const status = !u.enabled ? 'Update checks are off.'
    : !u.checked ? 'Not checked yet.'
      : `${u.latest ? 'Up to date' : 'No releases published yet'} (checked ${day(u.checked)}).${u.error ? ` The last check didn't work: ${u.error}.` : ''}`;
  return (
    <Panel className="mt" title="Updates" actions={u.enabled && u.repo && !u.available && <button className="btn" onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check now'}</button>}>
      {u.available ? <div className="note"><span><b>Version {u.latest} is available</b>{u.published && ` (released ${day(u.published)})`}. You have {u.version}.</span>
        <span className="btnrow">
          {u.how === 'download' && u.download && <a className="btn primary linkbtn-solid" href={u.download}>Download</a>}
          {u.page && <a className="btn linkbtn-solid" href={u.page} target="_blank" rel="noreferrer">What's new</a>}
        </span></div>
        : <p className="small muted">Version {u.version}. {status}</p>}
      {u.available && <p className="small muted">{u.how === 'download'
        ? <>Stop Mizo Money, replace its folder with the new download, and start it again. Your data stays.</>
        : <>Run <code>git pull</code> and <code>npm install</code>, then restart.</>}</p>}
      {u.repo ? <>
        <label className="check mt"><input type="checkbox" checked={u.enabled} onChange={(e) => toggle(e.target.checked)} /> Check for new versions</label>
        <p className="small muted">Asks GitHub about once a day. Nothing about you is sent.</p>
      </> : <p className="small muted">This copy can't check for new versions.</p>}
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


  return (
    <>
      <PageHeader title="Settings" />
      {/* One ruled sheet, a section per setting. */}
      <div className="ledger mt">
      <Panel className="mt" title={<>Banks <span className="badge">{sys?.plaidEnv ?? '…'}</span></>} actions={<a className="btn" href="#/networth">Open Net worth</a>}>
        <p className="small muted">{meta ? `${meta.items.length} of ${meta.max} Plaid connections used. ` : ''}Manage banks on Net worth.</p>
      </Panel>
      <PlaidKeys banks={meta?.items.length ?? 0} onChange={() => api('/system').then(setSys)} />
      <AppSetting />
      <JournalSetting />
      <UpdateSetting />
      <HistorySetting />
      <Panel className="mt" title="Category rules">
        {rules.length === 0 && <p className="small muted">None yet. Changing a category on Transactions can add one; newer rules win.</p>}
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
        <p className="small muted">
          <Hover className="quiet" tip={<>A copy is saved automatically once a day after the first sync (the last 14 are kept in <code>data/backups</code>). Your daily net worth history can't be re-downloaded from Plaid. Bank connections are stored encrypted with a key {sys?.keyInEnv ? <>in your <code>.env</code> file</> : <>in <code>config.json</code> in the data folder{sys?.dataDir && <> (<code>{sys.dataDir}</code>)</>}</>}; keep a copy with your backups, or you'll need to connect every bank again. Forecast assumptions live in your browser and aren't included.</>} tabbable={false}>
            Saved automatically every day, last 14 kept.</Hover>
          {(() => { const last = backups.find((b) => b.auto); return last ? ` Latest: ${last.name.slice(5, 15)}.` : ''; })()}</p>
        <a className="btn primary linkbtn-solid" href="/api/backup/download">Download backup</a>
      </Panel>
      </div>
    </>
  );
}
