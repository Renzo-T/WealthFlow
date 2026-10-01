import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account, tx, row } from './helpers.js';

const { classify } = await import('../server/categories.js');
const { locate, isAway, homeBases, suggestTrips, assignTrips, tripsSummary, saveTravelSettings, placeOf } = await import('../server/trips.js');

// A purchase somewhere: Plaid's place fields on top of the usual test transaction.
const at = (id, { city = null, region = null, channel = 'in store' } = {}) =>
  db.prepare('UPDATE transactions SET city = ?, region = ?, channel = ? WHERE id = ?').run(city, region, channel, id);
const shop = (date, amount, name, place, opts = {}) => { const t = tx('card', date, amount, name, { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT', ...opts }); at(t, place); return t; };

beforeEach(() => {
  reset(); db.prepare("DELETE FROM meta WHERE key = 'travel'").run();
  bank('b1'); account('card', { type: 'credit', subtype: 'credit card' });
  bank('v', 'Venmo - Personal'); account('ven', { item: 'v' });
  // Two months of everyday spending in Austin make it home.
  for (const d of ['2026-07-03', '2026-07-10', '2026-07-17', '2026-08-04', '2026-08-11', '2026-08-18']) shop(d, 12, 'TACO SHOP', { city: 'Austin', region: 'TX' });
});

test('home is where most in-person spending happens; bills at a company HQ do not count', () => {
  const rent = tx('card', '2026-08-01', 1800, 'BPS*BILT RENT', { primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT' });
  at(rent, { city: 'New York', region: 'NY' });
  classify();
  assert.deepEqual(homeBases().map((b) => b.city), ['Austin']);
});

test('places come from Plaid, or from the end of the description; online purchases have none', () => {
  assert.deepEqual(locate({ name: 'LAWSON TOKYO JPN', channel: 'in store' }), { city: 'Tokyo', region: null, country: 'JPN', coords: null });
  assert.equal(locate({ name: "TST* ELMER'S BREAKFAST-LU503-256-0333 OR", channel: 'in store' }).region, 'OR');
  assert.equal(locate({ name: 'AMAZON MKTPL', city: 'Seattle', region: 'WA', channel: 'online' }), null);
});

test('away: by distance (default 100 miles), by state, or abroad only', () => {
  const home = { city: 'Austin', region: 'TX' };
  const lockhart = { city: 'Lockhart', region: 'TX' }, fortWorth = { city: 'Fort Worth', region: 'TX' }, portland = { city: 'Portland', region: 'OR' };
  assert.equal(isAway(lockhart, home), false); // 27 miles
  assert.equal(isAway(fortWorth, home), true); // about 175 miles, same state
  assert.equal(isAway({ city: 'Nowhereville', region: 'TX' }, home), false); // unknown town: same state, so home
  assert.equal(isAway(portland, home, { mode: 'state' }), true);
  assert.equal(isAway(fortWorth, home, { mode: 'state' }), false);
  assert.equal(isAway(portland, home, { mode: 'country' }), false);
  assert.equal(isAway({ city: 'Tokyo', country: 'JPN' }, home, { mode: 'country' }), true);
});

test('a run of purchases away becomes a suggested trip with settle-ups, not online orders or bills', () => {
  shop('2026-09-07', 60, 'SUSHI HADA', { city: 'Portland', region: 'OR' });
  shop('2026-09-08', 25, 'SALT AND STRAW', { city: 'Portland', region: 'OR' });
  shop('2026-09-09', 30, 'TILLAMOOK CREAMERY', { city: 'Tillamook', region: 'OR' });
  const online = tx('card', '2026-09-08', 64, 'CHEWY.COM', { primary: 'GENERAL_MERCHANDISE' }); at(online, { region: 'FL', channel: 'online' });
  const settle = tx('ven', '2026-09-14', 517.83, 'Alex Rivera "Portland"', { primary: 'GENERAL_MERCHANDISE' });
  const other = tx('ven', '2026-09-15', 20, 'Morgan Ellis "Poker"', { primary: 'OTHER' });
  classify();
  assert.equal(suggestTrips(), 1);
  assignTrips();
  const [trip] = tripsSummary();
  assert.equal(trip.name, 'Portland trip');
  assert.equal(trip.status, 'suggested');
  assert.deepEqual([trip.start, trip.end], ['2026-09-07', '2026-09-09']);
  assert.equal(row(settle).trip_id, trip.id);
  assert.equal(row(online).trip_id, null);
  assert.equal(row(other).trip_id, null);
  assert.equal(Math.round(trip.total), 633);
  // Dismissed: not suggested again.
  db.prepare("UPDATE trips SET status = 'dismissed'").run();
  assert.equal(suggestTrips(), 0);
});

test('your choice for a transaction wins over the automatic one', () => {
  const t = shop('2026-09-07', 60, 'SUSHI HADA', { city: 'Portland', region: 'OR' });
  shop('2026-09-08', 25, 'SALT AND STRAW', { city: 'Portland', region: 'OR' });
  classify(); suggestTrips();
  db.prepare("UPDATE trips SET status = 'confirmed'").run();
  db.prepare("UPDATE transactions SET trip_override = 'none' WHERE id = ?").run(t);
  assignTrips();
  assert.equal(row(t).trip_id, null);
});

test('the away setting is saved within bounds', () => {
  assert.deepEqual(saveTravelSettings({ mode: 'state', miles: 5 }), { mode: 'state', miles: 10 });
  assert.deepEqual(saveTravelSettings({ mode: 'bogus', miles: 250 }), { mode: 'distance', miles: 250 });
});

test('several homes at once: a purchase is away only when it is away from all of them', () => {
  const austin = { city: 'Austin', region: 'TX' }, seattle = { city: 'Seattle', region: 'WA' };
  assert.equal(isAway({ city: 'Bellevue', region: 'WA' }, [austin, seattle]), false); // near the second home
  assert.equal(isAway({ city: 'Portland', region: 'OR' }, [austin, seattle]), true); // 145 miles from Seattle
  db.prepare("INSERT INTO home_bases (city, region, since, until) VALUES ('Austin', 'TX', '2025-01-01', NULL), ('Seattle', 'WA', '2026-01-01', '2026-06-30')").run();
  shop('2026-03-10', 30, 'PIKE PLACE CHOWDER', { city: 'Seattle', region: 'WA' });
  shop('2026-03-11', 20, 'SEATTLE COFFEE', { city: 'Seattle', region: 'WA' });
  shop('2026-03-12', 25, 'DICKS DRIVE-IN', { city: 'Seattle', region: 'WA' });
  shop('2026-08-10', 30, 'PIKE PLACE CHOWDER', { city: 'Seattle', region: 'WA' });
  shop('2026-08-11', 20, 'SEATTLE COFFEE', { city: 'Seattle', region: 'WA' });
  shop('2026-08-12', 25, 'DICKS DRIVE-IN', { city: 'Seattle', region: 'WA' });
  classify();
  assert.equal(suggestTrips(), 1); // March was at a home; August (after it ended) was a trip
  assert.equal(tripsSummary()[0].start, '2026-08-10');
});

test('trip names: the city when most purchases were there, else the country or the state', () => {
  const jp = (city) => ({ city, region: null, country: 'JPN' });
  assert.equal(placeOf([jp('Tokyo'), jp('Tokyo'), jp('Kagoshima'), jp('Kumamoto'), jp('Osaka')]).name, 'Japan');
  assert.equal(placeOf([jp('Tokyo'), jp('Tokyo'), jp('Tokyo'), jp('Osaka')]).name, 'Tokyo');
  const or = (city) => ({ city, region: 'OR', country: 'US' });
  assert.equal(placeOf([or('Portland'), or('Portland'), or('Portland'), or('Tillamook')]).full, 'Portland, OR');
  assert.equal(placeOf([or('Portland'), or('Tillamook'), or('Cannon Beach'), { city: 'Seattle', region: 'WA' }]).name, 'Oregon & Washington');
});

test('trips are only suggested from the review window on (3 months before the first connection)', () => {
  db.prepare("UPDATE items SET created_at = '2026-09-30'").run();
  shop('2026-03-07', 60, 'SUSHI HADA', { city: 'Portland', region: 'OR' });
  shop('2026-03-08', 25, 'SALT AND STRAW', { city: 'Portland', region: 'OR' });
  shop('2026-03-09', 30, 'CREAMERY', { city: 'Tillamook', region: 'OR' });
  classify();
  assert.equal(suggestTrips(), 0);
});
