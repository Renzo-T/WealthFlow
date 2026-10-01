import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usd, usd2, shortDate, SERIES, NEUTRAL } from './format.js';
import { Panel, PageHeader, PageSkeleton, EmptyState, Hover, TipList } from './ui.jsx';
import CategoryIcon from './CategoryIcon.jsx';

// "Sep 7 – 12, 2026", "Nov 16 – Dec 1, 2025", "Dec 28, 2025 – Jan 3, 2026".
const range = (t) => {
  const a = new Date(`${t.start}T00:00`), b = new Date(`${t.end}T00:00`);
  const md = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (t.start === t.end) return `${md(a)}, ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${md(a)}, ${a.getFullYear()} – ${md(b)}, ${b.getFullYear()}`;
  return `${md(a)} – ${a.getMonth() === b.getMonth() ? b.getDate() : md(b)}, ${b.getFullYear()}`;
};

// Where the money went on a trip: the top three categories in colour, the rest grey, each named in the legend.
function CategoryBar({ cats, total }) {
  const parts = [...cats.slice(0, 3).map((c, i) => ({ ...c, color: SERIES[i] })),
    ...(cats.length > 3 ? [{ category: 'Everything else', total: cats.slice(3).reduce((s, c) => s + c.total, 0), color: NEUTRAL, rest: cats.slice(3) }] : [])]
    .filter((p) => p.total > 0);
  if (!total || !parts.length) return null;
  return (
    <>
      <div className="splitbar">{parts.map((p) => <i key={p.category} style={{ width: `${(p.total / total) * 100}%`, background: p.color }} />)}</div>
      <ul className="legend2 compact">{parts.map((p) => (
        <li key={p.category}><span><i className="dot" style={{ background: p.color }} />
          {p.rest ? <Hover className="quiet" tip={<TipList rows={p.rest.map((r) => [r.category, usd(r.total)])} />}>{p.category}</Hover> : p.category}</span>
          <span className="amt">{usd(p.total)}</span></li>))}</ul>
    </>
  );
}

// Suggestions for a trip (bookings made before it, settle-ups with friends): + adds one, × says it isn't part of the
// trip (so it stops being suggested), and the whole list can be added or dismissed at once.
function Suggest({ title, items, trip, onTrip, reload, label }) {
  if (!items.length) return null;
  const all = async (value) => { for (const b of items) await api(`/transactions/${b.id}/trip`, { method: 'POST', body: JSON.stringify({ trip: value }) }); reload(); };
  return (
    <div className="tripbook">
      <span className="small muted">{title}</span>
      {items.map((b) => (
        <span key={b.id} className="chippair">
          <button className="chipbtn" onClick={() => onTrip(b.id, trip.id)} title={`Add to ${trip.name}`}>+ {label(b)}</button>
          <button className="chipx" onClick={() => onTrip(b.id, 'none')} title="Not part of this trip" aria-label={`${b.name}: not part of this trip`}>×</button>
        </span>))}
      {items.length > 1 && <span className="tripbookall">
        <button className="linkbtn small" onClick={() => all(trip.id)}>Add all</button>
        <button className="linkbtn small" onClick={() => all('none')}>None of these</button></span>}
    </div>
  );
}

function TripCard({ trip, reload }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: trip.name, start: trip.start, end: trip.end });
  const patch = async (body) => { await api(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify(body) }); reload(); };
  const onTrip = async (id, value) => { await api(`/transactions/${id}/trip`, { method: 'POST', body: JSON.stringify({ trip: value }) }); reload(); };
  const remove = async () => {
    if (!window.confirm(`Delete "${trip.name}"? Its purchases stay as they are; they just aren't grouped as a trip.`)) return;
    await api(`/trips/${trip.id}`, { method: 'DELETE' }); reload();
  };
  return (
    <section className="card tripcard">
      {edit ? (
        <form className="form" onSubmit={(e) => { e.preventDefault(); patch(f); setEdit(false); }}>
          <label className="lbl">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="lbl">From<input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required /></label>
          <label className="lbl">To<input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} required /></label>
          <button className="btn primary" type="submit">Save</button><button className="btn" type="button" onClick={() => setEdit(false)}>Cancel</button>
        </form>
      ) : (
        <div className="row base"><span><b className="tripname">{trip.name}</b>{trip.place && <span className="small muted"> · {trip.place}</span>}</span>
          <span className="btnrow"><button className="linkbtn" onClick={() => setEdit(true)}>Edit</button><button className="linkbtn" onClick={remove}>Delete</button></span></div>
      )}
      <div className="small muted">{range(trip)} · {trip.days} day{trip.days > 1 ? 's' : ''}</div>
      <div className="tripnums">
        <div><span className="big amt">{usd(trip.total)}</span><span className="small muted">{trip.count} purchase{trip.count === 1 ? '' : 's'}</span></div>
        <div className="r"><b className="amt">{usd(trip.total / trip.days)}</b><span className="small muted">a day</span></div>
      </div>
      <CategoryBar cats={trip.categories} total={trip.total} />
      <Suggest title="Booked before the trip?" items={trip.bookings} trip={trip} onTrip={onTrip} reload={reload}
        label={(b) => <>{b.name} {usd2(b.amount)} <span className="muted">{shortDate(b.date)}</span></>} />
      <Suggest title="Settling up?" items={trip.settleUps ?? []} trip={trip} onTrip={onTrip} reload={reload}
        label={(b) => <>{b.name} {b.amount < 0 ? '−' : ''}{usd2(Math.abs(b.amount))} <span className="muted">{shortDate(b.date)}</span></>} />
      <button className="linkbtn foot" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} the {trip.count} purchase{trip.count === 1 ? '' : 's'}</button>
      {open && trip.items.map((t) => (
        <div className="trow small" key={t.id}>
          <span className="rowicon"><CategoryIcon group={t.grp} sub={t.category} size={22} /><span className="tmain"><b>{t.name}</b><span className="muted">{shortDate(t.date)} · {t.category}</span></span></span>
          <span className="btnrow"><b className="amt">{usd2(t.amount)}</b>
            <button className="linkbtn" onClick={() => onTrip(t.id, 'none')} aria-label={`Not part of ${trip.name}`} title="Not part of this trip">×</button></span>
        </div>
      ))}
    </section>
  );
}

// Suggested trips: confirm (optionally renamed) or dismiss.
function Suggestion({ trip, reload }) {
  const [name, setName] = useState(trip.name);
  const patch = async (status) => { await api(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify({ status, name }) }); reload(); };
  return (
    <div className="tripsug">
      <span className="tmain"><input className="tripname-in" value={name} onChange={(e) => setName(e.target.value)} aria-label="Trip name" />
        <span className="small muted">{range(trip)} · {trip.count} purchases · {trip.categories.slice(0, 3).map((c) => c.category).join(', ')}</span></span>
      <b className="amt">{usd(trip.total)}</b>
      <span className="btnrow"><button className="btn primary" onClick={() => patch('confirmed')}>It was a trip</button><button className="btn" onClick={() => patch('dismissed')}>No</button></span>
    </div>
  );
}

const monthYear = (d) => new Date(`${d}T00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const MODES = [['distance', 'More than'], ['state', 'In another state'], ['country', 'Only in another country']];
function HomeAndAway({ home, settings, reload }) {
  const [edit, setEdit] = useState(false);
  const [rows, setRows] = useState(home.map(({ city, region, since, until }) => ({ city, region: region ?? '', since, until: until ?? '' })));
  const [s, setS] = useState(settings);
  const [err, setErr] = useState('');
  const saveSettings = async (next) => { setS(next); await api('/settings/travel', { method: 'PUT', body: JSON.stringify(next) }); reload(); };
  const saveHomes = async (list) => {
    const r = await api('/home-bases', { method: 'PUT', body: JSON.stringify(list) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setEdit(false); reload();
  };
  const inferred = !home.some((b) => b.set);
  return (
    <Panel className="mt" title="Home & away">
      <p className="small muted mt-0">Purchases count as away from home when they're made in person far enough from where home was at the time.</p>
      <div className="awayrow">
        <span>Away means</span>
        <select value={s.mode} onChange={(e) => saveSettings({ ...s, mode: e.target.value })} aria-label="What counts as away">
          {MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {s.mode === 'distance' && <><input className="mini" type="number" min="10" max="2000" step="10" value={s.miles} onChange={(e) => setS({ ...s, miles: e.target.value })}
          onBlur={() => saveSettings(s)} aria-label="Miles from home" /><span>miles from home</span></>}
      </div>
      <h3 className="subhead">Home {inferred && <span className="asof">worked out from your spending</span>}</h3>
      <p className="small muted mt-0">Add more than one if you split your time between places: purchases near any home you had that day aren't away.</p>
      {!edit && <>
        {home.map((b) => <div className="trow small" key={b.since + b.city}><span>{b.city}{b.region ? `, ${b.region}` : ''}</span>
          <span className="muted">{b.until ? `${monthYear(b.since)} – ${monthYear(b.until)}` : `since ${monthYear(b.since)}`}</span></div>)}
        {home.length === 0 && <p className="small muted">Not enough in-person spending yet to tell.</p>}
        <button className="linkbtn foot" onClick={() => setEdit(true)}>{inferred ? 'Set it yourself' : 'Edit'}</button>
      </>}
      {edit && <>
        {rows.map((b, i) => (
          <div className="form homerow" key={i}>
            <label className="lbl">City<input value={b.city} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} placeholder="Your city" /></label>
            <label className="lbl">State<input className="mini" value={b.region} maxLength={2} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, region: e.target.value.toUpperCase() } : x)))} placeholder="TX" /></label>
            <label className="lbl">From<input type="date" value={b.since} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, since: e.target.value } : x)))} /></label>
            <label className="lbl">Until (optional)<input type="date" value={b.until} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, until: e.target.value } : x)))} /></label>
            <button className="linkbtn" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>))}
        <div className="btnrow mt-sm">
          <button className="btn" onClick={() => setRows([...rows, { city: '', region: '', since: new Date().toLocaleDateString('en-CA') }])}>Add a home</button>
          <button className="btn primary" onClick={() => saveHomes(rows)}>Save</button>
          {!inferred && <button className="linkbtn" onClick={() => saveHomes([])}>Work it out from my spending</button>}
          <button className="linkbtn" onClick={() => setEdit(false)}>Cancel</button>
        </div>
        {err && <p className="bad small">{err}</p>}
      </>}
    </Panel>
  );
}

export default function Trips() {
  const [d, setD] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', start: '', end: '' });
  const [err, setErr] = useState('');
  const load = useCallback(async () => setD(await api('/trips')), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <PageSkeleton />;
  const suggested = d.trips.filter((t) => t.status === 'suggested');
  const trips = d.trips.filter((t) => t.status === 'confirmed');
  const add = async (e) => {
    e.preventDefault();
    const r = await api('/trips', { method: 'POST', body: JSON.stringify(f) });
    if (r.error_message) return setErr(r.error_message);
    setErr(''); setF({ name: '', start: '', end: '' }); setAdding(false); load();
  };
  const year = new Date().getFullYear().toString();
  const thisYear = trips.filter((t) => t.start.startsWith(year)).reduce((s, t) => s + t.total, 0);
  return (
    <>
      <PageHeader title="Trips" sub="What you spent away from home, trip by trip. Trips stay in your budget categories but are left out of month-to-month comparisons.">
        <button className="btn primary" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add a trip'}</button>
      </PageHeader>
      {adding && <Panel className="mt" title="New trip">
        <form className="form" onSubmit={add}>
          <label className="lbl">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Big Bend weekend" required /></label>
          <label className="lbl">From<input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required /></label>
          <label className="lbl">To<input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} required /></label>
          <button className="btn primary" type="submit">Add trip</button>
        </form>
        {err && <p className="bad small">{err}</p>}
      </Panel>}
      {suggested.length > 0 && <Panel className="mt" title={<>Were these trips? <span className="asof">{suggested.length} found</span></>}>
        <p className="small muted mt-0">Runs of purchases made in person away from home. Confirm to group them; rename first if you like.</p>
        {suggested.map((t) => <Suggestion key={t.id} trip={t} reload={load} />)}
      </Panel>}
      {trips.length > 0 && <p className="small muted tripsum">{trips.length} trip{trips.length > 1 ? 's' : ''}{thisYear > 0 ? <> · <b className="amt">{usd(thisYear)}</b> on trips in {year}</> : null}</p>}
      {trips.length === 0 && !suggested.length && <Panel className="mt"><EmptyState icon="chart" title="No trips yet">
        Trips show up when you make purchases away from home. You can also add one yourself.</EmptyState></Panel>}
      <div className="tripgrid">{trips.map((t) => <TripCard key={t.id} trip={t} reload={load} />)}</div>
      <HomeAndAway key={JSON.stringify(d.home) + JSON.stringify(d.settings)} home={d.home} settings={d.settings} reload={load} />
    </>
  );
}
