// npm run app: WealthFlow as one program. Builds the page when its files changed since the last build, then serves
// the page and the API together on port 3000 (https when certs/ has a local certificate), the address the installed
// app opens.
//   --log         write output to app.log in the data folder (used when nobody sees a console)
//   --open        open WealthFlow in the browser once it's ready (or right away if it's already running)
//   --background  start it detached with no window and return at once (WealthFlow.cmd in the download uses this)
// "Start WealthFlow when I sign in" runs this hidden with --log.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

if (args.includes('--background')) {
  spawn(process.execPath, [fileURLToPath(import.meta.url), ...new Set([...args.filter((a) => a !== '--background'), '--log'])],
    { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  process.exit(0);
}

// The download on Windows: files unzipped from a downloaded zip carry Windows' "from the internet" mark, which can make
// Windows ask before running WealthFlow.cmd. Once WealthFlow has run, take that mark off its own launcher (and Node),
// so it asks at most once. (Starting at sign-in and the Start button never go through that check.)
if (process.platform === 'win32' && fs.existsSync('PORTABLE'))
  for (const f of ['WealthFlow.cmd', 'node.exe']) try { fs.unlinkSync(`${f}:Zone.Identifier`); } catch { /* not marked */ }

const { dataDir } = await import('../server/config.js');
if (args.includes('--log')) {
  // Appended (a second launch that finds WealthFlow already running mustn't wipe the running copy's log); past 1 MB
  // the old log moves to app.old.log.
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'app.log');
  try { if (fs.statSync(file).size > 1e6) fs.renameSync(file, path.join(dataDir, 'app.old.log')); } catch { /* no log yet */ }
  // Written straight away (not buffered), so the lines just before an exit are kept.
  const write = (chunk) => { try { fs.appendFileSync(file, chunk); } catch { /* never let logging stop the app */ } return true; };
  write(`\n--- ${new Date().toLocaleString()} ---\n`);
  for (const s of [process.stdout, process.stderr]) s.write = write;
}

// The download ships the page already built (and has no web/src); from the code, rebuild when anything changed.
if (fs.existsSync('web/src')) {
  const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
  const newest = (dir) => fs.readdirSync(dir, { recursive: true }).reduce((m, f) => Math.max(m, mtime(path.join(dir, f))), 0);
  const sources = Math.max(newest('web/src'), newest('web/public'), mtime('web/index.html'), mtime('web/vite.config.js'), mtime('package-lock.json'));
  if (sources > mtime('web/dist/index.html')) {
    console.log('Building the app…');
    const { build } = await import('vite');
    await build({ root: 'web', logLevel: 'warn' });
  }
}

process.env.WEALTHFLOW_APP = '1';
if (args.includes('--open')) process.env.WEALTHFLOW_OPEN = '1';
await import('../server/index.js');
