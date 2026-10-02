// The update notice: comparing versions, reading the repository, and asking (a fake) GitHub for the newest release.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './helpers.js';

const { newer, repoSlug, refreshUpdate, updateStatus, version, setChecks } = await import('../server/updates.js');

let calls, answer;
const realFetch = globalThis.fetch;
beforeEach(() => {
  db.prepare("DELETE FROM meta WHERE key LIKE 'update_%'").run();
  delete process.env.WEALTHFLOW_UPDATE_CHECKS;
  calls = 0;
  globalThis.fetch = async (url) => { calls++; assert.match(url, /^https:\/\/api\.github\.com\/repos\/acme\/wealthflow\/releases\/latest$/); return answer(); };
});
afterEach(() => { globalThis.fetch = realFetch; process.env.WEALTHFLOW_UPDATE_CHECKS = '0'; });
const release = (tag) => () => new Response(JSON.stringify({ tag_name: tag, html_url: `https://github.com/acme/wealthflow/releases/tag/${tag}`,
  published_at: '2026-10-01T12:00:00Z', assets: [{ name: `WealthFlow-${tag.slice(1)}-win-x64.zip`, browser_download_url: 'https://example.test/wf.zip' }] }), { status: 200 });
const bump = (v) => v.split('.').map((x, i) => (i === 1 ? +x + 1 : i === 2 ? 0 : +x)).join('.'); // next minor version

test('versions compare by number, not as text', () => {
  assert.equal(newer('0.10.0', '0.9.9'), true);
  assert.equal(newer('v1.0.0', '1.0.0'), false);
  assert.equal(newer('1.0.0', '1.0.1'), false);
  assert.equal(newer('2.0', '1.9.9'), true);
});

test('the repository comes from package.json in any of the usual spellings', () => {
  assert.equal(repoSlug({ url: 'https://github.com/acme/wealthflow' }), 'acme/wealthflow');
  assert.equal(repoSlug({ url: 'git+https://github.com/acme/wealthflow.git' }), 'acme/wealthflow');
  assert.equal(repoSlug('git@github.com:acme/wealthflow.git'), 'acme/wealthflow');
  assert.equal(repoSlug(''), null);
  assert.equal(repoSlug(null), null);
  assert.match(repoSlug() ?? 'none/none', /^[\w.-]+\/[\w.-]+$/); // this app's own package.json (whatever repository it names)
  assert.equal(repoSlug('https://gitlab.com/acme/wealthflow'), null);
});

test('a newer release is announced with its download; the same version is not', async () => {
  answer = release(`v${bump(version)}`);
  await refreshUpdate({ slug: 'acme/wealthflow' });
  let u = updateStatus();
  assert.equal(u.available, true);
  assert.equal(u.latest, bump(version));
  assert.equal(u.download, 'https://example.test/wf.zip');
  answer = release(`v${version}`);
  await refreshUpdate({ slug: 'acme/wealthflow', force: true });
  u = updateStatus();
  assert.equal(u.available, false);
  assert.equal(u.latest, version);
});

test('asks at most once a day, keeps the last answer when offline, and says nothing for a private repo', async () => {
  answer = release(`v${bump(version)}`);
  await refreshUpdate({ slug: 'acme/wealthflow' });
  await refreshUpdate({ slug: 'acme/wealthflow' }); // within a day: not asked again
  assert.equal(calls, 1);
  answer = () => { throw new TypeError('fetch failed'); };
  await refreshUpdate({ slug: 'acme/wealthflow', force: true });
  let u = updateStatus();
  assert.equal(u.available, true); // still knows about the release it saw
  assert.match(u.error, /fetch failed/);
  answer = () => new Response('{}', { status: 404 }); // private repository, or no releases yet
  await refreshUpdate({ slug: 'acme/wealthflow', force: true });
  u = updateStatus();
  assert.deepEqual([u.available, u.latest, u.error], [false, null, null]);
});

test('turned off, it never asks', async () => {
  answer = release('v99.0.0');
  setChecks(false);
  await refreshUpdate({ slug: 'acme/wealthflow', force: true });
  assert.equal(calls, 0);
  assert.equal(updateStatus().enabled, false);
});
