// Mizo Money's service worker. It only does one thing: when the Mizo Money server isn't running, opening the app
// shows a page saying so (with a Start button) instead of the browser's connection error. Nothing is cached (your data
// always comes live from the server and is never stored by the browser); the page below is built in, so there's
// nothing to download.
const ICON = '<svg width="48" height="48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<rect width="512" height="512" rx="112" fill="#1e2a47"/><circle cx="256" cy="256" r="170" fill="#d9482e"/><circle cx="256" cy="256" r="143" fill="none" stroke="#fff6f2" stroke-width="11" opacity=".55"/><path d="M183.5 319.5V197.1l72.5 79.3 72.5-79.3v122.4" fill="none" stroke="#fff6f2" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const OFFLINE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mizo Money isn't running</title>
  <style>
    :root { --bg: #f3f3ef; --card: #fff; --ink: #1b2030; --muted: #555c6e; --blue: #1e2a47; --line: #e1e3df; color-scheme: light; }
    @media (prefers-color-scheme: dark) { :root { --bg: #11141c; --card: #181c27; --ink: #e7e9ef; --muted: #a0a7b8; --blue: #3c58a8; --line: #282e3d; color-scheme: dark; } }
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
    <h1>Mizo Money isn't running</h1>
    <p>This window shows Mizo Money, which runs on this computer. Start it with the button below, or by double-clicking
      <b>Mizo Money.cmd</b> in the Mizo Money folder (from the code: <code>npm run app</code>).</p>
    <div class="row">
      <button class="primary" id="start">Start Mizo Money</button>
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
      // The wealthflow:// link (Settings › App › Let the app window start Mizo Money) starts it; the browser asks first.
      start.disabled = true;
      status.textContent = 'Starting Mizo Money…';
      location.href = 'wealthflow://start';
      setTimeout(() => {
        start.disabled = false;
        status.textContent = "Still not running. If your browser didn't offer to open Mizo Money, the Start button isn't set up on this "
          + 'computer: start it from Mizo Money.cmd, then turn on "Let the app window start Mizo Money" in Settings › App.';
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
