import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd2, usd, signed, label, shortDate, SERIES } from './format.js';
import AccountOptions from './AccountOptions.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { Panel, PageHeader, Skeleton, Hover, TipList } from './ui.jsx';

const txIcon = (t) => (t.to_account ? { group: t.shown_grp === 'Transfer' ? 'Transfer' : t.shown_grp, kind: t.shown_grp === 'Transfer' ? 'swap' : undefined }
  : { group: t.shown_grp ?? t.grp, sub: t.shown ?? t.category });

// A matched transfer shows once, without a sign: it moved money, it didn't gain or lose any.
const amount = (t) => t.to_account
  ? <span className="tamt muted">{usd2(Math.abs(t.amount))}</span>
  : <span className={`tamt${t.amount > 0 ? '' : ' good'}`}>{signed(-t.amount)}</span>; // Plaid: positive = money out
const title = (t) => (t.to_account ? 'Transfer' : t.display || t.merchant || t.name);
const accounts = (t) => (t.to_account ? `${t.account} → ${t.to_account}` : t.account);

export function RecentTransactions({ items }) {
  return (
    <Panel title="Recent transactions" actions={<a href="#/transactions">View all</a>}>
      {items.length === 0 && <p className="small muted">No transactions yet.</p>}
      {items.map((t) => (
        <div className="trow" key={t.id}>
          <span className="rowicon"><CategoryIcon {...txIcon(t)} />
            <span className="tmain"><b>{title(t)}</b>
              <span className="small muted">{t.to_account ? accounts(t) : label(t.shown)}</span></span></span>
          <span className="r">{amount(t)}<div className="small muted">{shortDate(t.date)}</div></span>
        </div>
      ))}
    </Panel>
  );
}

// Paychecks tend to arrive on a schedule with similar amounts; describing the pattern helps the user decide.
const DAY = 864e5;
function pattern(items) {
  if (items.length < 2) return 'Only one deposit so far.';
  const dates = items.map((i) => new Date(i.date + 'T00:00').getTime()).sort((a, b) => a - b);
  const gaps = dates.slice(1).map((d, i) => Math.round((d - dates[i]) / DAY)).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const steady = gaps.every((g) => Math.abs(g - median) <= 3);
  const amts = items.map((i) => i.amount);
  const similar = Math.max(...amts) / Math.min(...amts) < 1.25;
  const when = steady ? `About every ${median} days` : `Irregular timing (${gaps[0]} to ${gaps.at(-1)} days apart)`;
  return `${when}, ${similar ? 'similar amounts' : `amounts from ${usd2(Math.min(...amts))} to ${usd2(Math.max(...amts))}`}.`;
}

// Transfers to or from accounts WealthFlow can't see. Only the user knows what they are.
const REVIEW = {
  in: {
    title: 'Is this income?', noun: 'deposit', sign: '+',
    text: "This money came from accounts that aren't connected, so it's counted as a transfer and left out of income.",
    choices: [['Income', 'Income'], ['My own money', 'Transfer']],
  },
  out: {
    title: 'Where did this go?', noun: 'transfer', sign: '-',
    text: "This money went to accounts that aren't connected, so it's left out of spending and savings.",
    choices: [['Savings & investments', 'Investments'], ['Spending', null], ['Just moving money', 'Transfer']], // null: pick a category
  },
};
// Plain-English hints for descriptions that are cryptic but well known.
const HINTS = [
  [/^(standard|instant) transfer$/i, /venmo|paypal|cash app/i, (r) => `Cashing out your ${r.institutions} balance to your bank. Usually "Just moving money".`],
  [/^(standard|instant) transfer$/i, /./, () => 'A transfer between accounts. If both are yours, it\'s "Just moving money".'],
  [/overdraft/i, /./, () => 'An automatic top-up between your own accounts to avoid an overdraft. Usually "Just moving money".'],
];
const hint = (r) => HINTS.find(([n, inst]) => n.test(r.name) && inst.test(r.institutions ?? ''))?.[2](r);

function Review({ dir, items, decide, cats }) {
  const R = REVIEW[dir];
  const [picking, setPicking] = useState(null); // review group waiting for a spending category
  if (!items?.length) return null;
  const spendCats = cats.filter((g) => !['Income', 'Transfer', 'Savings & investments'].includes(g.group));
  return (
    <Panel className="mt" title={R.title}>
      <p className="small muted mt-0">{R.text} Tell WealthFlow what it is and it'll remember for future ones too.</p>
      {items.map((r) => (
        <div className="review" key={r.name}>
          <div className="trow">
            <div className="tmain"><b>{r.name}</b>
              <span className="small muted">{[r.institutions, r.accounts].filter(Boolean).join(' · ')}</span>
              <span className="small muted amt">{r.n} {R.noun}{r.n > 1 ? 's' : ''}, {usd2(r.total)} total. {pattern(r.items)}</span>
              {hint(r) && <span className="small hint">{hint(r)}</span>}</div>
            <span className="btnrow">
              {picking === r.name
                ? <select autoFocus defaultValue="" onChange={(e) => { setPicking(null); decide(r.id, e.target.value); }} onBlur={() => setPicking(null)} aria-label="Spending category">
                    <option value="" disabled>Pick a category…</option>
                    {spendCats.map(({ group, subs }) => <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
                  </select>
                : R.choices.map(([text, cat]) => <button key={text} className="btn" onClick={() => (cat ? decide(r.id, cat) : setPicking(r.name))}>{text}</button>)}
            </span>
          </div>
          <details>
            <summary className="small">Show the {r.items.length} {R.noun}{r.items.length > 1 ? 's' : ''}</summary>
            <table className="t">
              <tbody>{r.items.map((t) => (
                <tr key={t.id}>
                  <td>{shortDate(t.date)}{t.pending ? <span className="badge">Pending</span> : null}</td>
                  <td>{t.account}</td>
                  <td className="r"><span className={`tamt${dir === 'in' ? ' good' : ''}`}>{R.sign}{usd2(t.amount)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </details>
        </div>
      ))}
    </Panel>
  );
}

// Payments with people that still need a category. Plaid guesses these from the note, so WealthFlow doesn't.
// Each can be filed as a category (just this one, or always for that person), left as a payment with a person,
// or, for money a friend sent you, linked to the charge it paid back.
const avatarColor = (s) => SERIES[[...s].reduce((h, c) => h + c.charCodeAt(0), 0) % SERIES.length];
const PEOPLE_QUICK = ['Restaurants', 'Entertainment', 'Travel', 'Gifts & donations'];
function PeoplePanel({ data, cats, reload }) {
  const [shown, setShown] = useState(5);
  const [always, setAlways] = useState({});
  if (!data?.items?.length) return null;
  const spendCats = cats.filter((g) => !['Income', 'Transfer', 'Savings & investments'].includes(g.group));
  const file = async (r, category) => {
    await api(`/transactions/${r.id}`, { method: 'PATCH', body: JSON.stringify({ category, person: !!always[r.id] }) });
    reload();
  };
  const paidBack = async (r, charge) => { await api(`/transactions/${r.id}/paidback`, { method: 'POST', body: JSON.stringify({ charge }) }); reload(); };
  const first = (name) => name.split(' ')[0];
  return (
    <Panel className="mt" title={<>Payments with people <span className="asof">{data.count} to sort</span></>}>
      <p className="small muted mt-0">Plaid guesses these from the note, so WealthFlow doesn't. Pick what each one was, or leave it as a payment
        with a person. Money a friend sent you can count against the charge it paid back.</p>
      {data.items.slice(0, shown).map((r) => {
        const best = r.candidates[0]?.likely ? r.candidates[0] : null; // one-click only when the name or an even split matches
        return (
          <div className="peer" key={r.id}>
            <span className="avatar" style={{ background: `${avatarColor(r.person)}22`, color: avatarColor(r.person) }}>{r.person[0]}</span>
            <span className="peerwho"><b>{r.person}</b>{r.note && <span className="peernote">“{r.note}”</span>}
              <span className="small muted">{shortDate(r.date)} · {r.amount < 0 ? 'paid you' : 'you paid'}</span></span>
            <span className={`tamt${r.amount < 0 ? ' good' : ''}`}>{signed(-r.amount)}</span>
            <span className="peeract">
              {r.amount < 0 && best && <button className="btn sm" onClick={() => paidBack(r, best.id)} title={`${best.name}, ${shortDate(best.date)}: ${usd2(best.amount)}`}>
                Paid back {best.name.length > 18 ? `${best.name.slice(0, 17)}…` : best.name} {usd2(best.amount)}{best.split ? ` ÷ ${best.split}` : ''}</button>}
              {r.amount < 0 && r.candidates.length > (best ? 1 : 0) && <select className="sm" defaultValue="" onChange={(e) => e.target.value && paidBack(r, e.target.value)} aria-label="Paid back which charge">
                <option value="" disabled>Paid back…</option>
                {r.candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {shortDate(c.date)} · {usd2(c.amount)}{c.split ? ` (÷ ${c.split})` : ''}</option>)}
              </select>}
              {PEOPLE_QUICK.map((c) => <button key={c} className="chipbtn" onClick={() => file(r, c)}>{c}</button>)}
              <select className="sm" defaultValue="" onChange={(e) => e.target.value && file(r, e.target.value)} aria-label="Category">
                <option value="" disabled>Other…</option>
                {spendCats.map(({ group, subs }) => <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
              </select>
              <button className="linkbtn" onClick={() => file(r, 'Payment apps')} title="Keep it as a payment with a person">Fine as is</button>
              <label className="check small"><input type="checkbox" checked={!!always[r.id]} onChange={(e) => setAlways({ ...always, [r.id]: e.target.checked })} /> Always for {first(r.person)}</label>
            </span>
          </div>
        );
      })}
      {data.items.length > shown && <button className="linkbtn foot" onClick={() => setShown(shown + 5)}>Show more</button>}
    </Panel>
  );
}

// Split one transaction into parts with their own categories. The parts must add up to the whole; the last
// part's amount fills itself in with what's left.
function SplitEditor({ t, cats, reload, onClose }) {
  const total = Math.abs(t.amount);
  const [parts, setParts] = useState(t.parts?.length ? t.parts.map((p) => ({ amount: Math.abs(p.amount).toFixed(2), category: p.category }))
    : [{ amount: '', category: t.category === 'Split' ? '' : t.category ?? '' }, { amount: '', category: '' }]);
  const [err, setErr] = useState('');
  const sum = parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const left = Math.round((total - sum) * 100) / 100;
  const set = (i, k, v) => setParts(parts.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const save = async () => {
    const r = await api(`/transactions/${t.id}/split`, { method: 'POST', body: JSON.stringify({ parts }) });
    if (r.error_message) return setErr(r.error_message);
    onClose(); reload();
  };
  const undo = async () => { await api(`/transactions/${t.id}/split`, { method: 'DELETE' }); onClose(); reload(); };
  return (
    <div className="spliteditor">
      {parts.map((p, i) => (
        <div className="splitrow" key={i}>
          <input className="mini" type="number" step="0.01" min="0" placeholder="0.00" value={p.amount} onChange={(e) => set(i, 'amount', e.target.value)} aria-label={`Part ${i + 1} amount`} />
          <select className="catsel" value={p.category} onChange={(e) => set(i, 'category', e.target.value)} aria-label={`Part ${i + 1} category`}>
            <option value="" disabled>Category…</option>
            {cats.map(({ group, subs }) => <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
          </select>
          {parts.length > 2 && <button className="linkbtn" onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label="Remove this part">×</button>}
        </div>
      ))}
      <div className="btnrow">
        <button className="linkbtn" onClick={() => setParts([...parts, { amount: left > 0 ? left.toFixed(2) : '', category: '' }])}>+ Add a part</button>
        <span className={`small ${Math.abs(left) < 0.005 ? 'good' : 'muted'}`}>{Math.abs(left) < 0.005 ? 'Adds up' : `${usd2(Math.abs(left))} ${left > 0 ? 'left to split' : 'too much'}`}</span>
        {left > 0.005 && <button className="linkbtn" onClick={() => set(parts.length - 1, 'amount', ((Number(parts.at(-1).amount) || 0) + left).toFixed(2))}>Put the rest in the last part</button>}
      </div>
      <div className="btnrow">
        <button className="btn primary" onClick={save} disabled={Math.abs(left) >= 0.005}>Save split</button>
        {t.is_split ? <button className="btn" onClick={undo}>Undo split</button> : null}
        <button className="btn" onClick={onClose}>Cancel</button>
        {err && <span className="bad small">{err}</span>}
      </div>
    </div>
  );
}

// Which trip a transaction counts toward: automatic (by place and dates), a trip you pick, or none.
function TripPick({ t, trips, reload }) {
  const value = t.trip_override ?? '';
  const set = async (v) => { await api(`/transactions/${t.id}/trip`, { method: 'POST', body: JSON.stringify({ trip: v === '' ? null : v }) }); reload(); };
  return (
    <select className="catsel" value={value} onChange={(e) => set(e.target.value)} aria-label="Trip" data-trip-for={t.id}>
      <option value="">{t.trip_name && !t.trip_override ? `Automatic (${t.trip_name})` : 'Automatic'}</option>
      <option value="none">Not on a trip</option>
      {trips.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
    </select>
  );
}

// Why a transaction has its category (classify's cat_source), for the details row.
const WHY = {
  you: 'You chose it', rule: 'One of your rules', transfer: 'Matched to one of your other accounts', 'cash back': 'Card cash back',
  'fund payout': 'A fund paying a dividend', sweep: 'Cash sweep inside the account', 'known description': 'A description Plaid is known to misread',
  note: 'Read from the note', person: 'A payment with a person (not sorted yet)', 'paid back': 'Pays back one of your charges',
};
const CONF = { VERY_HIGH: 'very sure', HIGH: 'sure', MEDIUM: 'fairly sure', LOW: 'unsure' };
const why = (t) => (t.cat_source === 'plaid' ? `Plaid's category${CONF[t.pfc_confidence] ? ` (${CONF[t.pfc_confidence]})` : ''}` : WHY[t.cat_source] ?? '—');

// Merchant logo from Plaid when there is one; the category icon otherwise (or if the image fails to load).
function Logo({ t }) {
  const [failed, setFailed] = useState(false);
  if (t.logo_url && !failed && !t.to_account) return <img className="mlogo" src={t.logo_url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  return <CategoryIcon {...txIcon(t)} size={24} />;
}

// Date presets resolve to inclusive YYYY-MM-DD bounds in local time.
const ymd = (d) => d.toLocaleDateString('en-CA');
function range(preset, custom) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  if (preset === 'this') return [ymd(new Date(y, m, 1)), ymd(d)];
  if (preset === 'last') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
  if (preset === '30') return [ymd(new Date(y, m, d.getDate() - 29)), ymd(d)];
  if (preset === 'custom') return [custom.from, custom.to];
  return ['', ''];
}

// After a category change: offer to apply it to every transaction with the same description, and future ones.
function ApplyPrompt({ p, apply, dismiss }) {
  const others = p.t.same_name - 1;
  return (
    <div className="note">
      <span>Changed <b>{title(p.t)}</b> to {p.cat}.{' '}
        {others > 0 ? `Also apply to ${others} other transaction${others === 1 ? '' : 's'} with this description, and future ones?`
          : 'Also use this category for future transactions with this description?'}</span>
      <span style={{ display: 'flex', gap: '.5rem' }}>
        <button className="btn primary" onClick={apply}>{others > 0 ? 'Apply to all' : 'Yes, remember it'}</button>
        <button className="btn" onClick={dismiss}>Just this one</button>
      </span>
    </div>
  );
}

// Other pages link here with filters, e.g. #/transactions?category=g:Food&from=2026-09-01&to=2026-09-30
const linked = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');

export default function Transactions() {
  const init = linked();
  const [q, setQ] = useState(init.get('q') ?? '');
  const [category, setCategory] = useState(init.get('category') ?? '');
  const [account, setAccount] = useState(init.get('account') ?? '');
  const [preset, setPreset] = useState(init.get('from') ? 'custom' : 'all');
  const [custom, setCustom] = useState({ from: init.get('from') ?? '', to: init.get('to') ?? '' });
  const [sweeps, setSweeps] = useState(false);
  const [data, setData] = useState({ rows: [], summary: null, loading: true });
  const [cats, setCats] = useState([]);
  const [accts, setAccts] = useState([]);
  const [review, setReview] = useState({});
  const [people, setPeople] = useState(null);
  const [trips, setTrips] = useState([]);
  const [splitting, setSplitting] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const LIMIT = 300;

  const load = useCallback(async () => {
    const [from, to] = range(preset, custom);
    const qs = new URLSearchParams({ limit: LIMIT, summary: 1, q, category, account, from, to, sweeps: sweeps ? 1 : 0 });
    setData(await api(`/transactions?${qs}`));
    setReview(await api('/review'));
    setPeople(await api('/review/people'));
  }, [q, category, account, preset, custom, sweeps]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api('/categories/all').then(setCats); api('/accounts').then(setAccts); api('/trips').then((d) => setTrips(d.trips.filter((x) => x.status === 'confirmed'))); }, []);

  const patch = (id, body) => api(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  const decide = async (id, cat) => { await patch(id, { category: cat, all: true }); load(); };
  // Apply to this one right away; the prompt then offers to extend it to the rest.
  const change = async (t, cat) => { await patch(t.id, { category: cat, all: false }); setPrompt({ t, cat }); load(); };
  const applyAll = async () => { await patch(prompt.t.id, { category: prompt.cat, all: true }); setPrompt(null); load(); };

  const { rows, summary } = data;
  const [from, to] = range(preset, custom);
  const filterQs = new URLSearchParams({ q, category, account, from, to, sweeps: sweeps ? 1 : 0 }).toString();
  // Rows grouped by day; the header shows the day's net (income minus spending; transfers don't count).
  const days = [];
  for (const t of rows) {
    if (days.at(-1)?.date !== t.date) days.push({ date: t.date, rows: [], net: 0 });
    const d = days.at(-1);
    d.rows.push(t);
    if (!t.to_account && t.shown_grp !== 'Transfer') d.net -= t.amount;
  }
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const applyBulk = async (cat) => {
    await api('/transactions/bulk', { method: 'POST', body: JSON.stringify({ ids: [...sel], category: cat }) });
    setSel(new Set()); setEditing(false); load();
  };
  const cols = editing ? 5 : 4;
  return (
    <>
      <PageHeader title="Transactions" sub="Search, filter, and fix categories. Transfers between your own accounts show as one row. Click a row for details.">
        <button className={`btn${editing ? ' primary' : ''}`} onClick={() => { setEditing(!editing); setSel(new Set()); }}>{editing ? 'Done' : 'Edit multiple'}</button>
      </PageHeader>
      <Review dir="in" items={review.in} decide={decide} cats={cats} />
      <Review dir="out" items={review.out} decide={decide} cats={cats} />
      <PeoplePanel data={people} cats={cats} reload={load} />
      <div className="filters">
        <input type="search" placeholder="Search merchant or description" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          <option value="unsure">Plaid wasn't sure (worth a look)</option>
          {cats.map(({ group, subs }) => (
            <optgroup key={group} label={group}>
              <option value={`g:${group}`}>All {group}</option>
              {subs.length > 1 && subs.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account">
          <option value="">All accounts</option>
          <AccountOptions accounts={accts} />
        </select>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Dates">
          <option value="all">All dates</option><option value="this">This month</option><option value="last">Last month</option>
          <option value="30">Last 30 days</option><option value="custom">Custom…</option>
        </select>
        {preset === 'custom' && <>
          <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </>}
        <label className="check small muted"><input type="checkbox" checked={sweeps} onChange={(e) => setSweeps(e.target.checked)} />
          <span title="Cash moving between an account and its own money-market fund. Not income or spending.">Show sweeps</span></label>
      </div>
      {prompt && <ApplyPrompt p={prompt} apply={applyAll} dismiss={() => setPrompt(null)} />}
      {editing && (
        <div className="note bulkbar">
          <span>{sel.size ? `${sel.size} selected` : 'Tick the transactions to change.'}{' '}
            {rows.length > 0 && <button className="linkbtn" onClick={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((t) => t.id)))}>{sel.size === rows.length ? 'Clear' : `Select all ${rows.length}`}</button>}</span>
          <select disabled={!sel.size} defaultValue="" key={sel.size} onChange={(e) => e.target.value && applyBulk(e.target.value)} aria-label="Category for selected">
            <option value="" disabled>Set category…</option>
            {cats.map(({ group, subs }) => <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
          </select>
        </div>
      )}
      <div className="txgrid mt-sm">
        <section className="card scroll sticky-head">
          <table className="t txtable">
            <thead><tr>{editing && <th />}<th>Merchant</th><th>Category</th><th>Account</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <Fragment key={d.date}>
                  <tr className="dayrow"><td colSpan={cols - 1}>{new Date(d.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</td>
                    <td className="r"><span className={`amt ${d.net > 0 ? 'good' : ''}`}>{Math.abs(d.net) >= 0.005 ? signed(d.net) : ''}</span></td></tr>
                  {d.rows.map((t) => (
                    <Fragment key={t.id}>
                      <tr className={`txrow${sel.has(t.id) ? ' picked' : ''}`} onClick={(e) => {
                        if (['SELECT', 'INPUT', 'BUTTON'].includes(e.target.tagName)) return;
                        if (editing) toggleSel(t.id); else setOpen(open === t.id ? null : t.id);
                      }}>
                        {editing && <td><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} aria-label={`Select ${title(t)}`} /></td>}
                        <td className="merch" title={t.name}><span className="merchcell"><Logo t={t} /><span>{title(t)}
                          {t.recurring && <Hover className="quiet" tip={<TipList title={t.bill?.name ?? 'Recurring bill'} rows={[['Schedule', t.bill?.schedule ?? '—'],
                            ['Next', t.bill?.next_date ? shortDate(t.bill.next_date) : '—']]} note="Part of a recurring bill. Change it on the Bills page." />}><span className="recur">↻</span></Hover>}
                          {t.pending ? <span className="badge">Pending</span> : null}
                          {t.trip_name && <button className="tripchip" title="Part of a trip: click to change" onClick={(e) => {
                            e.stopPropagation(); setOpen(t.id);
                            setTimeout(() => document.querySelector(`[data-trip-for="${t.id}"]`)?.focus(), 50);
                          }}>✈ {t.trip_name}</button>}</span></span></td>
                        <td>{t.is_split ? <span className="splitchip">Split · {t.parts?.length ?? 0} parts</span> : t.to_account || editing ? <><span className="grp">{t.shown_grp} ›</span>{t.shown}</> : (<>
                          <span className="grp">{t.grp} ›</span>
                          <select className="catsel" value={t.category ?? ''} onChange={(e) => change(t, e.target.value)} aria-label={`Category for ${title(t)}`}>
                            {!cats.some((g) => g.subs.includes(t.category)) && <option value={t.category ?? ''}>{label(t.category)}</option>}
                            {cats.map(({ group, subs }) => (
                              <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
                            ))}
                          </select></>)}</td>
                        <td className="acct">{accounts(t)}</td><td className="r">{amount(t)}</td>
                      </tr>
                      {t.parts?.map((p) => (
                        <tr className="txpart" key={p.id}>{editing && <td />}
                          <td className="merch"><span className="merchcell"><span className="partarrow" aria-hidden="true">↳</span><CategoryIcon group={p.grp} sub={p.category} size={20} /></span></td>
                          <td><span className="grp">{p.grp} ›</span>{p.category}</td><td />
                          <td className="r"><span className={`tamt small${p.amount > 0 ? '' : ' good'}`}>{signed(-p.amount)}</span></td>
                        </tr>))}
                      {open === t.id && !editing && (
                        <tr className="txdetail"><td colSpan={cols}>
                          <div><span className="muted">Date</span> {shortDate(t.date)}</div>
                          <div><span className="muted">Bank description</span> {t.name}</div>
                          {t.pair_name && <div><span className="muted">Other side</span> {t.pair_name}</div>}
                          <div><span className="muted">Why this category</span> {why(t)}</div>
                          <div><span className="muted">Trip</span> <TripPick t={t} trips={trips} reload={load} /></div>
                          {t.paidback_name && <div><span className="muted">Paid back</span> {t.paidback_name}, {shortDate(t.paidback_date)} ({usd2(t.paidback_amount)})</div>}
                          <div><span className="muted">Plaid category</span> {label(t.pfc_detailed || t.pfc_primary)}</div>
                          <div><span className="muted">Same description</span> {t.same_name} transaction{t.same_name === 1 ? '' : 's'}</div>
                          {!t.to_account && (splitting === t.id
                            ? <SplitEditor t={t} cats={cats} reload={load} onClose={() => setSplitting(null)} />
                            : <div><button className="linkbtn" onClick={() => setSplitting(t.id)}>{t.is_split ? 'Edit split' : 'Split into categories…'}</button></div>)}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          {data.loading && <div className="skelrows" aria-label="Loading">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={22} />)}</div>}
          {!data.loading && rows.length === 0 && <div className="empty">No transactions match.</div>}
          {summary && summary.count > rows.length && <p className="small muted foot">Showing the newest {rows.length} of {summary.count}. Narrow the filters, or download the CSV for all of them.</p>}
        </section>
        {summary && (
          <Panel className="txsummary" title="Summary">
            <dl className="kv">
              <dt>Transactions</dt><dd>{summary.count.toLocaleString()}</dd>
              <dt>Total income</dt><dd className="amt good">{usd(summary.income)}</dd>
              <dt title="Net of refunds and cash back; transfers, savings and debt repayment aren't counted">Total spending</dt><dd className="amt">{usd(summary.spent)}</dd>
              {summary.largest_expense != null && <><dt>Largest expense</dt><dd className="amt">{usd2(summary.largest_expense)}</dd></>}
              {summary.largest_income != null && <><dt>Largest income</dt><dd className="amt">{usd2(summary.largest_income)}</dd></>}
              {summary.avg_expense != null && <><dt>Average expense</dt><dd className="amt">{usd2(summary.avg_expense)}</dd></>}
              {summary.first && <><dt>First</dt><dd>{shortDate(summary.first)}, {summary.first.slice(0, 4)}</dd><dt>Last</dt><dd>{shortDate(summary.last)}, {summary.last.slice(0, 4)}</dd></>}
            </dl>
            <a className="btn csvbtn" href={`/api/transactions.csv?${filterQs}`}>Download CSV</a>
          </Panel>
        )}
      </div>
    </>
  );
}
