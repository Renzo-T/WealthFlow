// Loads every page of the running app in a headless Chromium browser (Chrome or Edge), in light and dark mode, and
// fails if a page throws, an API call fails, a page is empty or still loading, or the page scrolls sideways.
// Screenshots go to ui-shots/ (gitignored) for a quick look.
//
//   npm start            (in another terminal)
//   npm run check:ui     [-- --url https://localhost:3000 --width 1440]
//
// Set BROWSER to the browser's path if it isn't found.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('url', 'https://localhost:3000');
const WIDTH = Number(arg('width', 1440));
const PAGES = ['dashboard', 'transactions', 'budget', 'bills', 'flow', 'trips', 'reports', 'networth', 'investments', 'forecast', 'goals', 'settings'];
// Chrome first: headless Edge can stall (no frames drawn) while your own Edge window is open.
const CANDIDATES = [process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge'].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) { console.error('No Chrome or Edge found. Set BROWSER to its path.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 400);
const profile = join(tmpdir(), `wealthflow-check-${port}`);
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--ignore-certificate-errors', `--remote-debugging-port=${port}`,
  `--window-size=${WIDTH},1000`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
// Close the browser and everything it started, however this script ends (finished, failed, Ctrl+C, killed).
const closeBrowser = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else try { proc.kill('SIGKILL'); } catch { /* already gone */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* still in use */ }
};
let closed = false;
const done = (code) => { if (!closed) { closed = true; closeBrowser(); } process.exit(code); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => done(130));
process.on('exit', () => { if (!closed) { closed = true; closeBrowser(); } });

let targets;
for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
if (!targets) { console.error('The browser did not start.'); done(2); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(), events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } else if (m.method) events.push(m);
});
// Every browser command has a time limit, so a stuck page fails the check instead of hanging it.
const send = (method, params = {}, ms = 20000) => new Promise((r, reject) => {
  const n = ++id;
  const t = setTimeout(() => { pending.delete(n); reject(new Error(`${method} took over ${ms / 1000}s`)); }, ms);
  pending.set(n, (v) => { clearTimeout(t); r(v); });
  ws.send(JSON.stringify({ id: n, method, params }));
});
await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1000, deviceScaleFactor: 1, mobile: false });

// Is the app up?
try { await fetch(`${BASE}/api/items`); } catch { /* self-signed certificates make Node's fetch fail; the browser below is the real check */ }

// Runs in the page: turns Hide amounts on (the body class), lists visible text with a dollar amount that nothing blurs,
// and turns it off again. Native tooltips go through tipText() and aren't checked here.
function unblurredAmounts() {
  const was = document.body.classList.contains('privacy');
  document.body.classList.add('privacy');
  const blurred = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).filter.includes('blur')) return true; return false; };
  const out = [], seen = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const text = n.textContent.trim(), el = n.parentElement;
    if (!/[$]\s?\d/.test(text) || !el || el.closest('script,style,option')) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height || blurred(el)) continue;
    const where = [el, el.parentElement].filter(Boolean).map((e) => e.tagName.toLowerCase() + (e.classList.length ? `.${[...e.classList].join('.')}` : '')).reverse().join(' > ');
    if (!seen.has(where)) { seen.add(where); out.push({ text: text.slice(0, 60), where }); }
  }
  if (!was) document.body.classList.remove('privacy');
  return out;
}

mkdirSync('ui-shots', { recursive: true });
const problems = [];
for (const scheme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  for (const page of PAGES) {
    try {
      events.length = 0;
      await send('Page.navigate', { url: 'about:blank' }); // a fresh load for each page, so one failure doesn't hide the rest
      await sleep(100);
      events.length = 0;
      await send('Page.navigate', { url: `${BASE}/#/${page}` });
      await sleep(page === 'dashboard' ? 5000 : 3500);
      const { result } = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
        const main = document.querySelector('main') ?? document.body;
        return {
          text: main.innerText.trim().length,
          skeletons: document.querySelectorAll('.skel').length,
          sideways: document.documentElement.scrollWidth - window.innerWidth,
          title: document.querySelector('h1')?.innerText ?? '',
          crashed: document.querySelector('.pageerror pre')?.innerText ?? null,
        };
      })()` });
      const r = result.value;
      const fail = (msg) => problems.push(`${page} (${scheme}): ${msg}`);
      for (const e of events) {
        if (e.method === 'Runtime.exceptionThrown') fail(`error: ${e.params.exceptionDetails.exception?.description?.split('\n')[0] ?? e.params.exceptionDetails.text}`);
        if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/favicon/.test(e.params.entry.url ?? '')) fail(`console: ${e.params.entry.text}`);
        if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' && !/^Page error/.test(e.params.args[0]?.value ?? '')) fail(`console.error: ${e.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200)}`);
        if (e.method === 'Network.responseReceived' && /\/api\//.test(e.params.response.url) && e.params.response.status >= 400)
          fail(`API ${e.params.response.status} ${e.params.response.url.replace(BASE, '')}`);
      }
      if (r.crashed) fail(`page crashed: ${r.crashed}`);
      if (r.text < 40) fail('page is empty');
      if (r.skeletons > 0) fail(`still loading after a few seconds (${r.skeletons} placeholders)`);
      if (r.sideways > 2) fail(`scrolls sideways by ${r.sideways}px at ${WIDTH}px wide`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`ui-shots/${page}-${scheme}.png`, Buffer.from(shot.data, 'base64'));
      // Hide amounts: with it on, no dollar amount may be readable (each needs the amt class or a blurred parent).
      if (scheme === 'light') {
        const leaks = (await send('Runtime.evaluate', { returnByValue: true, expression: `(${unblurredAmounts})()` })).result.value ?? [];
        for (const l of leaks) fail(`readable with Hide amounts on: "${l.text}" (${l.where})`);
      }
      process.stdout.write(`${problems.some((p) => p.startsWith(`${page} (${scheme})`)) ? '✖' : '✔'} ${page} (${scheme}) ${r.title ? `— ${r.title}` : ''}\n`);
    } catch (e) { problems.push(`${page} (${scheme}): ${e.message}`); console.log(`✖ ${page} (${scheme}) — ${e.message}`); }
  }
}
ws.close();
if (problems.length) { console.log(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}:\n- ${problems.join('\n- ')}`); done(1); }
console.log(`\nAll ${PAGES.length * 2} page loads look fine. Screenshots are in ui-shots/.`);
done(0);
