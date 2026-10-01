// npm run app: WealthFlow as one program. Builds the page when its files changed since the last build, then serves
// the page and the API together on https://localhost:3000 (http without certs/), the address the installed app opens.
// "Start WealthFlow when I sign in" runs this hidden with --log, which writes output to app.log in the data folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

if (process.argv.includes('--log')) {
  const dir = process.env.WEALTHFLOW_DATA_DIR || 'data';
  fs.mkdirSync(dir, { recursive: true });
  const log = fs.createWriteStream(path.join(dir, 'app.log'), { flags: 'w' });
  for (const s of [process.stdout, process.stderr]) s.write = (chunk, ...rest) => log.write(chunk, ...rest.filter((r) => typeof r !== 'function'));
}

const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
const newest = (dir) => fs.readdirSync(dir, { recursive: true }).reduce((m, f) => Math.max(m, mtime(path.join(dir, f))), 0);
const sources = Math.max(newest('web/src'), newest('web/public'), mtime('web/index.html'), mtime('web/vite.config.js'), mtime('package-lock.json'));
if (sources > mtime('web/dist/index.html')) {
  console.log('Building the app…');
  const { build } = await import('vite');
  await build({ root: 'web', logLevel: 'warn' });
}

process.env.WEALTHFLOW_APP = '1';
await import('../server/index.js');
