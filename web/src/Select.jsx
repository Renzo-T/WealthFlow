import { useEffect, useId, useMemo, useRef, useState } from 'react';

// A custom select that looks like the Jump menu: a quiet button that opens a solid list. Listbox pattern:
// Up/Down/Home/End move, Enter or Space picks, Escape closes, typing jumps to a match.
// options: [{ value, label }] or, for groups, [{ group: 'Name', options: [{ value, label }] }] (loose options may sit between).
export default function Select({ value, onChange, options, label, placeholder = 'Select…', className = '', disabled = false, wide = false }) {
  const id = useId();
  const root = useRef(null), list = useRef(null), typed = useRef({ s: '', t: 0 });
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);

  // Flatten to rows: group headings (not selectable) and options.
  const rows = useMemo(() => options.flatMap((o) => (o.group
    ? [{ head: o.group }, ...o.options.map((x) => ({ ...x, v: String(x.value), grouped: true }))]
    : [{ ...o, v: String(o.value) }])), [options]);
  const opts = rows.map((r, i) => ({ r, i })).filter((x) => !x.r.head);
  const current = rows.find((r) => !r.head && r.v === String(value ?? ''));

  const show = () => {
    if (disabled) return;
    const i = opts.findIndex((x) => x.r === current);
    setAt(i >= 0 ? opts[i].i : opts[0]?.i ?? 0);
    setOpen(true);
  };
  const pick = (r) => { setOpen(false); root.current?.querySelector('button')?.focus(); if (r && r.v !== String(value ?? '')) onChange(r.value); };

  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-${at}`)?.scrollIntoView?.({ block: 'nearest' }); }, [open, at, id]);

  const move = (step) => {
    const k = opts.findIndex((x) => x.i === at);
    setAt(opts[Math.min(Math.max(k + step, 0), opts.length - 1)]?.i ?? at);
  };
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setAt(opts[0]?.i ?? 0); }
    else if (e.key === 'End') { e.preventDefault(); setAt(opts.at(-1)?.i ?? 0); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(rows[at]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) { // type-ahead
      const now = Date.now(), t = typed.current;
      t.s = now - t.t > 700 ? e.key.toLowerCase() : t.s + e.key.toLowerCase(); t.t = now;
      const hit = opts.find((x) => String(x.r.label).toLowerCase().startsWith(t.s));
      if (hit) setAt(hit.i);
    }
  };

  return (
    <div className={`sel${wide ? ' wide' : ''}${open ? ' open' : ''} ${className}`} ref={root}>
      <button type="button" className="selbtn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${at}` : undefined} disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}>
        <span className="selval">{current ? current.label : placeholder}</span>
        <svg className="selchev" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5.5l4 4 4-4" /></svg>
      </button>
      {open && (
        <ul id={`${id}-list`} ref={list} className="selmenu" role="listbox" aria-label={label}>
          {rows.map((r, i) => (r.head
            ? <li key={`h${i}`} className="selhead" role="presentation">{r.head}</li>
            : <li key={r.v} id={`${id}-${i}`} role="option" aria-selected={r.v === String(value ?? '')} className={`${i === at ? 'on' : ''}${r.grouped ? ' sub' : ''}`}
              onMouseMove={() => i !== at && setAt(i)} onClick={() => pick(r)}>{r.label}</li>))}
        </ul>
      )}
    </div>
  );
}
