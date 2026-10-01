import { useEffect, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from './api.js';

// Plaid Link buttons: connect a new bank, or update an existing one (sign in again / approve more products).
// Normally Plaid's Hosted Link: its page opens in a new tab (it handles banks' sign-in redirects itself) and this
// page asks the server every couple of seconds whether you've finished. If Plaid gives no hosted page, the embedded
// Link opens instead; its state survives a bank's OAuth redirect in localStorage, because the page reloads at /oauth.

export const clearLink = () => ['link_token', 'link_mode', 'link_item', 'link_products'].forEach((k) => localStorage.removeItem(k));
// After update mode succeeds: record what was granted right away (Plaid's own records can lag), then sync.
const finishUpdate = async (item = localStorage.getItem('link_item'), products = localStorage.getItem('link_products')) => {
  if (item && products) await api(`/link/granted/${item}`, { method: 'POST', body: JSON.stringify({ products: products.split(',') }) });
  await api('/sync', { method: 'POST' });
};
const reload = () => window.location.assign(window.location.pathname + window.location.hash);

// Opens Plaid's page and waits for it. `begin(getToken, onFinished)`: the tab is opened straight away (browsers only
// allow pop-ups opened directly by a click), then pointed at Plaid once the token arrives.
function useHostedLink() {
  const [state, setState] = useState(null); // null | 'opening' | 'waiting' | message
  const timer = useRef(null), tab = useRef(null);
  const stop = () => { clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const begin = async (getToken, onFinished, fallback) => {
    const w = window.open('', '_blank');
    setState('opening');
    const r = await getToken();
    if (!r?.link_token) { w?.close(); setState(null); window.alert(r?.error_message || 'Could not start Plaid.'); return; }
    if (!r.hosted_link_url || !w) { w?.close(); setState(null); fallback(r); return; } // no hosted page, or pop-up blocked
    w.opener = null; w.location.href = r.hosted_link_url; tab.current = w;
    setState('waiting');
    let closedFor = 0;
    timer.current = setInterval(async () => {
      const s = await api(`/link/status/${r.link_token}${r.update ? '?update=1' : ''}`).catch(() => null);
      if (s?.error_message) { stop(); setState(s.error_message); return; }
      if (s?.done) { stop(); if (s.cancelled) setState(s.error || null); else { setState('Finishing…'); await onFinished(s); } return; }
      // Tab closed without finishing: Plaid records the exit a little later, so check a few more times, then stop.
      if (tab.current?.closed && ++closedFor > 5) { stop(); setState(null); }
    }, 2000);
  };
  const cancel = () => { stop(); tab.current?.close(); setState(null); };
  return { state, begin, cancel };
}

function Waiting({ state, cancel }) {
  if (state === 'opening') return <span className="small muted">Opening Plaid…</span>;
  if (state === 'waiting') return <span className="row gap small">Finish connecting in the Plaid tab… <button className="btn" onClick={cancel}>Cancel</button></span>;
  return <span className="row gap small">{state} {state !== 'Finishing…' && <button className="btn" onClick={cancel}>OK</button>}</span>;
}

// Embedded Link with a token in hand: opens at once. `resume` = the bank just redirected back to /oauth; reopen Link
// with the SAME token to finish.
function Embedded({ token, resume = false, onSuccess, onExit }) {
  const { open, ready } = usePlaidLink({ token, receivedRedirectUri: resume ? window.location.href : undefined, onSuccess, onExit });
  useEffect(() => { if (ready) open(); }, [ready, open]);
  return resume ? <p>Finishing bank connection…</p> : null;
}

export function ConnectBank({ resume = false, label = 'Connect a bank', className = 'btn primary' }) {
  const { state, begin, cancel } = useHostedLink();
  const [embedded, setEmbedded] = useState(resume ? localStorage.getItem('link_token') : null);
  const done = async () => { clearLink(); window.location.assign('/'); };
  const onSuccess = async (public_token, meta) => {
    if (resume && localStorage.getItem('link_mode') === 'update') await finishUpdate();
    else await api('/link/exchange', { method: 'POST', body: JSON.stringify({ public_token, institution: meta.institution?.name }) });
    done();
  };
  if (resume) return <Embedded token={embedded} resume onSuccess={onSuccess} onExit={() => window.location.assign('/')} />;
  // Plaid's page couldn't be used: embedded Link, with a token made for it.
  const fallback = async () => {
    const r = await api('/link/token?hosted=0', { method: 'POST' });
    localStorage.setItem('link_token', r.link_token); localStorage.setItem('link_mode', 'new');
    setEmbedded(r.link_token);
  };
  if (state) return <Waiting state={state} cancel={cancel} />;
  return <>
    <button className={className} onClick={() => begin(() => api('/link/token', { method: 'POST' }), done, fallback)}>{label}</button>
    {embedded && <Embedded token={embedded} onSuccess={onSuccess} onExit={() => { clearLink(); setEmbedded(null); }} />}
  </>;
}

// Update mode for an existing connection: sign in again (no products), or approve more (products=
// "investments,liabilities").
export function UpdateLink({ item, label, products, onDone, className = 'btn' }) {
  const { state, begin, cancel } = useHostedLink();
  const [embedded, setEmbedded] = useState(null);
  const path = (hosted) => `/link/update-token/${item.id}?${products ? `products=${products}&` : ''}${hosted ? '' : 'hosted=0'}`;
  const getToken = async (hosted = true) => {
    const r = await api(path(hosted), { method: 'POST' });
    if (!r.link_token) { if (r.dismissed) onDone?.(); return r; }
    if (r.dropped?.length) window.alert(`${item.institution} doesn't share ${r.dropped.join(' or ')} through Plaid; asking for the rest.`);
    return { ...r, update: true };
  };
  const finished = async () => { await finishUpdate(item.id, products ?? ''); clearLink(); reload(); };
  const fallback = async () => {
    const r = await getToken(false);
    if (!r.link_token) return;
    localStorage.setItem('link_token', r.link_token); localStorage.setItem('link_mode', 'update');
    localStorage.setItem('link_item', item.id); localStorage.setItem('link_products', products ?? '');
    setEmbedded(r.link_token);
  };
  if (state) return <Waiting state={state} cancel={cancel} />;
  return <>
    <button className={className} onClick={() => begin(getToken, finished, fallback)}>{label}</button>
    {embedded && <Embedded token={embedded} onSuccess={finished} onExit={() => { clearLink(); setEmbedded(null); }} />}
  </>;
}

// What a bank could still share, as products for UpdateLink and as words for people.
export const missing = (i) => ({
  products: [i.needs_investments && 'investments', i.needs_liabilities && 'liabilities'].filter(Boolean).join(','),
  text: [i.needs_investments && 'investment holdings', i.needs_liabilities && 'card statements'].filter(Boolean).join(' and '),
});
