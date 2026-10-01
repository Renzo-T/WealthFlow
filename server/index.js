import 'dotenv/config'; // must stay first: Plaid client reads env on import
import './env-check.js'; // exits early with a clear message if .env is incomplete
import express from 'express';
import link from './routes/link.js';
import data from './routes/data.js';
import plan from './routes/plan.js';
import system from './routes/system.js';
import trips from './routes/trips.js';
import reports from './routes/reports.js';
import { syncAll, lastSync, AUTO_SYNC_HOURS } from './sync.js';

const app = express();
app.use(express.json());
app.use('/api/link', link);
app.use('/api', data);
app.use('/api', plan);
app.use('/api', system);
app.use('/api', trips);
app.use('/api', reports);
app.listen(4000, '127.0.0.1', () => console.log('API on http://127.0.0.1:4000'));

// Automatic sync: on start (unless one ran in the last hour, so dev restarts don't hammer Plaid),
// then every AUTO_SYNC_HOURS while the app is running.
const autoSync = () => syncAll().then((r) => console.log(`Auto-sync: ${r.reduce((s, x) => s + x.added, 0)} new transactions`))
  .catch((e) => console.error('Auto-sync failed:', e.message));
if (Date.now() - Date.parse(lastSync() ?? 0) > 3600e3) autoSync();
setInterval(autoSync, AUTO_SYNC_HOURS * 3600e3);
