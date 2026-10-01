import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from './api.js';

// Plaid Link buttons: connect a new bank, or update an existing one (sign in again / approve more products).
// Link state survives a bank's OAuth redirect in localStorage, because the page reloads at /oauth.

export const clearLink = () => ['link_token', 'link_mode', 'link_item', 'link_products'].forEach((k) => localStorage.removeItem(k));
// After update mode succeeds: record what was granted right away (Plaid's own records can lag), then sync.
const finishUpdate = async () => {
  const item = localStorage.getItem('link_item'), products = localStorage.getItem('link_products');
  if (item && products) await api(`/link/granted/${item}`, { method: 'POST', body: JSON.stringify({ products: products.split(',') }) });
  await api('/sync', { method: 'POST' });
};

// `resume` = the bank just redirected back to /oauth; reopen Link with the SAME token to finish.
export function ConnectBank({ resume = false, label = 'Connect a bank', className = 'btn primary' }) {
  const [token, setToken] = useState(resume ? localStorage.getItem('link_token') : null);
  useEffect(() => { if (!resume) api('/link/token', { method: 'POST' }).then((r) => setToken(r.link_token ?? null)); }, [resume]);
  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri: resume ? window.location.href : undefined,
    onSuccess: async (public_token, meta) => {
      if (resume && localStorage.getItem('link_mode') === 'update') await finishUpdate();
      else await api('/link/exchange', { method: 'POST', body: JSON.stringify({ public_token, institution: meta.institution?.name }) });
      clearLink();
      window.location.assign('/');
    },
    onExit: () => resume && window.location.assign('/'),
  });
  useEffect(() => { if (resume && ready) open(); }, [resume, ready, open]);
  if (resume) return <p>Finishing bank connection…</p>;
  const start = () => { localStorage.setItem('link_token', token); localStorage.setItem('link_mode', 'new'); open(); };
  return <button className={className} disabled={!ready} onClick={start}>{label}</button>;
}

// Update mode for an existing connection: sign in again (no products), or approve more (products=
// "investments,liabilities").
export function UpdateLink({ item, label, products, onDone, className = 'btn' }) {
  const [token, setToken] = useState(null);
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async () => { await finishUpdate(); clearLink(); window.location.assign(window.location.pathname + window.location.hash); },
    onExit: () => setToken(null),
  });
  useEffect(() => { if (token && ready) open(); }, [token, ready, open]);
  const start = async () => {
    const r = await api(`/link/update-token/${item.id}${products ? `?products=${products}` : ''}`, { method: 'POST' });
    if (!r.link_token) { window.alert(r.error_message || 'Could not start the update.'); if (r.dismissed) onDone?.(); return; }
    if (r.dropped?.length) window.alert(`${item.institution} doesn't share ${r.dropped.join(' or ')} through Plaid; asking for the rest.`);
    localStorage.setItem('link_token', r.link_token); localStorage.setItem('link_mode', 'update');
    localStorage.setItem('link_item', item.id); localStorage.setItem('link_products', products ?? '');
    setToken(r.link_token);
  };
  return <button className={className} onClick={start}>{label}</button>;
}

// What a bank could still share, as products for UpdateLink and as words for people.
export const missing = (i) => ({
  products: [i.needs_investments && 'investments', i.needs_liabilities && 'liabilities'].filter(Boolean).join(','),
  text: [i.needs_investments && 'investment holdings', i.needs_liabilities && 'card statements'].filter(Boolean).join(' and '),
});
