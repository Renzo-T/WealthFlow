import db from './db.js';
import { cityCoords, miles, US_STATES, COUNTRIES, STATE_NAMES } from './geo.js';
import { NOT_SPENDING } from './categories.js';
import { peerOf, reviewSince } from './categories.js';

// ---------- Trips ----------
// A trip is a date range with a name. Its spending is everything you bought away from home in those dates
// (plus anything you add by hand), so a trip's total and categories can be seen together, and the month-to-month
// comparisons can leave trips out. Trips are suggested from runs of purchases away from home, which you confirm,
// rename or dismiss; you can also add one yourself.
//
// "Away" depends on where home was at the time (home bases: inferred from where most in-person spending
// happens, or set in Settings) and on a setting: another state, more than N miles away (default 100), or
// another country only.

const DEFAULTS = { mode: 'distance', miles: 100 };
export function travelSettings() {
  const v = db.prepare("SELECT value FROM meta WHERE key = 'travel'").get()?.value;
  try { return { ...DEFAULTS, ...JSON.parse(v ?? '{}') }; } catch { return DEFAULTS; }
}
export function saveTravelSettings({ mode, miles: m }) {
  const s = { mode: ['distance', 'state', 'country'].includes(mode) ? mode : DEFAULTS.mode, miles: Math.min(2000, Math.max(10, Number(m) || DEFAULTS.miles)) };
  db.prepare("INSERT INTO meta (key, value) VALUES ('travel', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s));
  return s;
}

const title = (s) => (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Where a purchase happened: Plaid's location when it has one, otherwise the end of the card description
// ("... PORTLAND OR", "LAWSON TOKYO JPN"). Only purchases made in person have a meaningful place.
export function locate(t) {
  // Online and other purchases carry the company's address (e.g. Amazon: Seattle), not where you were.
  if (t.channel !== 'in store') return null;
  if (t.region || t.country || t.lat != null) {
    return { city: t.city, region: t.region, country: t.country && t.country !== 'US' ? t.country : t.country ? 'US' : t.region ? 'US' : null,
      coords: t.lat != null && t.lon != null ? [t.lat, t.lon] : null };
  }
  const name = (t.name ?? '').trim();
  const abroad = name.match(/(?:^|\s)([A-Za-z.'-]+)\s+([A-Z]{3})$/);
  if (abroad && COUNTRIES[abroad[2]]) return { city: title(abroad[1]), region: null, country: abroad[2], coords: null };
  // A state code at the very end, after a space or glued to a lowercase word ("Rockaway BeacOR").
  const st = name.match(/(?:\s|[a-z0-9])([A-Z]{2})$/);
  if (st && US_STATES.has(st[1])) {
    const city = name.slice(0, -2).trim().match(/(?:^|\s)([A-Za-z][A-Za-z .'-]{2,})$/)?.[1];
    return { city: city ? title(city.trim()) : null, region: st[1], country: 'US', coords: null };
  }
  return null;
}

// ---------- Home bases ----------
// Yours if set on the Trips page; otherwise inferred: for each month, the city with the most days of in-person
// spending. Home moves when another city leads for two months running (so a long trip doesn't count as moving).
// Each home has a start and an optional end, and several can overlap (a second home, a partner's city): a purchase
// is away only when it's away from every home you had that day.
export function homeBases() {
  const set = db.prepare('SELECT city, region, since, until, lat, lon FROM home_bases ORDER BY since').all();
  if (set.length) return set.map((b) => ({ ...b, set: true }));
  // Bills (rent, utilities, insurance) are placed at the company's headquarters (Bilt: New York), so they don't count.
  const rows = db.prepare(`SELECT substr(date, 1, 7) m, city, region, COUNT(DISTINCT date) days FROM transactions
    WHERE channel = 'in store' AND city IS NOT NULL AND region IS NOT NULL AND COALESCE(grp, 'Misc') NOT IN ('Housing', 'Utilities', 'Insurance')
      AND COALESCE(grp, 'Misc') NOT IN (${NOT_SPENDING.map((g) => `'${g}'`).join(',')})
    GROUP BY m, city, region ORDER BY m, days DESC`).all();
  const top = new Map();
  for (const r of rows) if (!top.has(r.m)) top.set(r.m, r);
  const months = [...top.values()];
  const out = [];
  for (let i = 0; i < months.length; i++) {
    const cur = out.at(-1), m = months[i];
    const same = (a, b) => a && b && a.city === b.city && a.region === b.region;
    if (!cur) out.push({ city: m.city, region: m.region, since: `${m.m}-01`, until: null });
    else if (!same(cur, m) && same(m, months[i + 1])) {
      cur.until = new Date(Date.parse(`${m.m}-01T00:00Z`) - 864e5).toISOString().slice(0, 10); // a move ends the last home
      out.push({ city: m.city, region: m.region, since: `${m.m}-01`, until: null });
    }
  }
  return out;
}
// Homes on a date: every home that had started and not ended. Before the first one, the first one.
const homesAt = (bases, date) => {
  const on = bases.filter((b) => b.since <= date && (!b.until || b.until >= date));
  return on.length ? on : bases.slice(0, 1);
};

// Away from home: from every home given (one or several).
export function isAway(loc, homes, s = travelSettings()) {
  if (!loc) return false;
  if (loc.country && loc.country !== 'US') return true;
  const list = (Array.isArray(homes) ? homes : [homes]).filter(Boolean);
  if (s.mode === 'country' || !list.length || !loc.region) return false;
  return list.every((home) => {
    if (s.mode === 'state') return loc.region !== home.region;
    const a = loc.coords ?? cityCoords(loc.city, loc.region);
    const h = home.lat != null ? [home.lat, home.lon] : cityCoords(home.city, home.region);
    return a && h ? miles(a, h) > s.miles : loc.region !== home.region; // unknown town: fall back to the state
  });
}

const SPEND = (t) => !NOT_SPENDING.includes(t.grp ?? 'Misc');
const HOMEY = new Set(['Housing', 'Utilities', 'Insurance']); // bills paid from afar aren't trip spending
const rowsFor = (from, to) => db.prepare(`SELECT t.*, i.institution FROM transactions t JOIN accounts a ON a.id = t.account_id
  LEFT JOIN items i ON i.id = a.item_id WHERE t.date >= ? AND t.date <= ? ORDER BY t.date`).all(from, to);

// Does this transaction belong to a trip in its dates? Away purchases do; so do bookings (Travel) and in-person
// purchases with no known place. Online orders, bills, transfers and anything bought at home don't. A payment
// with a person counts when its note names the trip's place ("Portland").
// Settling up with friends usually happens after you're back, so those count up to 14 days after the trip.
function onTrip(t, trip, bases, s, words) {
  if (!SPEND(t) || HOMEY.has(t.grp)) return false;
  const peer = peerOf(t, t.institution);
  const namesPlace = () => words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(peer.note));
  if (t.date > trip.end) return !!peer && namesPlace();
  if (peer) return namesPlace();
  const loc = locate(t);
  if (loc) return isAway(loc, homesAt(bases, t.date), s);
  if (t.grp === 'Travel') return true;
  return t.channel === 'in store';
}

// Recompute transactions.trip_id for every trip that isn't dismissed. Your own choices (trip_override: a trip id,
// or 'none') win.
export function assignTrips() {
  const trips = db.prepare("SELECT * FROM trips WHERE status != 'dismissed' ORDER BY start").all();
  const bases = homeBases(), s = travelSettings();
  db.transaction(() => {
    db.prepare("UPDATE transactions SET trip_id = NULL WHERE trip_id IS NOT NULL").run();
    const set = db.prepare('UPDATE transactions SET trip_id = ? WHERE id = ?');
    const after = (d) => new Date(Date.parse(`${d}T00:00Z`) + 14 * 864e5).toISOString().slice(0, 10);
    for (const trip of trips) {
      const rows = rowsFor(trip.start, after(trip.end));
      // Words a settle-up's note might use: the trip's name and place, and every city visited ("Portland").
      const words = [...new Set([trip.name, trip.place, ...rows.filter((t) => t.date <= trip.end).map((t) => locate(t)?.city)]
        .flatMap((x) => (x ?? '').split(/[ ,]+/)).filter((w) => w.length >= 4 && !/^trip$/i.test(w)).map((w) => w.replace(/[^\p{L}]/gu, '')))].filter(Boolean);
      for (const t of rows) if (!t.trip_override && onTrip(t, trip, bases, s, words)) set.run(trip.id, t.id);
    }
    for (const o of db.prepare("SELECT id, trip_override FROM transactions WHERE trip_override IS NOT NULL").all())
      set.run(o.trip_override === 'none' || !trips.some((x) => String(x.id) === o.trip_override) ? null : Number(o.trip_override), o.id);
  })();
}

// What to call a trip: the city when at least 60% of the purchases were there ("Portland, OR"); otherwise the
// country abroad ("Japan") or the state ("Oregon"), or the two states most visited ("Oregon & Washington").
export function placeOf(locs) {
  const top = (key) => {
    const c = new Map();
    for (const l of locs) { const k = key(l); if (k) c.set(k, (c.get(k) ?? 0) + 1); }
    return [...c].sort((a, b) => b[1] - a[1]);
  };
  const abroad = locs.filter((l) => l.country && l.country !== 'US');
  if (abroad.length > locs.length / 2) {
    const country = top((l) => (l.country !== 'US' ? l.country : null))[0][0];
    const name = COUNTRIES[country] ?? country;
    const [city, n] = top((l) => (l.country === country && l.city?.length > 2 ? l.city : null))[0] ?? [];
    return city && n / abroad.length >= 0.6 ? { name: city, full: `${city}, ${name}` } : { name, full: name };
  }
  const [city, n] = top((l) => (l.city ? `${l.city}|${l.region}` : null))[0] ?? [];
  if (city && n / locs.length >= 0.6) { const [c, st] = city.split('|'); return { name: c, full: `${c}, ${st}` }; }
  const states = top((l) => l.region).map(([st]) => STATE_NAMES[st] ?? st);
  const name = states.length > 1 ? `${states[0]} & ${states[1]}` : states[0] ?? 'Away';
  return { name, full: name };
}

// Suggest trips from runs of purchases away from home (no more than 3 days apart). Suggestions you haven't
// answered are rebuilt each time (so better naming reaches them); confirmed and dismissed ones stay.
// A run that overlaps any trip you have (even a dismissed one) isn't suggested again.
export function suggestTrips() {
  const bases = homeBases(), s = travelSettings();
  const away = db.prepare(`SELECT t.*, i.institution FROM transactions t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN items i ON i.id = a.item_id ORDER BY t.date`).all()
    .filter((t) => SPEND(t) && !HOMEY.has(t.grp) && t.amount > 0).map((t) => ({ t, loc: locate(t) })).filter(({ t, loc }) => loc && isAway(loc, homesAt(bases, t.date), s));
  const runs = [];
  for (const x of away) {
    const r = runs.at(-1);
    if (r && Date.parse(x.t.date) - Date.parse(r.at(-1).t.date) <= 3 * 864e5) r.push(x); else runs.push([x]);
  }
  db.prepare("DELETE FROM trips WHERE status = 'suggested' AND source = 'auto'").run();
  const existing = db.prepare('SELECT start, end FROM trips').all();
  const add = db.prepare("INSERT INTO trips (name, start, end, status, source, place) VALUES (?, ?, ?, 'suggested', 'auto', ?)");
  let added = 0;
  // At least three purchases away, or two on different days (a single stop on a drive isn't a trip).
  for (const r of runs.filter((r) => r.length >= 3 || (r.length === 2 && r[0].t.date !== r[1].t.date))) {
    const start = r[0].t.date, end = r.at(-1).t.date;
    // Only where the data is close to complete (the review window): older history has gaps, like bookings on a
    // card whose history starts later. Older trips can still be added by hand.
    if (start < reviewSince()) continue;
    if (existing.some((e) => e.start <= end && e.end >= start)) continue;
    const place = placeOf(r.map((x) => x.loc));
    add.run(`${place.name} trip`, start, end, place.full);
    added++;
  }
  return added;
}

// Trips with their spending: total, by category, biggest purchases, and possible bookings made beforehand
// (Travel purchases in the 60 days before that aren't on a trip yet).
export function tripsSummary() {
  const trips = db.prepare("SELECT * FROM trips WHERE status != 'dismissed' ORDER BY start DESC").all();
  const txns = db.prepare(`SELECT id, date, COALESCE(merchant, name) name, amount, category, grp, trip_id FROM transactions
    WHERE trip_id IS NOT NULL ORDER BY date`).all();
  const maybe = db.prepare(`SELECT id, date, COALESCE(merchant, name) name, amount, category FROM transactions
    WHERE grp = 'Travel' AND trip_id IS NULL AND COALESCE(trip_override, '') != 'none' AND amount > 0 AND date >= date(?, '-60 days') AND date < ?
    ORDER BY category = 'Flights' DESC, category = 'Hotels' DESC, date DESC LIMIT 8`); // flights first
  const settle = db.prepare(`SELECT t.id, t.date, t.name, t.amount, i.institution FROM transactions t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN items i ON i.id = a.item_id WHERE t.trip_id IS NULL AND COALESCE(t.trip_override, '') != 'none'
      AND t.date >= ? AND t.date <= date(?, '+14 days') AND COALESCE(t.grp, 'Misc') NOT IN ('Income', 'Transfer') ORDER BY ABS(t.amount) DESC`);
  return trips.map((trip) => {
    const items = txns.filter((t) => t.trip_id === trip.id);
    const by = {};
    for (const t of items) by[t.category] = (by[t.category] ?? 0) + t.amount;
    return {
      ...trip, days: Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 864e5) + 1,
      total: items.reduce((s, t) => s + t.amount, 0), count: items.length,
      categories: Object.entries(by).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
      items: [...items].sort((a, b) => b.amount - a.amount), bookings: maybe.all(trip.start, trip.start),
      // Payments with people during the trip or in the two weeks after that aren't on a trip: possibly settling up.
      // (Zelle has no note to go by, so these are offered rather than added.)
      settleUps: settle.all(trip.start, trip.end).filter((t) => peerOf(t, t.institution))
        .map(({ id, date, name, amount }) => ({ id, date, name: peerOf({ name }, 'Venmo')?.person ?? name.replace(/^Zelle\s+(?:payment|transfer)?\s*(?:to|from)\s+/i, '').replace(/\s+Conf#.*$/i, ''), amount })).slice(0, 4),
    };
  });
}

// Refresh everything trip-related (after a sync, a category change or a settings change).
export function refreshTrips() { suggestTrips(); assignTrips(); }
