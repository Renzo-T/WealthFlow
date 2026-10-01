import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd } from './Cards.jsx';
import { ProjectionChart, Legend } from './Projection.jsx';
import { useAssumptions, buildSeries } from './projection.js';
import { Panel, PageHeader, PageSkeleton } from './ui.jsx';

export default function Forecast() {
  const [s, setS] = useState(null);
  const [cf, setCf] = useState(null);
  const [cov, setCov] = useState(null);
  const [a, update] = useAssumptions();
  useEffect(() => { api('/summary').then(setS); api('/cashflow').then(setCf); api('/coverage').then(setCov); }, []);
  if (!s || !cf) return <PageSkeleton />;
  if (!s.history.length) return <div className="card empty mt">Connect a bank to project your net worth.</div>;

  const { series, avg, months, years, income, spending, used } = buildSeries(a, s.netWorth.value, cf);
  const mon = (k) => new Date(k + '-01T00:00').toLocaleDateString('en-US', { month: 'short' });
  const since = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <>
      <PageHeader title="Forecast" sub={<>Project your net worth from <span className="amt">{usd(s.netWorth.value)}</span> today.</>} />
      <div className="form">
        <label className="lbl">Monthly contribution
          <input type="number" step="any" value={a.monthly} onChange={(e) => update({ monthly: e.target.value })} placeholder={String(Math.round(avg ?? 0))} /></label>
        <label className="lbl">Horizon
          <select value={a.years} onChange={(e) => update({ years: e.target.value })}>
            {[10, 20, 30, 40].map((y) => <option key={y} value={y}>{y} years</option>)}
          </select></label>
        {series.map((sc) => (
          <label className="lbl" key={sc.key}>{sc.label} return (%)
            <input className="mini" type="number" step="any" value={a.rates[sc.key]} onChange={(e) => update({ rates: { ...a.rates, [sc.key]: e.target.value } })} /></label>
        ))}
      </div>
      <div className="explain small">
        {avg == null ? <>
          <b>Your average: not available yet, so an empty contribution uses $0.</b>
          <div className="muted">It needs a finished month with history from every connected bank.
            {cov?.latest && (() => {
              // First complete month: the month the latest bank's history starts in if it starts on the 1st, else the next one.
              const [y, m, d] = cov.latest.first.split('-').map(Number);
              const full = new Date(y, m - 1 + (d === 1 ? 0 : 1), 1), ready = new Date(full.getFullYear(), full.getMonth() + 1, 1);
              const name = (x) => x.toLocaleDateString('en-US', { month: 'long' });
              return <> {cov.latest.institution}'s history starts {since(cov.latest.first)}, so {name(full)} is the first complete month and the average appears in {name(ready)}.</>;
            })()}
            {' '}Enter your own monthly amount above to override it.</div>
        </> : <>
          <b>Your average: {usd(avg)} a month</b>{a.monthly !== '' && <span className="muted"> (not used: you entered your own amount)</span>}
          <div className="muted">Income {usd(income)} − spending {usd(spending)}, averaged over {used.map(mon).join(', ')}
            {months < 3 ? ` (only ${months} complete month${months > 1 ? 's' : ''} so far)` : ''}. Transfers, savings and debt payments aren't counted as spending.</div>
        </>}
      </div>
      <Panel title="Net worth projection" actions={<Legend series={series} />}>
        <ProjectionChart series={series} years={years} />
        <table className="t">
          <thead><tr><th>Scenario</th><th className="r">Annual return</th><th className="r">In {years} years</th></tr></thead>
          <tbody>{[...series].reverse().map((sc) => (
            <tr key={sc.key}><td><i className="dot" style={{ background: sc.color }} />{sc.label}</td><td className="r">{sc.rate}%</td><td className="r"><b>{usd(sc.values.at(-1))}</b></td></tr>
          ))}</tbody>
        </table>
        <p className="small muted foot">
          One growth rate is applied to your whole net worth, contributions are added monthly, and taxes and inflation are ignored.
          Your assumptions are saved in this browser only.
        </p>
      </Panel>
    </>
  );
}
