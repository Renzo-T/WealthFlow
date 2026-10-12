// "Start Mizo Money when I sign in" (Windows): an entry in the current user's Run key that starts the app hidden at
// sign-in. No admin rights needed, and it's removed the same way. Other systems: not offered yet.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const KEY = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, NAME = 'Mizo Money';
const OLD_NAME = 'WealthFlow'; // the app's earlier name: an entry under it is moved to NAME on start (repairEntries)
export const startupSupported = process.platform === 'win32';

// No window, and nothing a closed window can take down: conhost --headless runs Node without a console window (Windows
// 11 otherwise opens console programs in Windows Terminal, where a hidden window isn't reliably hidden, and closing it
// stopped Mizo Money), and --background then starts Mizo Money as a detached process with no console at all.
// app.mjs moves to its own folder and writes its log (--log). Windows paths can't contain ", so plain quoting is safe.
export const startupCommand = (root = process.cwd(), node = process.execPath) =>
  `conhost.exe --headless "${node}" "${path.win32.join(root, 'scripts', 'app.mjs')}" --background --log`;
// An entry for this folder made by an older version (a different command, same app.mjs): rewritten on start.
const ours = (value, root = process.cwd()) => value.includes(path.win32.join(root, 'scripts', 'app.mjs'));

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
  if (!on) try { reg('delete', KEY, '/v', OLD_NAME, '/f'); } catch { /* none under the old name */ }
  return startupStatus();
}

// The Start button on the "Mizo Money isn't running" page: a wealthflow:// link registered for the current user that
// runs the same hidden command. The link's address is ignored (no %1 in the command), so a page can only ever ask
// it to start Mizo Money, nothing else. The browser asks before opening it.
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
    reg('add', PROTO, '/ve', '/d', 'URL:Mizo Money', '/f');
    reg('add', PROTO, '/v', 'URL Protocol', '/d', '', '/f');
    reg('add', `${PROTO}\\shell\\open`, '/v', 'FriendlyAppName', '/d', 'Mizo Money', '/f'); // the name browsers show
    reg('add', `${PROTO}\\shell\\open\\command`, '/ve', '/d', startupCommand(), '/f');
  } else if (launcherStatus().enabled) reg('delete', PROTO, '/f');
  return launcherStatus();
}

// On start (app mode): entries for this folder written by an older version are brought up to date, so a fix to how
// Mizo Money is started reaches people without them turning the options off and on.
export function repairEntries() {
  if (!startupSupported) return [];
  const read = (args) => { try { return reg('query', ...args).split(/REG_SZ\s+/)[1]?.trim() ?? ''; } catch { return null; } };
  const fixed = [];
  const old = read([KEY, '/v', OLD_NAME]);
  if (old && ours(old)) { reg('delete', KEY, '/v', OLD_NAME, '/f'); setStartup(true); fixed.push('start at sign-in, now listed as Mizo Money'); }
  const run = read([KEY, '/v', NAME]);
  if (run && run !== startupCommand() && ours(run)) { setStartup(true); fixed.push('start at sign-in'); }
  const link = read([`${PROTO}\\shell\\open\\command`, '/ve']);
  const shown = read([`${PROTO}\\shell\\open`, '/v', 'FriendlyAppName']);
  if (link && ours(link) && (link !== startupCommand() || shown !== 'Mizo Money')) { setLauncher(true); fixed.push('Start button'); }
  return fixed;
}
