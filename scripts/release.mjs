// npm run release [patch|minor|major|1.2.3]   (default: patch)
// Publishes a new version: bumps package.json, commits (through the usual pre-commit checks, with their output shown)
// and tags it (vX.Y.Z), and pushes. GitHub then builds the Windows download and publishes the release
// (.github/workflows/release.yml); copies with the update notice on see it within a day. Only from main, with
// everything committed and in step with GitHub. If the checks fail or you stop it before the commit, the version bump
// is undone, so you can simply run it again.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const bump = process.argv[2] ?? 'patch';
if (!/^(patch|minor|major|\d+\.\d+\.\d+)$/.test(bump)) { console.error('Use: npm run release [patch|minor|major|1.2.3]'); process.exit(1); }
// Fixed commands (npm is a .cmd on Windows, hence the shell); the only argument from you is checked above.
const run = (cmd, quiet = false) => {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};
const must = (cmd) => { const r = run(cmd, true); if (!r.ok) stop(`"${cmd}" failed: ${r.err || r.out}`); return r.out; };
function stop(msg) { console.error(`\n${msg}`); process.exit(1); }

if (must('git rev-parse --abbrev-ref HEAD') !== 'main') stop('Release from the main branch.');
if (must('git status --porcelain')) stop('Commit or put aside your changes first (git status shows them).');
must('git fetch --quiet origin');
if (must('git rev-parse HEAD') !== must('git rev-parse origin/main')) stop('main and GitHub differ: pull or push first.');

// From here until the commit, an interruption (Ctrl+C) or a failure puts the version back.
let committed = false;
const undo = () => { if (!committed) { run('git checkout -- package.json package-lock.json', true); console.error('The version change was undone; nothing was committed.'); } };
process.on('SIGINT', () => {}); // Ctrl+C stops the step that's running; the checks below then undo the bump

const bumped = run(`npm version ${bump} --no-git-tag-version`, true);
if (!bumped.ok) { undo(); stop(`Couldn't change the version: ${bumped.err || bumped.out}`); }
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
console.log(`Releasing v${version}. First the usual checks (tests, build and, if WealthFlow is running, every page);`);
console.log('they take a few minutes.\n');
const commit = run(`git commit -m "Release v${version}" -- package.json package-lock.json`);
if (!commit.ok) { undo(); stop('The checks failed or were stopped: see above. Fix what they report and run npm run release again.'); }
committed = true;

must(`git tag -a v${version} -m "Release v${version}"`);
const push = run('git push --follow-tags origin main');
if (!push.ok) stop(`v${version} is committed and tagged here but didn't reach GitHub. When you're online: git push --follow-tags origin main`);
const repo = (JSON.parse(readFileSync('package.json', 'utf8')).repository?.url ?? '').replace(/\.git$/, '');
console.log(`\nv${version} is on its way: GitHub is building the download${repo ? ` (${repo}/actions)` : ''}.`);
console.log(`It appears at ${repo || 'the repository'}/releases when that finishes, usually in a few minutes.`);
