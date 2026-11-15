// Clicking a Mizo Money notification (Windows): opens the installed app window on the page the notice is about, or
// the default browser when the app isn't installed. Windows runs this through the wealthflow-open: link that
// server/notify.js registers for the current user:
//   node open-page.mjs <base> [<launcher> <profile> <app id>] <link address>
// Everything but the link address was written by Mizo Money. The address can come from anywhere (a web page can open
// the link too, after the browser asks), so it's only ever read as one of three page names; anything else opens the
// dashboard.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PAGES = { networth: '#/networth', bills: '#/bills', dashboard: '#/' };

// wealthflow-open:bills → https://localhost:3000/#/bills
export function pageUrl(base, address) {
  const page = /^wealthflow-open:\/{0,2}([a-z]+)\/?$/i.exec(String(address ?? ''))?.[1]?.toLowerCase();
  const home = /^https?:\/\/localhost:\d{1,5}$/.test(base ?? '') ? base : 'https://localhost:3000';
  return `${home}/${PAGES[page] ?? PAGES.dashboard}`;
}

// The installed app's launcher (Chrome's or Edge's), only if it looks exactly like one; otherwise null.
export function appLauncher(proxy, profile, appId) {
  if (!/^[A-Za-z]:\\[^"<>|?*]+\\(chrome|msedge)_proxy\.exe$/i.test(proxy ?? '')) return null;
  if (!/^[\w .-]{1,64}$/.test(profile ?? '') || !/^[a-p]{32}$/.test(appId ?? '')) return null;
  return { proxy, args: (url) => [`--profile-directory=${profile}`, `--app-id=${appId}`, `--app-launch-url-for-shortcuts-menu-item=${url}`] };
}

export function open(argv) {
  const address = argv.at(-1), [base, ...app] = argv.slice(0, -1);
  const url = pageUrl(base, address), launcher = app.length === 3 ? appLauncher(...app) : null;
  const [cmd, args] = launcher && fs.existsSync(launcher.proxy) ? [launcher.proxy, launcher.args(url)]
    : ['rundll32', ['url.dll,FileProtocolHandler', url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) open(process.argv.slice(2));
