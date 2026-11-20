// Loads every page of the running app in a headless Chromium browser (Chrome or Edge), in light and dark mode, and
// fails if a page throws, an API call fails, a page is empty or still loading, the page scrolls sideways, or a box is off
// the page's dot grid (every panel, ruled section and top-level block must start and end on a 22px grid line; grid.js).
// Screenshots go to ui-shots/ (gitignored) for a quick look.
//
//   npm start            (in another terminal)
//   npm run check:ui     [-- --url https://localhost:3000 --width 1440 --pages dashboard,bills --journal plum]
//   npm run check:ui -- --sizes 1024x768,1366x768,1440x900,1920x1080,2560x1440   (several window sizes in one run)
//
// Set BROWSER to the browser's path if it isn't found.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PANELS, SECTIONS, PACKED, unit, snapTargets, gridTargets, offGrid } from '../web/src/grid.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('url', 'https://localhost:3000');
const WIDTH = Number(arg('width', 1440));
// Window sizes to check, each with every page in light and dark: --sizes 1024x768,1920x1080 (or one --width, 1000 tall).
const SIZES = (arg('sizes', '') || `${WIDTH}x1000`).split(',').map((x) => x.split('x').map(Number));
const MAXW = Math.max(...SIZES.map(([w]) => w)), MAXH = Math.max(...SIZES.map(([, h]) => h));
const ALL = ['dashboard', 'transactions', 'budget', 'bills', 'flow', 'reports', 'networth', 'investments', 'plan', 'settings'];
const PAGES = arg('pages', '') ? arg('pages').split(',') : ALL;
const JOURNAL = arg('journal', ''); // ?journal=plum previews a journal without saving it
const MOVED = { accounts: 'networth', goals: 'plan', forecast: 'plan', trips: 'reports?tab=trips' }; // as in web/src/App.jsx
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
  `--window-size=${MAXW},${MAXH}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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

// Runs in the page: grid.js's own target list and test, so the check and the snapping agree on what must line up.
const ALIGN = `(() => {
  const PANELS = ${JSON.stringify(PANELS)}, SECTIONS = ${JSON.stringify(SECTIONS)}, PACKED = ${JSON.stringify(PACKED)};
  const unit = ${unit}; const snapTargets = ${snapTargets}; const gridTargets = ${gridTargets}; const offGrid = ${offGrid};
  const main = document.querySelector('main.main');
  if (!main) return [];
  const name = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '');
  return offGrid(main).map((o) => ({ what: [o.el.parentElement, o.el].map(name).join(' > '), edge: o.edge, off: o.off }));
})()`;

mkdirSync('ui-shots', { recursive: true });
const problems = [];
for (const [W, H] of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const at = SIZES.length > 1 ? ` at ${W}×${H}` : '';
for (const scheme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  for (const page of PAGES) {
    try {
      events.length = 0;
      await send('Page.navigate', { url: 'about:blank' }); // a fresh load for each page, so one failure doesn't hide the rest
      await sleep(100);
      events.length = 0;
      await send('Page.navigate', { url: `${BASE}/${JOURNAL ? `?journal=${JOURNAL}` : ''}#/${page}` });
      await sleep(page === 'dashboard' ? 5000 : 3500);
      // Hover every hover target (tooltips render their own content, which can throw), then look for a crash below.
      await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => {
        for (const el of document.querySelectorAll('.hov')) {
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 10));
          el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        }
      })()` });
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
      const fail = (msg) => problems.push(`${page} (${scheme}${at}): ${msg}`);
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
      if (r.sideways > 2) fail(`scrolls sideways by ${r.sideways}px at ${W}px wide`);
      // On the grid: every snapped box's edges within 1px of a whole unit from the page's corner (the first few named).
      const off = (await send('Runtime.evaluate', { returnByValue: true, expression: ALIGN })).result.value ?? [];
      for (const o of off.slice(0, 5)) fail(`off the grid: ${o.what} ${o.edge} edge is ${o.off}px past a grid line`);
      if (off.length > 5) fail(`off the grid: ${off.length - 5} more edges`);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(`ui-shots/${page}-${scheme}${JOURNAL ? `-${JOURNAL}` : ''}-${W}x${H}.png`, Buffer.from(shot.data, 'base64'));
      // Hide amounts: with it on, no dollar amount may be readable (each needs the amt class or a blurred parent).
      if (scheme === 'light') {
        const leaks = (await send('Runtime.evaluate', { returnByValue: true, expression: `(${unblurredAmounts})()` })).result.value ?? [];
        for (const l of leaks) fail(`readable with Hide amounts on: "${l.text}" (${l.where})`);
      }
      process.stdout.write(`${problems.some((p) => p.startsWith(`${page} (${scheme}${at})`)) ? '✖' : '✔'} ${page} (${scheme}${at}) ${r.title ? `— ${r.title}` : ''}\n`);
    } catch (e) { problems.push(`${page} (${scheme}${at}): ${e.message}`); console.log(`✖ ${page} (${scheme}${at}) — ${e.message}`); }
  }
}
}
// Pages merged into another: their old addresses must land on the new page.
for (const [old, now] of Object.entries(MOVED)) {
  try {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await send('Page.navigate', { url: `${BASE}/#/${old}` });
    await sleep(2500);
    const hash = (await send('Runtime.evaluate', { returnByValue: true, expression: 'location.hash' })).result.value;
    if (hash !== `#/${now}`) problems.push(`#/${old}: lands on ${hash || '(nothing)'}, not #/${now}`);
    process.stdout.write(`${hash === `#/${now}` ? '✔' : '✖'} #/${old} → ${hash}\n`);
  } catch (e) { problems.push(`#/${old}: ${e.message}`); }
}
ws.close();
if (problems.length) { console.log(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}:\n- ${problems.join('\n- ')}`); done(1); }
console.log(`\nAll ${PAGES.length * 2 * SIZES.length} page loads look fine and sit on the grid. Screenshots are in ui-shots/.`);
done(0);
