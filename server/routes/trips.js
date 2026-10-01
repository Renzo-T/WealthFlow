import { Router } from 'express';
import db from '../db.js';
import { tripsSummary, homeBases, travelSettings, saveTravelSettings, assignTrips, refreshTrips } from '../trips.js';

const router = Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Trips with their spending, plus the home bases and the "away" setting they're based on.
router.get('/trips', (_req, res) => res.json({ trips: tripsSummary(), home: homeBases(), settings: travelSettings() }));

// Add a trip yourself (confirmed straight away).
router.post('/trips', (req, res) => {
  const { name, start, end } = req.body;
  if (!String(name ?? '').trim() || !DATE.test(start) || !DATE.test(end) || end < start) return res.status(400).json({ error_message: 'A name and a start and end date (end on or after start) are needed.' });
  const { lastInsertRowid } = db.prepare("INSERT INTO trips (name, start, end, status, source, place) VALUES (?, ?, ?, 'confirmed', 'manual', ?)")
    .run(String(name).trim().slice(0, 60), start, end, String(req.body.place ?? '').trim().slice(0, 60) || null);
  assignTrips();
  res.json({ id: lastInsertRowid });
});

// Rename, change dates, confirm or dismiss a trip.
router.patch('/trips/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error_message: 'Unknown trip.' });
  const next = { ...t, ...Object.fromEntries(['name', 'start', 'end', 'status', 'place'].filter((k) => req.body[k] != null).map((k) => [k, String(req.body[k]).trim()])) };
  if (!next.name || !DATE.test(next.start) || !DATE.test(next.end) || next.end < next.start || !['suggested', 'confirmed', 'dismissed'].includes(next.status))
    return res.status(400).json({ error_message: 'Check the name and dates.' });
  db.prepare('UPDATE trips SET name = ?, start = ?, end = ?, status = ?, place = ? WHERE id = ?').run(next.name.slice(0, 60), next.start, next.end, next.status, next.place || null, t.id);
  assignTrips();
  res.json({ ok: true });
});

// Delete a trip you added (suggested ones are dismissed instead, so they aren't suggested again).
// A suggested trip is dismissed rather than deleted, so it isn't suggested again; one you added is deleted.
router.delete('/trips/:id', (req, res) => {
  const t = db.prepare('SELECT source FROM trips WHERE id = ?').get(req.params.id);
  if (t?.source === 'auto') db.prepare("UPDATE trips SET status = 'dismissed' WHERE id = ?").run(req.params.id);
  else db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE transactions SET trip_override = NULL WHERE trip_override = ?').run(String(req.params.id));
  assignTrips();
  res.json({ ok: true });
});

// Put one transaction on a trip (trip: id), keep it off any trip ('none'), or go back to automatic (null).
router.post('/transactions/:id/trip', (req, res) => {
  const v = req.body.trip == null ? null : req.body.trip === 'none' ? 'none' : String(Number(req.body.trip));
  if (v && v !== 'none' && !db.prepare('SELECT 1 FROM trips WHERE id = ?').get(v)) return res.status(400).json({ error_message: 'Unknown trip.' });
  db.prepare('UPDATE transactions SET trip_override = ? WHERE id = ?').run(v, req.params.id);
  assignTrips();
  res.json({ ok: true });
});

// "Away" means: another state, more than N miles from home, or another country.
router.put('/settings/travel', (req, res) => { const s = saveTravelSettings(req.body); refreshTrips(); res.json(s); });

// Your home bases (city, state, from a date). An empty list goes back to working them out from your spending.
router.put('/home-bases', (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  if (list.some((b) => !String(b.city ?? '').trim() || !DATE.test(b.since) || (b.until && (!DATE.test(b.until) || b.until < b.since))))
    return res.status(400).json({ error_message: 'Each home needs a city and a start date (and an end date after it, if it ended).' });
  db.transaction(() => {
    db.prepare('DELETE FROM home_bases').run();
    for (const b of list) db.prepare('INSERT INTO home_bases (city, region, since, until) VALUES (?, ?, ?, ?)')
      .run(String(b.city).trim().slice(0, 60), String(b.region ?? '').trim().toUpperCase().slice(0, 2) || null, b.since, b.until || null);
  })();
  refreshTrips();
  res.json({ home: homeBases() });
});

export default router;
