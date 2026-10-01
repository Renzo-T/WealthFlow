// One check before committing: tests, a production build, the page check (when the app is running), and a scan
// that refuses secrets. Runs as the git pre-commit hook (.githooks/pre-commit); also `npm run verify`.
//   --staged   also scan the staged changes for secrets (the hook passes this)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

const staged = process.argv.includes('--staged');
const run = (cmd, args, label) => {
  process.stdout.write(`• ${label}… `);
  // One command string through the shell (npm is a .cmd on Windows); the arguments here are fixed, not user input.
  const r = spawnSync([cmd, ...args].join(' '), { encoding: 'utf8', shell: true });
  if (r.status === 0) { console.log('ok'); return true; }
  console.log('FAILED'); console.log((r.stdout ?? '') + (r.stderr ?? '')); return false;
};

// 1. Secrets: never commit .env, certs/ or data/, and never any value from .env.
if (staged) {
  process.stdout.write('• secrets… ');
  const files = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const bad = files.filter((f) => /^(\.env$|certs\/|data\/)/.test(f));
  const diff = spawnSync('git', ['diff', '--cached', '-U0'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout;
  // Secret values: keys named like secrets, plus any long random-looking value (not settings like PLAID_ENV=production).
  const values = existsSync('.env') ? readFileSync('.env', 'utf8').split('\n').map((l) => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l))
    .filter(Boolean).map(([, k, v]) => [k, v.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')])
    .filter(([k, v]) => v.length >= 8 && (/SECRET|KEY|TOKEN|PASS|CLIENT_ID/i.test(k) || /^[A-Za-z0-9_\-+/=]{20,}$/.test(v))).map(([, v]) => v) : [];
  const leaked = values.filter((v) => diff.includes(v)).length;
  if (bad.length || leaked) {
    console.log('FAILED');
    if (bad.length) console.log(`  These must never be committed: ${bad.join(', ')}`);
    if (leaked) console.log(`  ${leaked} value(s) from .env appear in the staged changes.`);
    process.exit(1);
  }
  console.log('ok');
}

// 2. Tests and a production build.
let ok = run('npm', ['test', '--silent'], 'tests');
const out = mkdtempSync(join(tmpdir(), 'wf-build-'));
ok = run('npx', ['vite', 'build', 'web', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], 'build') && ok;
rmSync(out, { recursive: true, force: true });

// 3. The page check, if the app is running (it needs live data); otherwise say it was skipped.
const up = await new Promise((r) => https.get('https://localhost:3000/api/items', { rejectUnauthorized: false, timeout: 2000 }, (res) => { res.resume(); r(res.statusCode < 500); })
  .on('error', () => r(false)).on('timeout', function () { this.destroy(); r(false); }));
if (up) ok = run('npm', ['run', 'check:ui', '--silent'], 'pages (check:ui)') && ok;
else console.log('• pages: skipped (start the app with npm start to include them)');

if (!ok) { console.log('\nNot committing: fix the failures above (or, if you must, git commit --no-verify).'); process.exit(1); }
