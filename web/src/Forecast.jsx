import { useEffect, useState } from 'react';
import { api } from './api.js';
import { usd } from './Cards.jsx';
import { usdCompact } from './format.js';
import { ProjectionChart } from './Projection.jsx';
import { useAssumptions, buildSeries } from './projection.js';
import { Panel, PanelSkeleton } from './ui.jsx';

// The second half of the Plan page (below Goals), which owns the page title.
export default function Forecast() {
  const [s, setS] = useState(null);
  const [cf, setCf] = useState(null);
  const [cov, setCov] = useState(null);
  const [a, update] = useAssumptions();
  useEffect(() => { api('/summary').then(setS); api('/cashflow').then(setCf); api('/coverage').then(setCov); }, []);
  if (!s || !cf) return <div className="mt"><PanelSkeleton lines={3} chart={180} /></div>;
  if (!s.history.length) return <div className="card empty mt">Connect a bank to project your net worth.</div>;

  const { series, avg, months, years, income, spending, used, inflation, real, target } = buildSeries(a, s.netWorth.value, cf);
  const dollars = real ? "today's dollars" : 'future dollars';
  const thisYear = new Date().getFullYear();
  const mon = (k) => new Date(k + '-01T00:00').toLocaleDateString('en-US', { month: 'short' });
  const since = (d) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <Panel className="mt forecast" title="Forecast">
      <p className="muted mt-0">Project your net worth from <span className="amt">{usd(s.netWorth.value)}</span> today, in {dollars}.</p>
      <div className="form">
        <label className="lbl">Monthly contribution
          <input type="number" step="any" value={a.monthly} onChange={(e) => update({ monthly: e.target.value })} placeholder={avg == null ? '0' : `Average ${Math.round(avg).toLocaleString('en-US')}`} /></label>
        <label className="lbl">Horizon
          <select value={a.years} onChange={(e) => update({ years: e.target.value })}>
            {[10, 20, 30, 40].map((y) => <option key={y} value={y}>{y} years</option>)}
          </select></label>
        <label className="lbl">Target (optional)
          <input type="number" step="any" min="0" value={a.target} onChange={(e) => update({ target: e.target.value })} placeholder="e.g. 1,000,000" /></label>
      </div>
      <details className="assump">
        <summary><b>Assumptions</b><span>Returns {series.map((sc) => sc.rate).join(' / ')}%, inflation {+inflation}%, {dollars}</span></summary>
        <div className="form">
          <label className="lbl">Inflation (%)
            <input className="mini" type="number" step="any" min="0" value={a.inflation} onChange={(e) => update({ inflation: e.target.value })} /></label>
          <label className="lbl">Show figures in
            <select value={real ? 'today' : 'future'} onChange={(e) => update({ dollars: e.target.value })}>
              <option value="today">Today's dollars</option>
              <option value="future">Future dollars</option>
            </select></label>
          {series.map((sc) => (
            <label className="lbl" key={sc.key}>{sc.label} return (%)
              <input className="mini" type="number" step="any" value={a.rates[sc.key]} onChange={(e) => update({ rates: { ...a.rates, [sc.key]: e.target.value } })} /></label>
          ))}
        </div>
      </details>
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
      <div className="fsec">
        <div className="head"><h2>Net worth projection</h2></div>
        <ProjectionChart series={series} years={years} target={target} real={real} />
        <table className="t">
          <thead><tr><th>Scenario</th><th className="r">Annual return</th><th className="r">In {years} years <span className="muted dollars">in {dollars}</span></th>
            {target && <th className="r">Reaches target</th>}</tr></thead>
          <tbody>{[...series].reverse().map((sc) => (
            <tr key={sc.key}><td>{sc.label}</td><td className="r">{sc.rate}%</td><td className="r"><b className="amt" title="Rounded: a guess this far out isn't good to the dollar">{usdCompact(sc.values.at(-1), 1)}</b></td>
              {target && <td className="r">{sc.reaches == null ? <span className="muted">not within {years} years</span>
                : sc.reaches === 0 ? 'Already there' : <>in {sc.reaches} {sc.reaches === 1 ? 'year' : 'years'} <span className="muted">({thisYear + sc.reaches})</span></>}</td>}
            </tr>
          ))}</tbody>
        </table>
        <p className="small muted foot">
          One growth rate is applied to your whole net worth, compounded monthly, with the same contribution added every month (it does not rise with inflation).
          {real ? <> Figures are in today's dollars: each year's value is divided by {+(1 + inflation / 100).toFixed(4)} once for every year that passes, so they show what the money would buy now.</>
            : <> Figures are in future dollars: the balance as it would read then, with no allowance for prices rising.</>}
          {target ? <> The target is compared in the same dollars.</> : null}
          {' '}Taxes are ignored. Your assumptions are saved in this browser only.
        </p>
      </div>
    </Panel>
  );
}
