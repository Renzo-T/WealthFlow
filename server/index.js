import 'dotenv/config'; // must stay first: Plaid client reads env on import
import './env-check.js'; // exits early with a clear message if .env is incomplete
import express from 'express';
import fs from 'node:fs';
import https from 'node:https';
import { spawn } from 'node:child_process';
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

// Development (npm start): the API alone on port 4000; Vite serves the page on 3000 and forwards /api here.
// App mode (npm run app, WEALTHFLOW_APP=1): the built page and the API together on 3000, https when certs/ has the
// local certificate (the same address as development, so Plaid's redirect address and the installed app both work).
// Automatic sync: once the server is up (a second copy that finds the port taken never syncs), unless one ran in the
// last hour (so restarts don't hammer Plaid), then every AUTO_SYNC_HOURS while the app is running.
const autoSync = () => syncAll().then((r) => console.log(`Auto-sync: ${r.reduce((s, x) => s + x.added, 0)} new transactions`))
  .catch((e) => console.error('Auto-sync failed:', e.message));
const listening = (url) => () => {
  console.log(`WealthFlow on ${url}`);
  if (process.env.WEALTHFLOW_OPEN === '1') openInBrowser(url);
  if (Date.now() - Date.parse(lastSync() ?? 0) > 3600e3) autoSync();
  setInterval(autoSync, AUTO_SYNC_HOURS * 3600e3);
};
// --open (WealthFlow.cmd in the download): show it in the default browser.
const openInBrowser = (url) => {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
};
if (process.env.WEALTHFLOW_APP === '1') {
  const port = +(process.env.WEALTHFLOW_PORT || 3000);
  const web = process.env.WEALTHFLOW_WEB_DIR || 'web/dist'; // the built page
  app.use(express.static(web, { index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile('index.html', { root: web })); // e.g. /oauth after a bank's sign-in
  const cert = 'certs/localhost.pem', key = 'certs/localhost-key.pem', secure = fs.existsSync(cert);
  const url = `${secure ? 'https' : 'http'}://localhost:${port}`;
  const server = secure
    ? https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, app).listen(port, '127.0.0.1', listening(url))
    : app.listen(port, '127.0.0.1', listening(url));
  server.on('error', (e) => {
    // Already running (e.g. started at sign-in): with --open, just show that copy.
    if (e.code === 'EADDRINUSE' && process.env.WEALTHFLOW_OPEN === '1') { openInBrowser(url); setTimeout(() => process.exit(0), 500); return; }
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use: WealthFlow (or npm start) is probably already running.` : e.message);
    process.exit(1);
  });
} else app.listen(4000, '127.0.0.1', listening('http://127.0.0.1:4000 (API)'));

