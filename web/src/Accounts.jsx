import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd2, label, shortDate } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState } from './ui.jsx';
import { ConnectBank, UpdateLink, missing } from './Connect.jsx';
import { Nickname, AccountType, Avatar } from './NetWorth.jsx';

// Every bank you've connected and its accounts: whether the connection is working (and what to do if not), each
// account's balance, this month's money in and out, how far back its history goes, and its settings.

const isDebt = (a) => a.type === 'credit' || a.type === 'loan';
const NAMES = { hsa: 'HSA', ira: 'IRA', roth: 'Roth IRA', '401k': '401(k)', '403b': '403(b)', '457b': '457(b)', cd: 'CD', 529: '529 plan', 'credit card': 'Credit card' };
const kind = (a) => { const t = a.subtype || a.type; const s = NAMES[t] ?? label(t); return s ? s[0].toUpperCase() + s.slice(1) : 'Account'; };
const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

function Status({ i }) {
  const more = missing(i);
  if (i.state === 'sign-in') return <span className="small bad" title={i.status}>Needs you to sign in again</span>;
  if (i.state === 'error') return <span className="small hint" title={i.status}>Couldn't update: {i.reason}. Tried again at the next sync.</span>;
  if (more.products) return <span className="small hint">Can also share {more.text}</span>;
  return <span className="small good">Connected</span>;
}

function AccountLine({ a, act, open, setOpen, saved }) {
  const toggle = async () => { await api(`/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ in_networth: !a.in_networth }) }); saved(); };
  return (
    <>
      <div className={`acctrow${a.in_networth ? '' : ' dim'}`}>
        <span className="tmain"><b>{a.name}</b>
          <span className="small muted">{kind(a)}{a.mask ? ` ••${a.mask}` : ''}{a.in_networth ? '' : ' · not in net worth'}</span></span>
        <span className="acctstat small">
          {act ? <>
            <span><span className="muted">{monthName} in</span> <b className="amt good">{usd2(act.month_in)}</b></span>
            <span><span className="muted">out</span> <b className="amt">{usd2(act.month_out)}</b></span>
            <span className="muted">{act.n} transactions since {shortDate(act.first)}{act.pending ? ` · ${act.pending} pending` : ''}</span>
          </> : <span className="muted">No transactions{a.type === 'investment' ? ' (holdings are on the Investments page)' : ''}</span>}
        </span>
        <span className="r"><b className="amt">{isDebt(a) && a.balance >= 0.005 ? '−' : ''}{usd2(a.balance)}</b>
          <div className="btnrow small">
            {act && <a className="linkbtn" href={`#/transactions?account=${encodeURIComponent(a.id)}`}>Transactions</a>}
            <button className="linkbtn" onClick={() => setOpen(open ? null : a.id)} aria-expanded={open}>{open ? 'Done' : 'Edit'}</button>
          </div></span>
      </div>
      {open && (
        <div className="aedit">
          <label className="lbl">Nickname<Nickname a={a} saved={saved} /></label>
          <label className="lbl">Type<AccountType a={a} saved={saved} /></label>
          <label className="check small"><input type="checkbox" checked={!!a.in_networth} onChange={toggle} /> Include in net worth
            <span className="muted">(its transactions still count toward spending and budgets)</span></label>
        </div>
      )}
    </>
  );
}

export default function Accounts({ onChange }) {
  const [meta, setMeta] = useState(null), [accounts, setAccounts] = useState(null), [activity, setActivity] = useState({});
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    const [m, a, act] = await Promise.all([api('/items'), api('/accounts'), api('/accounts/activity')]);
    setMeta(m); setAccounts(a); setActivity(act);
  }, []);
  useEffect(() => { load(); }, [load]);
  const saved = () => { load(); onChange?.(); };
  if (!meta || !accounts) return <PageSkeleton />;

  const remove = async (i) => {
    if (!window.confirm(`Remove ${i.institution}?\n\nThis disconnects it from Plaid and deletes its accounts, transactions, and history from this app. On the Trial plan it does NOT free up a connection slot.`)) return;
    let r = await api(`/items/${i.id}`, { method: 'DELETE' });
    if (r.can_force && window.confirm(`Plaid couldn't remove it: ${r.error_message}\n\nRemove it anyway?`)) r = await api(`/items/${i.id}?force=1`, { method: 'DELETE' });
    saved();
  };
  return (
    <>
      <PageHeader title="Accounts" sub="Your banks and their accounts: connection status, balances and this month's activity.">
        {meta.items.length < meta.max && <ConnectBank />}
      </PageHeader>
      {meta.items.length === 0 && <div className="card empty mt"><EmptyState icon="plan" title="No banks yet">Connect a bank to see its accounts here.</EmptyState></div>}
      {meta.items.map((i) => {
        const more = missing(i);
        const list = accounts.filter((a) => a.item_id === i.id);
        return (
          <Panel key={i.id} className="mt" title={<span className="rowicon"><Avatar name={i.institution} /><span className="tmain"><b>{i.institution}</b><Status i={i} /></span></span>}
            actions={<span className="btnrow">
              {i.state === 'sign-in' && <UpdateLink item={i} label="Reconnect" className="btn primary" />}
              {i.state === 'ok' && more.products && <UpdateLink item={i} label="Approve" products={more.products} onDone={saved} />}
              <button className="linkbtn" onClick={() => remove(i)}>Remove</button>
            </span>}>
            {list.map((a) => <AccountLine key={a.id} a={a} act={activity[a.id]} open={open === a.id} setOpen={setOpen} saved={saved} />)}
            {list.length === 0 && <p className="small muted">No accounts from this bank yet; a new connection can take a few minutes to fill in.</p>}
          </Panel>
        );
      })}
      <p className="small muted mt">{meta.items.length} of {meta.max} Plaid connections used; on the Trial plan, removing one doesn't free its slot.
        Updated from Plaid when the app starts and every {meta.autoSyncHours} hours while it's running{meta.lastSync ? ` (last: ${new Date(meta.lastSync).toLocaleString()})` : ''}.
        Plaid gets new data from each bank on its own schedule, usually a few times a day for transactions and about once a day for investments.</p>
    </>
  );
}
