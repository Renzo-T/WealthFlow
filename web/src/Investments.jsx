import { Fragment, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd2, usd as usd0, allocColor } from './format.js';
import { Panel, PageHeader, PageSkeleton, Hover, TipList, tipText } from './ui.jsx';
const pct = (n, d = 1) => `${n.toFixed(d)}%`;
const signed = (n) => `${n >= 0 ? '+' : '-'}${usd0(Math.abs(n))}`;
// 401(k) plan funds come with internal codes ("SP.500.INDEX.PL.CL.C"), not tickers; only show real-looking ones.
const ticker = (h) => (h.ticker && /^[A-Z]{1,5}(\.[A-Z])?$/.test(h.ticker) ? h.ticker : null);

const kindOf = (h) => h.kind; // classified on the server (insights.js holdingKind), same as the dashboard
const RETIREMENT = /401|403|457|ira|roth|pension|keogh|retirement|sarsep|profit sharing/i;
const accountKind = (h) => (h.account_subtype === 'hsa' ? 'HSA' : RETIREMENT.test(h.account_subtype ?? '') ? 'Retirement' : 'Taxable');

const COLORS = new Proxy({}, { get: (_, k) => allocColor(k) }); // shared colours (format.js)
const ORDER = ['ETFs', 'Employer plan funds', 'Stocks', 'Mutual funds', 'Bonds', 'Cash', 'Other', 'Taxable', 'Retirement', 'HSA'];

function sumBy(rows, key) {
  const m = new Map();
  for (const h of rows) m.set(key(h), (m.get(key(h)) ?? 0) + h.value);
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
}

// One part-to-whole bar with a legend underneath. Every segment is labelled in the legend, so colour is never the only cue.
function Split({ title, parts, total, detail }) {
  return (
    <div className="split">
      <h3>{title}</h3>
      <div className="splitbar" role="img" aria-label={`${title}: ${parts.map((p) => `${p.name} ${pct((p.value / total) * 100, 0)}`).join(', ')}`}>
        {parts.filter((p) => p.value / total >= 0.002).map((p) => (
          <i key={p.name} style={{ width: `${(p.value / total) * 100}%`, background: COLORS[p.name] }} title={tipText(`${p.name}: ${usd0(p.value)} (${pct((p.value / total) * 100)})`)} />
        ))}
      </div>
      <ul className="legend2">
        {parts.map((p) => (
          <li key={p.name}><span><i className="dot" style={{ background: COLORS[p.name] }} /><Hover className="quiet" tip={detail?.(p.name)}>{p.name}</Hover></span>
            <span><b>{usd0(p.value)}</b> <span className="muted">{pct((p.value / total) * 100)}</span></span></li>
        ))}
      </ul>
    </div>
  );
}

const Gain = ({ value, cost }) => (cost == null ? <span className="muted" title="Your 401(k) provider doesn't report cost basis">—</span>
  : <span className={value - cost >= 0 ? 'good' : 'bad'}>{signed(value - cost)} <span className="small">{pct(((value - cost) / cost) * 100)}</span></span>);

export default function Investments() {
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState([]);
  const [view, setView] = useState('position');
  useEffect(() => {
    api('/holdings').then(setRows);
    api('/items').then((r) => setPending(r.items.filter((i) => i.holdings_pending).map((i) => i.institution)));
  }, []);
  if (!rows) return <PageSkeleton />;

  const total = rows.reduce((s, h) => s + h.value, 0);
  const known = rows.filter((h) => h.cost_basis != null && kindOf(h) !== 'Cash');
  const cost = known.reduce((s, h) => s + h.cost_basis, 0), knownValue = known.reduce((s, h) => s + h.value, 0);
  const cash = rows.filter((h) => kindOf(h) === 'Cash').reduce((s, h) => s + h.value, 0);
  const retirement = rows.filter((h) => accountKind(h) !== 'Taxable').reduce((s, h) => s + h.value, 0);
  const accounts = new Set(rows.map((h) => h.account_id)).size;
  const shown = rows.filter((h) => h.value >= 1); // tiny money-market balances add nothing to the table

  // Same security across accounts, combined. Gain only when every lot has a cost basis.
  const positions = [...shown.reduce((m, h) => {
    const k = ticker(h) ?? h.name;
    const p = m.get(k) ?? { key: k, name: h.name, ticker: ticker(h), kind: kindOf(h), value: 0, quantity: 0, cost: 0, allCost: true, accounts: [] };
    p.value += h.value; p.quantity += h.quantity; p.accounts.push(h);
    if (h.cost_basis == null) p.allCost = false; else p.cost += h.cost_basis;
    return m.set(k, p);
  }, new Map()).values()].sort((a, b) => b.value - a.value);
  // Every account (tiny balances included), for the hover details on the summary cards.
  const byAccountAll = [...rows.reduce((m, h) => {
    const g = m.get(h.account_id) ?? { name: h.account, institution: h.institution, kind: accountKind(h), value: 0, noCost: 0 };
    g.value += h.value;
    if (h.cost_basis == null && kindOf(h) !== 'Cash') g.noCost += h.value;
    return m.set(h.account_id, g);
  }, new Map()).values()].sort((a, b) => b.value - a.value);
  const noCost = byAccountAll.filter((g) => g.noCost >= 1).map((g) => ({ ...g, value: g.noCost }));
  const byAccount = [...shown.reduce((m, h) => {
    const g = m.get(h.account_id) ?? { id: h.account_id, name: h.account, institution: h.institution, value: 0, rows: [] };
    g.value += h.value; g.rows.push(h);
    return m.set(h.account_id, g);
  }, new Map()).values()].sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="Investments" sub="Holdings across your linked brokerage, retirement and HSA accounts." />
      {pending.length > 0 && <div className="note">
        {pending.join(', ')} {pending.length > 1 ? 'are' : 'is'} connected with investment access, but Plaid hasn't sent holdings yet.
        The first download can take a few hours after connecting; WealthFlow checks again automatically.</div>}
      {rows.length === 0 && pending.length === 0 && <div className="card empty mt">No holdings yet. Connect a brokerage or retirement account to see them here.</div>}
      {rows.length > 0 && <>
        <div className="cards">
          <div className="card"><h3>Total value</h3><div className="big">{usd0(total)}</div><div className="small muted"><Hover tip={<TipList title="By account" rows={byAccountAll.map((g) => [g.name, usd0(g.value), g.institution])} />}>{accounts} accounts</Hover> · {positions.length} positions</div></div>
          <div className="card"><h3>Unrealized gain</h3>
            <div className={`big ${cost && knownValue - cost < 0 ? 'bad' : 'good'}`}>{cost ? signed(knownValue - cost) : '—'}</div>
            <div className="small muted">{cost ? <>{pct(((knownValue - cost) / cost) * 100)} on the <Hover tip={<TipList title="Left out: no cost basis reported"
              rows={noCost.map((g) => [g.name, usd0(g.value), g.institution])} note="401(k) and similar plans usually don't report what you paid, so their gain is unknown." />}>{usd0(knownValue)} with a known cost</Hover></> : 'No cost basis reported'}</div></div>
          <div className="card"><h3>Retirement & HSA</h3><div className="big">{pct((retirement / total) * 100, 0)}</div><div className="small muted"><Hover tip={<TipList title="Tax-advantaged" rows={byAccountAll.filter((g) => g.kind !== 'Taxable').map((g) => [g.name, usd0(g.value), g.kind])} />}>{usd0(retirement)} tax-advantaged</Hover>
              {' · '}<Hover tip={<TipList title="Taxable" rows={byAccountAll.filter((g) => g.kind === 'Taxable').map((g) => [g.name, usd0(g.value), g.institution])} />}>{usd0(total - retirement)} taxable</Hover></div></div>
          <div className="card"><h3>Cash</h3><div className="big">{usd0(cash)}</div><div className="small muted">{pct((cash / total) * 100)} in money market and sweep</div></div>
        </div>

        <Panel title="Allocation">
          <div className="splits">
            <Split title="By holding type" parts={sumBy(rows, kindOf)} total={total} detail={(k) => {
              const list = positions.filter((p) => p.kind === k);
              return list.length ? <TipList title={k} rows={list.slice(0, 6).map((p) => [p.ticker ?? p.name, usd0(p.value)])} note={list.length > 6 ? `and ${list.length - 6} more` : null} /> : null;
            }} />
            <Split title="By account type" parts={sumBy(rows, accountKind)} total={total}
              detail={(k) => <TipList title={k} rows={byAccountAll.filter((g) => g.kind === k).map((g) => [g.name, usd0(g.value), g.institution])} />} />
          </div>
        </Panel>

        <Panel className="mt scroll" title="Holdings" actions={
          <div className="ranges">
            <button className={view === 'position' ? 'on' : ''} onClick={() => setView('position')}>By position</button>
            <button className={view === 'account' ? 'on' : ''} onClick={() => setView('account')}>By account</button>
          </div>}>
          <table className="t">
            <thead><tr><th>Security</th><th>{view === 'position' ? 'Held in' : 'Type'}</th><th className="r">Shares</th><th className="r">Value</th><th className="r">Share of total</th><th className="r">Gain</th></tr></thead>
            <tbody>
              {view === 'position' ? positions.map((p) => (
                <tr key={p.key}>
                  <td className="wrap"><i className="dot" style={{ background: COLORS[p.kind] }} title={p.kind} />{p.name}{p.ticker && <span className="badge">{p.ticker}</span>}</td>
                  <td className="muted">{p.accounts.length > 1
                    ? <Hover tip={<TipList title={`${p.ticker ?? p.name} by account`} rows={[...p.accounts].sort((a, b) => b.value - a.value).map((h) => [h.account,
                        usd0(h.value), p.kind === 'Cash' ? null : `${h.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })} sh`])} />}>{p.accounts.length} accounts</Hover>
                    : p.accounts[0].account}</td>
                  <td className="r">{p.kind === 'Cash' ? '' : p.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })}</td>
                  <td className="r"><b>{usd0(p.value)}</b></td>
                  <td className="r"><span className="sharebar"><i style={{ width: `${(p.value / total) * 100}%` }} /></span>{pct((p.value / total) * 100)}</td>
                  <td className="r">{p.kind === 'Cash' ? '' : <Gain value={p.value} cost={p.allCost ? p.cost : null} />}</td>
                </tr>
              )) : byAccount.map((g) => (
                <Fragment key={g.id}>
                  <tr className="grouprow"><td colSpan="3"><b>{g.name}</b> <span className="small muted">{g.institution}</span></td>
                    <td className="r"><b>{usd0(g.value)}</b></td><td className="r">{pct((g.value / total) * 100)}</td><td /></tr>
                  {g.rows.map((h) => (
                    <tr key={h.account_id + h.security_id}>
                      <td style={{ paddingLeft: '1.5rem' }}>{h.name}{ticker(h) && <span className="badge">{ticker(h)}</span>}</td>
                      <td className="muted"><i className="dot" style={{ background: COLORS[kindOf(h)] }} />{kindOf(h)}</td>
                      <td className="r">{kindOf(h) === 'Cash' ? '' : h.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })}</td>
                      <td className="r">{usd2(h.value)}</td><td className="r">{pct((h.value / total) * 100)}</td>
                      <td className="r">{kindOf(h) === 'Cash' ? '' : <Gain value={h.value} cost={h.cost_basis} />}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="small muted foot">
            Values are as of each provider's last price update. Gain is value minus what you paid, where the provider reports it
            (401(k) plans usually don't). Cash balances under a dollar are hidden.</p>
        </Panel>
      </>}
    </>
  );
}
