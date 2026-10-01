// WealthFlow's service worker. It only does one thing: when the WealthFlow server isn't running, opening the app
// shows a page saying so (with a Start button) instead of the browser's connection error. Nothing is cached (your data
// always comes live from the server and is never stored by the browser); the page below is built in, so there's
// nothing to download.
const ICON = '<svg width="48" height="48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<rect width="512" height="512" rx="112" fill="#2f6bed"/>'
  + '<path d="M104 344 L200 248 L272 304 L408 160" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M328 160 H408 V240" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const OFFLINE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WealthFlow isn't running</title>
  <style>
    :root { --bg: #f3f7fc; --card: #fff; --ink: #0f1b33; --muted: #6b7a94; --blue: #2f6bed; --line: #e2ebf6; color-scheme: light; }
    @media (prefers-color-scheme: dark) { :root { --bg: #0b1220; --card: #121b2e; --ink: #e6ecf7; --muted: #8e9bb4; --line: #23304a; color-scheme: dark; } }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 2rem; max-width: 30rem; margin: 1rem; }
    h1 { font-size: 1.3rem; margin: .75rem 0 .5rem; }
    p { color: var(--muted); line-height: 1.5; }
    code { background: var(--bg); padding: .1rem .35rem; border-radius: 6px; color: var(--ink); }
    .row { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
    button { font: inherit; border-radius: 9px; padding: .55rem 1rem; cursor: pointer; border: 1px solid var(--line); background: var(--card); color: var(--ink); }
    button.primary { background: var(--blue); color: #fff; border-color: var(--blue); }
    button:disabled { opacity: .6; cursor: default; }
    .status { color: var(--ink); }
    .status:empty { display: none; }
  </style>
</head>
<body>
  <div class="card">
    ${ICON}
    <h1>WealthFlow isn't running</h1>
    <p>This window shows WealthFlow, which runs on this computer. Start it with the button below, or by double-clicking
      <b>WealthFlow.cmd</b> in the WealthFlow folder (from the code: <code>npm run app</code>).</p>
    <div class="row">
      <button class="primary" id="start">Start WealthFlow</button>
      <button id="retry">Try again</button>
    </div>
    <p class="status" id="status" role="status"></p>
  </div>
  <script>
    // Reload into the app as soon as the server answers, however it was started.
    const status = document.getElementById('status'), start = document.getElementById('start');
    const up = () => fetch('/api/app', { cache: 'no-store' }).then((r) => r.ok, () => false);
    setInterval(async () => { if (await up()) location.reload(); }, 3000);
    document.getElementById('retry').onclick = () => location.reload();
    start.onclick = () => {
      // The wealthflow:// link (Settings › App › Let the app window start WealthFlow) starts it; the browser asks first.
      start.disabled = true;
      status.textContent = 'Starting WealthFlow…';
      location.href = 'wealthflow://start';
      setTimeout(() => {
        start.disabled = false;
        status.textContent = "Still not running. If your browser didn't offer to open WealthFlow, the Start button isn't set up on this "
          + 'computer: start it from WealthFlow.cmd, then turn on "Let the app window start WealthFlow" in Settings › App.';
      }, 15000);
    };
  </script>
</body>
</html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
