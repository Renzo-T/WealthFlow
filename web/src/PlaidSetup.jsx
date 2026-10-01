import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Panel } from './ui.jsx';

// Plaid keys: pasted once on first run (the server checks them with Plaid before saving them to config.json in the
// data folder), and changeable later in Settings. The secret is never sent back to the page.

function KeysForm({ initialEnv = 'sandbox', onSaved, onCancel, confirmEnvChange }) {
  const [f, setF] = useState({ client_id: '', secret: '', env: initialEnv });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (confirmEnvChange && f.env !== initialEnv && !window.confirm(confirmEnvChange)) return;
    setBusy(true); setErr('');
    const r = await api('/link/setup', { method: 'POST', body: JSON.stringify(f) }).catch(() => ({ error_message: 'WealthFlow isn\'t responding.' }));
    setBusy(false);
    if (r.ok) onSaved(r); else setErr(r.error_message);
  };
  return (
    <form className="keys" onSubmit={save}>
      <label>Client ID<input value={f.client_id} onChange={set('client_id')} autoComplete="off" spellCheck={false} /></label>
      <label>Secret<input type="password" value={f.secret} onChange={set('secret')} autoComplete="off" /></label>
      <fieldset className="envpick">
        <legend>Environment</legend>
        <label className="check"><input type="radio" name="env" value="sandbox" checked={f.env === 'sandbox'} onChange={set('env')} /> Sandbox (test banks and made-up data)</label>
        <label className="check"><input type="radio" name="env" value="production" checked={f.env === 'production'} onChange={set('env')} /> Production (your real banks)</label>
      </fieldset>
      {err && <p className="err">{err}</p>}
      <div className="row wraprow">
        <button className="btn primary" disabled={busy || !f.client_id || !f.secret}>{busy ? 'Checking with Plaid…' : 'Save keys'}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

const HowTo = () => (
  <ol className="small howto">
    <li>Create a free account at <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noreferrer">dashboard.plaid.com</a>.
      Plaid is the service that connects to your banks; your data comes straight to this computer.</li>
    <li>In the Plaid dashboard, open <b>Developers › Keys</b> and copy your client ID and a secret.</li>
    <li>Sandbox works right away with test banks. To connect your real banks, request Production access in the dashboard
      (the free Trial plan allows 10 banks) and use the Production secret.</li>
  </ol>
);

// Shown instead of the app until Plaid keys are saved.
export function FirstRun({ onDone }) {
  return (
    <main className="main firstrun">
      <div className="card">
        <div className="logo">WealthFlow</div>
        <h2>Connect WealthFlow to Plaid</h2>
        <p className="muted">WealthFlow runs on this computer and reads your accounts through Plaid. It needs your own Plaid keys, once.</p>
        <HowTo />
        <KeysForm onSaved={onDone} />
        <p className="small muted">Keys are saved in WealthFlow's data folder on this computer, next to your database. Bank sign-ins are encrypted
          with a key that was created for you automatically.</p>
      </div>
    </main>
  );
}

// Settings: which keys are in use, and changing them.
export function PlaidKeys({ banks = 0, onChange }) {
  const [s, setS] = useState(null), [edit, setEdit] = useState(false);
  const load = () => api('/link/setup').then(setS).catch(() => {}); // shown once the server answers
  useEffect(() => { load(); }, []);
  if (!s) return null;
  const env = s.env === 'production' ? 'Production' : 'Sandbox';
  return (
    <Panel className="mt" title="Plaid keys" actions={!edit && !s.fromEnv && <button className="btn" onClick={() => setEdit(true)}>Change</button>}>
      {edit ? <>
        <HowTo />
        <KeysForm initialEnv={s.env} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); load(); onChange?.(); }}
          confirmEnvChange={banks ? `Banks connected under ${env} only work with ${env} keys; they will stop updating until you switch back. Continue?` : null} />
      </> : <p className="small muted">
        {env} keys{s.client_id ? ` (client ID ${s.client_id})` : ''}{s.fromEnv ? ', set in the .env file. Change them there and restart WealthFlow.' : '.'}
        {s.env === 'sandbox' && ' Sandbox shows test data only; switch to Production keys to connect your real banks.'}
      </p>}
    </Panel>
  );
}
