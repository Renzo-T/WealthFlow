import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Amt } from './ui.jsx';
import { signed } from './format.js';

// Ctrl+K, or / when focus isn't in a field: one small dialog to go to a page or find a transaction.
const typing = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export default function Jump({ pages, commands = [] }) {
  const dlg = useRef(null), input = useRef(null), from = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [txs, setTxs] = useState([]);
  const [places, setPlaces] = useState([]); // bills, goals and accounts, fetched when the dialog opens
  const [at, setAt] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      if (dlg.current?.open) return;
      const ctrlK = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(document.activeElement);
      if (!ctrlK && !slash) return;
      e.preventDefault();
      from.current = document.activeElement;
      setText(''); setTxs([]); setAt(0); setOpen(true);
      dlg.current?.showModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let stale = false;
    const list = (path, kind, to, name) => api(path).then((r) => (Array.isArray(r) ? r.map((x) => ({ kind, to, name: name(x), id: x.id ?? x.key })) : [])).catch(() => []);
    Promise.all([
      list('/bills', 'Bill', '#/bills', (b) => b.name),
      list('/goals', 'Goal', '#/plan', (g) => g.name),
      list('/accounts', 'Account', '#/networth', (a) => a.nickname || a.name),
    ]).then((all) => { if (!stale) setPlaces(all.flat().filter((x) => x.name)); });
    return () => { stale = true; };
  }, [open]);

  // After 2 characters, ask the transactions list (its text filter is `q`). A slower, older answer never overwrites a newer one.
  const term = text.trim();
  useEffect(() => {
    if (!open || term.length < 2) { setTxs([]); return undefined; }
    let stale = false;
    const t = setTimeout(() => {
      api(`/transactions?${new URLSearchParams({ q: term, limit: 6 })}`).then((r) => { if (!stale && Array.isArray(r)) setTxs(r); }).catch(() => {});
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [term, open]);

  const low = term.toLowerCase();
  const hits = pages.filter((p) => p.label.toLowerCase().includes(low));
  const cmds = commands.filter((c) => c.label.toLowerCase().includes(low));
  const found = term.length >= 2 ? places.filter((x) => x.name.toLowerCase().includes(low)).slice(0, 5) : [];
  const items = [...hits.map((p) => ({ kind: 'page', key: `p-${p.id}`, page: p })), ...cmds.map((c) => ({ kind: 'cmd', key: `c-${c.label}`, cmd: c })), ...found.map((x) => ({ kind: 'place', key: `l-${x.kind}-${x.id}`, place: x })), ...txs.map((t) => ({ kind: 'tx', key: `t-${t.id}`, tx: t }))];
  const cur = Math.min(at, Math.max(items.length - 1, 0));

  const close = () => dlg.current?.close();
  const go = (item) => {
    if (!item) return;
    if (item.kind === 'cmd') { close(); item.cmd.run(); return; }
    window.location.hash = item.kind === 'page' ? `#/${item.page.id}` : item.kind === 'place' ? item.place.to : `#/transactions?${new URLSearchParams({ q: term, open: item.tx.id })}`;
    close();
  };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((cur + 1) % Math.max(items.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((cur - 1 + items.length) % Math.max(items.length, 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[cur]); }
  };
  useEffect(() => { document.getElementById(`jump-${cur}`)?.scrollIntoView?.({ block: 'nearest' }); }, [cur, items.length]);

  return (
    <dialog ref={dlg} className="jump" aria-label="Go to a page or find a transaction"
      onClose={() => { setOpen(false); const el = from.current; from.current = null; if (el?.isConnected) el.focus(); }}
      onClick={(e) => { if (e.target === dlg.current) close(); }}>
      {open && <>
        <input ref={input} autoFocus type="text" role="combobox" aria-expanded="true" aria-controls="jump-list" aria-autocomplete="list"
          aria-activedescendant={items.length ? `jump-${cur}` : undefined} placeholder="Go to a page, or search transactions"
          aria-label="Go to a page or search transactions" value={text} onChange={(e) => { setText(e.target.value); setAt(0); }} onKeyDown={onInputKey} />
        <ul id="jump-list" role="listbox" aria-label="Results">
          {items.map((it, i) => (
            <li key={it.key} id={`jump-${i}`} role="option" aria-selected={i === cur} className={i === cur ? 'on' : ''}
              onMouseMove={() => setAt(i)} onClick={() => go(it)}>
              {it.kind === 'page'
                ? <><span>{it.page.label}</span><span className="muted small">Page</span></>
                : it.kind === 'cmd' ? <><span>{it.cmd.label}</span><span className="muted small">Command</span></>
                : it.kind === 'place' ? <><span>{it.place.name}</span><span className="muted small">{it.place.kind}</span></>
                : <><span className="jtx"><b>{it.tx.merchant || it.tx.name}</b> <span className="muted small">{it.tx.date}</span></span>
                  <Amt>{signed(-it.tx.amount)}</Amt></>}
            </li>))}
          {!items.length && <li className="jnone muted" role="presentation">{term.length < 2 ? 'No page matches.' : 'Nothing found.'}</li>}
        </ul>
        <p className="small muted jhint">↑ ↓ to move · Enter to open · Esc to close</p>
      </>}
    </dialog>
  );
}
