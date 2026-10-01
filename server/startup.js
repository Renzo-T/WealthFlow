// "Start WealthFlow when I sign in" (Windows): an entry in the current user's Run key that starts the app hidden at
// sign-in. No admin rights needed, and it's removed the same way. Other systems: not offered yet.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const KEY = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, NAME = 'WealthFlow';
export const startupSupported = process.platform === 'win32';

// PowerShell's -WindowStyle Hidden keeps a console window from opening; the app writes its own log (--log).
const ps = (s) => s.replace(/'/g, "''");
export const startupCommand = (root = process.cwd(), node = process.execPath) =>
  `powershell.exe -NoProfile -WindowStyle Hidden -Command "Set-Location -LiteralPath '${ps(root)}'; & '${ps(node)}' '${ps(path.join(root, 'scripts', 'app.mjs'))}' --log"`;

const reg = (...args) => execFileSync('reg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });

// { supported, enabled, here }: here = the entry starts this copy (it can point elsewhere if the folder moved).
export function startupStatus() {
  if (!startupSupported) return { supported: false, enabled: false, here: false };
  try {
    const value = reg('query', KEY, '/v', NAME).split(/REG_SZ\s+/)[1]?.trim() ?? '';
    return { supported: true, enabled: true, here: value === startupCommand() };
  } catch { return { supported: true, enabled: false, here: false }; } // reg exits 1 when the entry isn't there
}

export function setStartup(on) {
  if (!startupSupported) throw new Error('Starting at sign-in is only available on Windows for now.');
  if (on) reg('add', KEY, '/v', NAME, '/t', 'REG_SZ', '/d', startupCommand(), '/f');
  else if (startupStatus().enabled) reg('delete', KEY, '/v', NAME, '/f');
  return startupStatus();
}

// The Start button on the "WealthFlow isn't running" page: a wealthflow:// link registered for the current user that
// runs the same hidden command. The link's address is ignored (no %1 in the command), so a page can only ever ask
// it to start WealthFlow, nothing else. The browser asks before opening it.
const PROTO = String.raw`HKCU\Software\Classes\wealthflow`;
export function launcherStatus() {
  if (!startupSupported) return { supported: false, enabled: false, here: false };
  try {
    const value = reg('query', `${PROTO}\\shell\\open\\command`, '/ve').split(/REG_SZ\s+/)[1]?.trim() ?? '';
    return { supported: true, enabled: true, here: value === startupCommand() };
  } catch { return { supported: true, enabled: false, here: false }; }
}
export function setLauncher(on) {
  if (!startupSupported) throw new Error('The Start button is only available on Windows for now.');
  if (on) {
    reg('add', PROTO, '/ve', '/d', 'URL:WealthFlow', '/f');
    reg('add', PROTO, '/v', 'URL Protocol', '/d', '', '/f');
    reg('add', `${PROTO}\\shell\\open`, '/v', 'FriendlyAppName', '/d', 'WealthFlow', '/f'); // the name browsers show
    reg('add', `${PROTO}\\shell\\open\\command`, '/ve', '/d', startupCommand(), '/f');
  } else if (launcherStatus().enabled) reg('delete', PROTO, '/f');
  return launcherStatus();
}
