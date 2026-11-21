import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { usd2, usd, signed, label, shortDate, SERIES, tint } from './format.js';
import Select from './Select.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { RowStamp, useStampedExit } from './Stamp.jsx';
import { RepeatPick } from './Bills.jsx';
import { Panel, PageHeader, Skeleton, Hover, TipList, Repeat, Close, tipText, askText, toast, Plus } from './ui.jsx';

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
        // One line, like Coming up beside it: what, where it went, when, how much.
        <div className="trow tline" key={t.id}>
          <span className="rowicon"><CategoryIcon {...txIcon(t)} />
            <span className="tline-name" title={title(t)}>{title(t)}</span>
            <span className="small muted tline-cat">{t.to_account ? accounts(t) : label(t.shown)}</span></span>
          <span className="small muted">{shortDate(t.date)}</span>
          <span className="r">{amount(t)}</span>
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

// Transfers to or from accounts Mizo Money can't see. Only the user knows what they are.
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
  const rows = useStampedExit(items, (r) => r.name);
  if (!rows.length) return null;
  const spendCats = cats.filter((g) => !['Income', 'Transfer', 'Savings & investments'].includes(g.group));
  return (
    <Panel className="mt" title={R.title}>
      <p className="small muted mt-0">{R.text} Tell Mizo Money what it is and it'll remember for future ones too.</p>
      {rows.map(({ item: r, key, leaving }) => (
        <div className={`review stampable${leaving ? ' leaving' : ''}`} key={key} {...(leaving ? { inert: '' } : {})}>
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
          {leaving && <RowStamp />}
        </div>
      ))}
    </Panel>
  );
}

// Payments with people that still need a category. Plaid guesses these from the note, so Mizo Money doesn't.
// Each can be filed as a category (just this one, or always for that person), left as a payment with a person,
// or, for money a friend sent you, linked to the charge it paid back.
const avatarColor = (s) => SERIES[[...s].reduce((h, c) => h + c.charCodeAt(0), 0) % SERIES.length];
const PEOPLE_QUICK = ['Restaurants', 'Entertainment', 'Travel', 'Gifts & donations'];
function PeoplePanel({ data, cats, reload }) {
  const [shown, setShown] = useState(5);
  const [always, setAlways] = useState({});
  const rows = useStampedExit(data?.items, (r) => r.id);
  if (!rows.length) return null;
  const spendCats = cats.filter((g) => !['Income', 'Transfer', 'Savings & investments'].includes(g.group));
  const file = async (r, category) => {
    await api(`/transactions/${r.id}`, { method: 'PATCH', body: JSON.stringify({ category, person: !!always[r.id] }) });
    reload();
  };
  const paidBack = async (r, charge) => { await api(`/transactions/${r.id}/paidback`, { method: 'POST', body: JSON.stringify({ charge }) }); reload(); };
  const first = (name) => name.split(' ')[0];
  return (
    <Panel className="mt" title={<>Payments with people <span className="asof">{data.count} to sort</span></>}>
      <p className="small muted mt-0">Plaid guesses these from the note, so Mizo Money doesn't. Pick what each one was, or leave it as a payment
        with a person. Money a friend sent you can count against the charge it paid back.</p>
      {rows.slice(0, shown).map(({ item: r, key, leaving }) => {
        const best = r.candidates[0]?.likely ? r.candidates[0] : null; // one-click only when the name or an even split matches
        return (
          <div className={`peer stampable${leaving ? ' leaving' : ''}`} key={key} {...(leaving ? { inert: '' } : {})}>
            <span className="avatar" style={{ background: tint(avatarColor(r.person), 13), color: avatarColor(r.person) }}>{r.person[0]}</span>
            <span className="peerwho"><b>{r.person}</b>{r.note && <span className="peernote">“{r.note}”</span>}
              <span className="small muted">{shortDate(r.date)} · {r.amount < 0 ? 'paid you' : 'you paid'}</span></span>
            <span className={`tamt${r.amount < 0 ? ' good' : ''}`}>{signed(-r.amount)}</span>
            <span className="peeract">
              {r.amount < 0 && best && <button className="btn sm" onClick={() => paidBack(r, best.id)} title={tipText(`${best.name}, ${shortDate(best.date)}: ${usd2(best.amount)}`)}>
                Paid back {best.name.length > 18 ? `${best.name.slice(0, 17)}…` : best.name} <span className="amt">{usd2(best.amount)}</span>{best.split ? ` ÷ ${best.split}` : ''}</button>}
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
            {leaving && <RowStamp />}
          </div>
        );
      })}
      {rows.length > shown &&<button className="linkbtn foot" onClick={() => setShown(shown + 5)}>Show more</button>}
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
          {parts.length > 2 && <button className="linkbtn" onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label="Remove this part"><Close /></button>}
        </div>
      ))}
      <div className="btnrow">
        <button className="linkbtn" onClick={() => setParts([...parts, { amount: left > 0 ? left.toFixed(2) : '', category: '' }])}><Plus size={11} /> Add a part</button>
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

// Money from a friend: which of your charges it paid back. It then counts in that charge's category and month.
function PaybackPick({ t, reload }) {
  const [list, setList] = useState(null);
  useEffect(() => { api(`/transactions/${t.id}/paidback`).then((r) => setList(r.candidates ?? [])); }, [t.id, t.reimburses]);
  const set = async (charge) => { await api(`/transactions/${t.id}/paidback`, { method: 'POST', body: JSON.stringify({ charge: charge || null }) }); reload(); };
  if (!list) return <span className="muted">…</span>;
  if (!list.length && !t.reimburses) return <span className="muted">No charge of yours it could have paid back</span>;
  return (
    <select className="catsel" value={t.reimburses ?? ''} onChange={(e) => set(e.target.value)} aria-label="Paid back which charge">
      <option value="">Not paying back a charge</option>
      {list.map((c) => <option key={c.id} value={c.id}>{c.name} · {shortDate(c.date)} · {usd2(c.amount)}{c.split ? ` (÷ ${c.split})` : ''}</option>)}
    </select>
  );
}
// "October 2026": the month a refund or payback counts in, when it isn't the month it arrived.
const monthName = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Why a transaction has its category (classify's cat_source), for the details row.
const WHY = {
  you: 'You chose it', rule: 'One of your rules', transfer: 'Matched to one of your other accounts', 'cash back': 'Card cash back',
  'fund payout': 'A fund paying a dividend', sweep: 'Cash sweep inside the account', 'known description': 'A description Plaid is known to misread',
  note: 'Read from the note', person: 'A payment with a person (not sorted yet)', 'paid back': 'Pays back one of your charges',
  refund: 'Refunds one of your charges',
};
const CONF = { VERY_HIGH: 'very sure', HIGH: 'sure', MEDIUM: 'fairly sure', LOW: 'unsure' };
const why = (t) => (t.cat_source === 'plaid' ? `Plaid's category${CONF[t.pfc_confidence] ? ` (${CONF[t.pfc_confidence]})` : ''}` : WHY[t.cat_source] ?? '—');

// Merchant logo from Plaid when there is one; the category icon otherwise (or if the image fails to load).
// Always the category icon, in one box, so every merchant name starts at the same x; brand logos are often
// unreadable at this size.
function Logo({ t }) {
  return <CategoryIcon {...txIcon(t)} size={24} />;
}

// Account choices for the filter, grouped under each bank.
function accountGroups(accts) {
  const banks = new Map();
  for (const a of accts) {
    const k = a.institution ?? 'Other';
    if (!banks.has(k)) banks.set(k, []);
    banks.get(k).push({ value: String(a.id), label: `${a.name}${a.mask ? ` ••${a.mask}` : ''}` });
  }
  return [...banks].sort(([a], [b]) => a.localeCompare(b)).map(([group, options]) => ({ group, options }));
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
  const [opened, setOpened] = useState(init.get('open')); // from Ctrl+K: the row to open and scroll to once the list has loaded
  const [open, setOpen] = useState(opened);
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [cur, setCur] = useState(null); // the keyboard's current row (j/k, Enter, c)
  const search = useRef(null);
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
  // Undo puts the one-off choice back (or clears it when there was none); for "all", it also removes the rule made.
  const restore = (t) => (t.user_category ? patch(t.id, { category: t.user_category, all: false }) : patch(t.id, { clear: true }));
  const change = async (t, cat) => {
    await patch(t.id, { category: cat, all: false }); setPrompt({ t, cat }); load();
    toast(`Moved to ${cat}`, { undo: async () => { await restore(t); setPrompt(null); load(); } });
  };
  const applyAll = async () => {
    const { t, cat } = prompt;
    const r = await patch(t.id, { category: cat, all: true }); setPrompt(null); load();
    toast(`Always ${cat} for ${title(t)}`, { undo: async () => { if (r.rule) await api(`/rules/${r.rule}`, { method: 'DELETE' }); await restore(t); load(); } });
  };
  const rename = async (t) => {
    const from = t.cleaned ?? title(t), old = t.display || from;
    const to = (await askText({ title: 'Rename this merchant', label: "Shown instead of the bank's name, on every transaction with it", value: old }))?.trim();
    if (!to || to === old) return;
    const put = (v) => api('/merchant-names', { method: 'PUT', body: JSON.stringify({ from, to: v }) });
    await put(to === from ? '' : to); load();
    toast(`Renamed ${old} to ${to}`, { undo: async () => { await put(old === from ? '' : old); load(); } });
  };
  // Ctrl+K while already on this page: pick up the new search and row.
  useEffect(() => {
    const on = () => { const h = linked(); setQ(h.get('q') ?? ''); setOpen(h.get('open')); setOpened(h.get('open')); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (opened && !data.loading) document.getElementById(`tx-${opened}`)?.scrollIntoView({ block: 'center' }); }, [opened, data.loading]);

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
  // Keyboard: j/k or arrows move a current row, Enter opens it, c picks its category, / searches, ? lists these, Esc lets go.
  // Capture phase so "/" reaches the search box before Jump's own "/" handler (which it then never sees).
  const flat = rows.map((t) => t.id);
  const keys = useRef(null);
  keys.current = { flat, cur, open, editing };
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (document.querySelector('dialog[open]')) return;
      const { flat: ids, cur: at, open: shown, editing: multi } = keys.current;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      const k = e.key;
      if (k === '/') { stop(); search.current?.focus(); search.current?.select(); }
      else if (k === '?') { stop(); window.dispatchEvent(new Event('mizo:jump')); }
      else if (k === 'j' || k === 'k' || k === 'ArrowDown' || k === 'ArrowUp') {
        if (!ids.length) return;
        stop();
        const i = ids.indexOf(at), down = k === 'j' || k === 'ArrowDown';
        const next = ids[i < 0 ? 0 : Math.min(Math.max(i + (down ? 1 : -1), 0), ids.length - 1)];
        setCur(next);
        document.getElementById('tx-' + next)?.scrollIntoView({ block: 'nearest' });
      } else if (k === 'Enter' && at != null && !['BUTTON', 'A'].includes(el?.tagName)) {
        stop();
        if (multi) toggleSel(at); else setOpen(shown === at ? null : at);
      } else if (k === 'c' && at != null) {
        const sel = document.querySelector('#tx-' + at + ' .catsel');
        if (!sel) return;
        stop(); sel.focus();
        try { sel.showPicker?.(); } catch { /* needs a recent click in some browsers; focus is enough */ }
      } else if (k === 'Escape' && at != null) setCur(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const curRow = rows.find((t) => t.id === cur);
  const filtered = !!(q || category || account || preset !== 'all');
  const cols = editing ? 5 : 4;
  return (
    <>
      <PageHeader title="Transactions">
        <a className="btn quiet" href={`/api/transactions.csv?${filterQs}`}>Download CSV</a>
        <button className={`btn quiet${editing ? ' on' : ''}`} onClick={() => { setEditing(!editing); setSel(new Set()); }}>{editing ? 'Done' : 'Edit multiple'}</button>
      </PageHeader>
      <span className="kbsr" role="status" aria-live="polite">{curRow ? `${title(curRow)}, ${label(curRow.category)}, ${usd2(-curRow.amount)}, ${shortDate(curRow.date)}` : ''}</span>
      <Review dir="in" items={review.in} decide={decide} cats={cats} />
      <Review dir="out" items={review.out} decide={decide} cats={cats} />
      <PeoplePanel data={people} cats={cats} reload={load} />
      <div className="filters filterbar">
        <input ref={search} type="search" placeholder="Search merchant or description" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
        <Select value={category} onChange={setCategory} label="Category" options={[
          { value: '', label: 'All categories' }, { value: 'unsure', label: "Plaid wasn't sure (worth a look)" },
          ...cats.map(({ group, subs }) => ({ group, options: [{ value: `g:${group}`, label: `All ${group}` }, ...(subs.length > 1 ? subs.map((c) => ({ value: c, label: c })) : [])] })),
        ]} />
        <Select value={account} onChange={setAccount} label="Account" options={[{ value: '', label: 'All accounts' }, ...accountGroups(accts)]} />
        <Select value={preset} onChange={setPreset} label="Dates" options={[
          { value: 'all', label: 'All dates' }, { value: 'this', label: 'This month' }, { value: 'last', label: 'Last month' },
          { value: '30', label: 'Last 30 days' }, { value: 'custom', label: 'Custom…' },
        ]} />
        {preset === 'custom' && <>
          <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </>}
        <label className={`sweeptoggle${sweeps ? ' on' : ''}`} title="Cash moving between an account and its own money-market fund. Not income or spending.">
          <input type="checkbox" checked={sweeps} onChange={(e) => setSweeps(e.target.checked)} /><span>Show sweeps</span></label>
      </div>
      {prompt && <ApplyPrompt p={prompt} apply={applyAll} dismiss={() => setPrompt(null)} />}
      {editing && (
        <div className="note bulkbar">
          <span>{sel.size ? `${sel.size} selected` : 'Tick the transactions to change.'}{' '}
            {rows.length > 0 && <button className="linkbtn" onClick={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((t) => t.id)))}>{sel.size === rows.length ? 'Clear' : `Select all ${rows.length}`}</button>}</span>
          <Select disabled={!sel.size} value="" onChange={applyBulk} label="Category for selected" placeholder="Set category…" wide
            options={cats.map(({ group, subs }) => ({ group, options: subs.map((c) => ({ value: c, label: c })) }))} />
        </div>
      )}
      <div className="ledger mt-sm">
        {summary && filtered && (
          <div className="cards ruled txstrip" aria-label="Summary">
            <div className="card"><h3>Transactions</h3><div className="txfig">{summary.count.toLocaleString()}</div></div>
            <div className="card"><h3>Total income</h3><div className="txfig amt good">{usd(summary.income)}</div></div>
            <div className="card"><h3 title="Net of refunds and cash back; transfers, savings and debt repayment aren't counted">Total spending</h3><div className="txfig amt">{usd(summary.spent)}</div></div>
            <div className="card"><h3>Net</h3><div className={`txfig amt${summary.income - summary.spent > 0 ? ' good' : ''}`}>{signed(summary.income - summary.spent)}</div></div>
          </div>
        )}
        <section className="card scroll sticky-head">
          <table className="t txtable">
            <thead><tr><th className="datecol" aria-label="Date" />{editing && <th />}<th>Merchant</th><th>Category</th><th>Account</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {days.map((d, di) => {
                // Each day opens with a date block in the left margin, like a daily log: the day number, the weekday
                // under it, and the day's net. It spans the day's rows (and any open details); a month heading
                // runs across when the month changes.
                const when = new Date(d.date + 'T00:00');
                const span = d.rows.reduce((n, t) => n + 1 + (t.parts?.length ?? 0) + (open === t.id && !editing ? 1 : 0), 0);
                const newMonth = di === 0 || days[di - 1].date.slice(0, 7) !== d.date.slice(0, 7);
                const block = (
                  <td className="datecell" rowSpan={span} onClick={(e) => e.stopPropagation()}>
                    <span className="dateblock" title={`${when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${Math.abs(d.net) >= 0.005 ? `, net ${signed(d.net)}` : ''}`}>
                      <span className="dbline"><b className="dbnum">{when.getDate()}</b><span className="dbday">{when.toLocaleDateString('en-US', { weekday: 'short' })}</span></span>
                      {d.rows.length > 1 && Math.abs(d.net) >= 0.005 && <span className={`dbnet amt${d.net > 0 ? ' good' : ''}`}>{signed(d.net)}</span>}
                    </span>
                  </td>
                );
                return (
                <Fragment key={d.date}>
                  {newMonth && <tr className="monthrow"><td colSpan={cols + 1}>{when.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td></tr>}
                  {d.rows.map((t, ti) => (
                    <Fragment key={t.id}>
                      <tr id={`tx-${t.id}`} aria-current={cur === t.id ? 'true' : undefined} className={`txrow${cur === t.id ? ' kbcur' : ''}${opened === t.id && open === t.id ? ' found' : ''}${sel.has(t.id) ? ' picked' : ''}${ti === 0 ? ' dayfirst' : ''}`} onClick={(e) => {
                        if (['SELECT', 'INPUT', 'BUTTON'].includes(e.target.tagName)) return;
                        if (editing) toggleSel(t.id); else setOpen(open === t.id ? null : t.id);
                      }}>
                        {ti === 0 && block}
                        {editing && <td><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} aria-label={`Select ${title(t)}`} /></td>}
                        <td className="merch" title={t.name}><span className="merchcell"><Logo t={t} /><span className="mname" title={title(t)}>{title(t)}</span><span className="mbadges">
                          {t.recurring && <Hover className="quiet" tip={<TipList title={t.bill?.name ?? 'Recurring bill'} rows={[['Schedule', t.bill?.schedule ?? '—'],
                            ['Next', t.bill?.next_date ? shortDate(t.bill.next_date) : '—']]} note="Part of a recurring bill. Change it on the Bills page." />}><span className="recur" aria-label="Recurring"><Repeat /></span></Hover>}
                          {t.pending ? <span className="badge">Pending</span> : null}
                          {t.trip_name && <button className="tripchip" title="Part of a trip: click to change" onClick={(e) => {
                            e.stopPropagation(); setOpen(t.id);
                            setTimeout(() => document.querySelector(`[data-trip-for="${t.id}"]`)?.focus(), 50);
                          }}>✈ {t.trip_name}</button>}</span></span></td>
                        <td>{t.is_split ? <span className="splitchip">Split · {t.parts?.length ?? 0} parts</span> : t.to_account || editing ? <>{t.shown_grp !== t.shown && <span className="grp">{t.shown_grp} ›</span>}{t.shown}</> : (<>
                          {t.grp !== t.category && <span className="grp">{t.grp} ›</span>}
                          <span className="catpick">
                            <span className="catname">{label(t.category)}</span>
                            <select className="catsel" value={t.category ?? ''} onChange={(e) => change(t, e.target.value)} aria-label={`Category for ${title(t)}`}>
                              {!cats.some((g) => g.subs.includes(t.category)) && <option value={t.category ?? ''}>{label(t.category)}</option>}
                              {cats.map(({ group, subs }) => (
                                <optgroup key={group} label={group}>{subs.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
                              ))}
                            </select><svg className="catchev" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5.5l4 4 4-4" /></svg></span></>)}</td>
                        <td className="acct">{accounts(t)}</td><td className="r">{amount(t)}</td>
                      </tr>
                      {t.parts?.map((p) => (
                        <tr className="txpart" key={p.id}>{editing && <td />}
                          <td className="merch"><span className="merchcell"><span className="partarrow" aria-hidden="true">↳</span><CategoryIcon group={p.grp} sub={p.category} size={20} /></span></td>
                          <td>{p.grp !== p.category && <span className="grp">{p.grp} ›</span>}{p.category}</td><td />
                          <td className="r"><span className={`tamt small${p.amount > 0 ? '' : ' good'}`}>{signed(-p.amount)}</span></td>
                        </tr>))}
                      {open === t.id && !editing && (
                        <tr className="txdetail"><td colSpan={cols}>
                          <div><span className="muted">Date</span> {shortDate(t.date)}</div>
                          <div><span className="muted">Bank description</span> {t.name}</div>
                          {!t.to_account && <div><span className="muted">Name shown</span> {title(t)} <button className="linkbtn" onClick={() => rename(t)}>Rename…</button></div>}
                          {t.pair_name && <div><span className="muted">Other side</span> {t.pair_name}</div>}
                          <div><span className="muted">Why this category</span> {why(t)}</div>
                          <div><span className="muted">Trip</span> <TripPick t={t} trips={trips} reload={load} /></div>
                          {t.peer ? <div><span className="muted">Paid back</span> <PaybackPick t={t} reload={load} /></div>
                            : t.paidback_name && <div><span className="muted">Paid back</span> {t.paidback_name}, {shortDate(t.paidback_date)} ({usd2(t.paidback_amount)})</div>}
                          {t.refund_name && <div><span className="muted">Refund of</span> {t.refund_name}, {shortDate(t.refund_date)} ({usd2(t.refund_amount)})</div>}
                          {t.counts_on && t.counts_on.slice(0, 7) !== t.date.slice(0, 7) && <div><span className="muted">Counts in</span> {monthName(t.counts_on)}, with the charge it {t.refund_name ? 'refunds' : 'paid back'}</div>}
                          {t.refunded > 0 && <div><span className="muted">Refunded</span> {usd2(t.refunded)}{t.refunded_on ? `, ${shortDate(t.refunded_on)}` : ''}{t.refunded < t.amount - 0.005 ? ` of ${usd2(t.amount)}` : ''}</div>}
                          {t.repaid > 0 && <div><span className="muted">Paid back to you</span> {usd2(t.repaid)} by friends</div>}
                          <div><span className="muted">Plaid category</span> {label(t.pfc_detailed || t.pfc_primary)}</div>
                          <div><span className="muted">Same description</span> {t.same_name} transaction{t.same_name === 1 ? '' : 's'}</div>
                          <div><span className="muted">Repeats</span> {t.recurring ? <>{t.bill?.name}, {t.bill?.schedule} · <a href="#/bills">Bills</a></> : <RepeatPick t={t} onDone={load} />}</div>
                          {!t.to_account && (splitting === t.id
                            ? <SplitEditor t={t} cats={cats} reload={load} onClose={() => setSplitting(null)} />
                            : <div><button className="linkbtn" onClick={() => setSplitting(t.id)}>{t.is_split ? 'Edit split' : 'Split into categories…'}</button></div>)}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
                );
              })}
            </tbody>
          </table>
          {data.loading && <div className="skelrows" aria-label="Loading">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={22} />)}</div>}
          {!data.loading && rows.length === 0 && <div className="empty">No transactions match.</div>}
          {summary && summary.count > rows.length && <p className="small muted foot">Showing the newest {rows.length} of {summary.count}. Narrow the filters, or download the CSV for all of them.</p>}
        </section>
      </div>
    </>
  );
}
