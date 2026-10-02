// npm run release [patch|minor|major|1.2.3]   (default: patch)
// Publishes a new version: bumps package.json, commits and tags it (vX.Y.Z), and pushes. GitHub then builds the
// Windows download and publishes the release (.github/workflows/release.yml); copies with the update notice on see it
// within a day. Only from main, with everything committed and in step with GitHub.
import { spawnSync } from 'node:child_process';

const bump = process.argv[2] ?? 'patch';
if (!/^(patch|minor|major|\d+\.\d+\.\d+)$/.test(bump)) { console.error('Use: npm run release [patch|minor|major|1.2.3]'); process.exit(1); }
// Fixed commands (npm is a .cmd on Windows, hence the shell); the only argument from you is checked above.
const sh = (cmd, { quiet = false } = {}) => {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  if (r.status !== 0) { if (quiet) console.error(r.stderr || r.stdout); console.error(`\nStopped: "${cmd}" failed.`); process.exit(1); }
  return (r.stdout ?? '').trim();
};
const stop = (msg) => { console.error(msg); process.exit(1); };

if (sh('git rev-parse --abbrev-ref HEAD', { quiet: true }) !== 'main') stop('Release from the main branch.');
if (sh('git status --porcelain', { quiet: true })) stop('Commit or put aside your changes first (git status shows them).');
sh('git fetch --quiet origin', { quiet: true });
if (sh('git rev-parse HEAD', { quiet: true }) !== sh('git rev-parse origin/main', { quiet: true })) stop('main and GitHub differ: pull or push first.');

// npm version: updates package.json and package-lock.json, commits (through the pre-commit checks) and tags.
sh(`npm version ${bump} -m "Release v%s"`);
const version = sh('node -p "require(\'./package.json\').version"', { quiet: true });
sh('git push --follow-tags origin main');
const repo = sh('node -p "require(\'./package.json\').repository?.url ?? \'\'"', { quiet: true }).replace(/\.git$/, '');
console.log(`\nv${version} is on its way: GitHub is building the download${repo ? ` (${repo}/actions)` : ''}.`);
console.log(`It appears at ${repo || 'the repository'}/releases when that finishes, usually in a few minutes.`);
