// npm run package: the downloadable Windows copy, release/WealthFlow-<version>-win-x64.zip. Nothing to install: it
// carries its own Node (the official build from nodejs.org, checksum-verified), the server with only its runtime
// packages, and the page already built. People unzip it and double-click WealthFlow.cmd.
//   WEALTHFLOW_NODE_VERSION=v22.20.0 npm run package   bundles that Node instead of the one running this script.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const nodeVersion = process.env.WEALTHFLOW_NODE_VERSION || process.version;
const name = `WealthFlow-${pkg.version}-win-x64`;
const out = path.join('release', 'WealthFlow'), cache = path.join('release', 'cache');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npm', ...opts }); // npm.cmd needs a shell
const step = (s) => console.log(`\n• ${s}`);
// Windows' own tar (bsdtar) reads and writes zip files; another tar earlier on the PATH (e.g. Git's) may not.
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'tar.exe') : 'tar';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(cache, { recursive: true });

step('Building the page');
const { build } = await import('vite');
// Straight into the package, not web/dist: a WealthFlow running from this folder serves web/dist.
await build({ root: 'web', logLevel: 'warn', build: { outDir: path.resolve(out, 'web', 'dist'), emptyOutDir: true } });

step('Copying the app');
fs.cpSync('server', path.join(out, 'server'), { recursive: true });
fs.mkdirSync(path.join(out, 'scripts'));
fs.copyFileSync('scripts/app.mjs', path.join(out, 'scripts', 'app.mjs'));
for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(f, path.join(out, f));
fs.writeFileSync(path.join(out, 'PORTABLE'),
  'This copy keeps your data in your user\'s app-data folder (on Windows, %LOCALAPPDATA%\\WealthFlow), not in this folder,\r\n' +
  'so replacing this folder with a newer version keeps everything.\r\n');
fs.writeFileSync(path.join(out, 'WealthFlow.cmd'), [
  '@echo off',
  'rem Starts WealthFlow in the background and opens it in your browser (or just opens it if it is already running).',
  '"%~dp0node.exe" "%~dp0scripts\\app.mjs" --background --open',
  '',
].join('\r\n'));
fs.copyFileSync(path.join('scripts', 'release-readme.txt'), path.join(out, 'README.txt'));

step('Installing the server\'s packages (express, plaid, dotenv)');
// npm's own script under this Node when run as `npm run package` (no shell needed); plain npm otherwise.
const npm = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath]] : ['npm', []];
run(npm[0], [...npm[1], 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: out });
// The copy only needs what it runs: no build tools, scripts or development packages listed.
// (repository stays: the update notice asks it for newer releases.)
const { name: n, version, license, repository, type, dependencies } = pkg;
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: n, version, license, repository, private: true, type, dependencies }, null, 2) + '\n');
fs.rmSync(path.join(out, 'package-lock.json'));

step(`Adding Node ${nodeVersion} from nodejs.org`);
const zipName = `node-${nodeVersion}-win-x64`, zip = path.join(cache, `${zipName}.zip`);
if (!fs.existsSync(zip)) {
  const res = await fetch(`https://nodejs.org/dist/${nodeVersion}/${zipName}.zip`);
  if (!res.ok) throw new Error(`Couldn't download Node ${nodeVersion} (${res.status}).`);
  fs.writeFileSync(`${zip}.part`, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(`${zip}.part`, zip);
}
const sums = await (await fetch(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`)).text();
const expected = sums.split('\n').find((l) => l.endsWith(`  ${zipName}.zip`))?.split(' ')[0];
const actual = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
if (!expected || expected !== actual) { fs.rmSync(zip); throw new Error(`Node download failed its checksum (expected ${expected}, got ${actual}). Run again.`); }
run(tar, ['-xf', zip, '-C', cache, `${zipName}/node.exe`, `${zipName}/LICENSE`]);
fs.copyFileSync(path.join(cache, zipName, 'node.exe'), path.join(out, 'node.exe'));
fs.copyFileSync(path.join(cache, zipName, 'LICENSE'), path.join(out, 'NODE-LICENSE.txt'));

step('Zipping');
const final = path.join('release', `${name}.zip`);
fs.rmSync(final, { force: true });
run(tar, ['-a', '-c', '-f', `${name}.zip`, 'WealthFlow'], { cwd: 'release' });
console.log(`\nDone: ${final} (${(fs.statSync(final).size / 1e6).toFixed(1)} MB)`);
