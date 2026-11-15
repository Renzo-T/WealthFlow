// "Tell me when something needs me": which notices apply, that each is sent once, and that the words never carry
// an amount, a balance, an account number or a name (they can show on a lock screen).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset, bank, account } from './helpers.js';

const { notices, candidates, markSent, settle, notifySettings, setNotifySettings, notifyAfterSync, toastXml, parseAppShortcut,
  installedApp, openerCommand } = await import('../server/notify.js');
const { pageUrl, appLauncher } = await import('../scripts/open-page.mjs');

const NOW = new Date(2026, 9, 14, 9, 0); // Wednesday 14 October 2026, 9am local; tomorrow is the 15th
const DAY_AFTER = new Date(2026, 9, 15, 9, 0);

// A bill you added yourself, due on this day of each month.
const bill = (key, day, amount, name = 'Rent') => db.prepare(`INSERT INTO bill_settings (key, manual, name, direction, rule, amount_mode, amount)
  VALUES (?, 1, ?, 'out', ?, 'fixed', ?)`).run(key, name, JSON.stringify({ kind: 'dom', n: day, roll: 0 }), amount);

beforeEach(() => {
  reset();
  for (const t of ['meta', 'notified']) db.prepare(`DELETE FROM ${t}`).run();
  bank('b1', 'Acme Bank'); account('chk', { balance: 5000, mask: '3456', name: 'Alex Rivera Checking' });
  setNotifySettings({ enabled: true });
});

const kinds = (list) => list.map((n) => n.kind);

test('off by default: nothing is sent until you turn it on', () => {
  db.prepare('DELETE FROM meta').run();
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  assert.equal(notifySettings().enabled, false);
  assert.deepEqual(notices(NOW), []);
  assert.deepEqual(kinds(candidates(NOW)), ['signin']); // it would apply; it just isn't sent
});

test('a bank that needs signing in again; other bank errors fix themselves and say nothing', () => {
  db.prepare("UPDATE items SET status = 'INSTITUTION_DOWN'").run();
  assert.deepEqual(notices(NOW), []);
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  const [n, ...rest] = notices(NOW);
  assert.equal(rest.length, 0);
  assert.equal(n.kind, 'signin');
  assert.equal(n.title, 'A bank needs you to sign in again');
  assert.equal(n.page, '#/networth');
  bank('b2', 'Other Bank');
  db.prepare("UPDATE items SET status = 'PENDING_EXPIRATION' WHERE id = 'b2'").run();
  assert.equal(notices(NOW)[0].title, 'Two banks need you to sign in again');
});

test('a bill at or over the threshold due tomorrow; smaller ones and later ones are left alone', () => {
  bill('man:rent', 15, 1200);
  bill('man:gym', 15, 150, 'Gym');
  bill('man:later', 16, 900, 'Insurance');
  let list = notices(NOW);
  assert.deepEqual(kinds(list), ['bill']);
  assert.equal(list[0].title, 'A large bill is due tomorrow');
  assert.deepEqual(list[0].marks, ['bill:man:rent:2026-10-15']);
  setNotifySettings({ billMin: 100 }); // meta notify_bill_min
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'notify_bill_min'").get().value, '100');
  list = notices(NOW);
  assert.equal(list[0].title, 'Two large bills are due tomorrow');
  assert.equal(list[0].marks.length, 2);
});

test('free to spend below zero, once a month; not when there is no everyday account to judge by', () => {
  bill('man:rent', 20, 1200);
  assert.deepEqual(notices(NOW), []); // 5000 − 1200 is fine
  db.prepare("UPDATE accounts SET balance = 100 WHERE id = 'chk'").run();
  let [n] = notices(NOW);
  assert.equal(n.kind, 'free');
  assert.deepEqual(n.marks, ['free:2026-10']);
  markSent([n], NOW);
  assert.deepEqual(notices(DAY_AFTER), []); // same month: already told
  db.prepare('DELETE FROM accounts').run();
  db.prepare("INSERT INTO meta (key, value) VALUES ('safe_cushion', '500')").run(); // would be −500 with no accounts at all
  db.prepare('DELETE FROM notified').run();
  assert.deepEqual(notices(NOW), []);
});

test('at most three, one of each kind, only the kinds you ticked', () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  db.prepare("UPDATE accounts SET balance = 100 WHERE id = 'chk'").run();
  bill('man:rent', 15, 1200); bill('man:car', 15, 400, 'Car'); bill('man:loan', 15, 300, 'Loan');
  assert.deepEqual(kinds(notices(NOW)), ['signin', 'bill', 'free']);
  setNotifySettings({ kinds: { bill: false } });
  assert.deepEqual(kinds(notices(NOW)), ['signin', 'free']);
  assert.deepEqual(notifySettings().kinds, { signin: true, bill: false, free: true });
});

test('never sent twice; a new bank or bill is still told about; a bank fixed and broken again is told again', () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  bill('man:rent', 15, 1200);
  markSent(notices(NOW), NOW);
  assert.deepEqual(notices(NOW), []);
  settle(DAY_AFTER);
  assert.deepEqual(notices(NOW), []); // still broken: nothing again
  assert.equal(db.prepare('SELECT date FROM notified WHERE key = ?').get('signin:b1').date, '2026-10-14');

  bank('b2', 'Other Bank'); db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED' WHERE id = 'b2'").run();
  bill('man:car', 15, 400, 'Car');
  const list = notices(NOW);
  assert.deepEqual(list.map((n) => n.marks), [['signin:b2'], ['bill:man:car:2026-10-15']]);
  assert.equal(list[0].title, 'A bank needs you to sign in again'); // counts only the new one
  markSent(list, NOW);

  db.prepare("UPDATE items SET status = 'ok' WHERE id = 'b1'").run();
  settle(DAY_AFTER);
  assert.deepEqual(notices(NOW), []);
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED' WHERE id = 'b1'").run();
  assert.deepEqual(notices(NOW).map((n) => n.marks), [['signin:b1']]);
});

test('old bill and month marks are cleared after 60 days; a bank still waiting keeps its mark', () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  db.prepare("INSERT INTO notified (key, date) VALUES ('bill:man:rent:2026-07-15', '2026-07-14'), ('free:2026-07', '2026-07-03'), ('signin:b1', '2026-07-01')").run();
  settle(NOW);
  assert.deepEqual(db.prepare('SELECT key FROM notified ORDER BY key').all().map((r) => r.key), ['signin:b1']);
});

test('the words never carry an amount, a balance, an account number or a name', () => {
  bank('b2', 'Other Bank');
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  db.prepare("UPDATE accounts SET balance = 100 WHERE id = 'chk'").run();
  bill('man:rent', 15, 1234.56, 'Acme Property Rent');
  const list = notices(NOW);
  assert.equal(list.length, 3);
  for (const n of list) {
    const words = `${n.title} ${n.body}`;
    assert.doesNotMatch(words, /\d/, words); // no amounts, balances, masks or dates
    assert.doesNotMatch(words, /\$|Acme|Alex|Rivera|Other Bank|Rent/, words);
  }
});

test('the bill threshold must be a number, 0 or more', () => {
  for (const bad of [-5, 'lots', '', null]) assert.throws(() => setNotifySettings({ billMin: bad }), /0 or more/);
  assert.equal(notifySettings().billMin, 200);
  assert.equal(setNotifySettings({ billMin: '350' }).billMin, 350);
});

test('never delivered from tests, even with something to say; nothing is marked as sent', async () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  assert.equal(notices().length, 1);
  assert.deepEqual(await notifyAfterSync(), []);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM notified').get().n, 0);
});

test('the toast opens the right page and carries only the notice\'s words, safely escaped', () => {
  db.prepare("UPDATE items SET status = 'ITEM_LOGIN_REQUIRED'").run();
  const n = notices(NOW)[0];
  assert.match(toastXml(n, { link: true }), /launch="wealthflow-open:networth"/); // opens the app window there
  const xml = toastXml(n, { base: 'https://localhost:3000' }); // without the link: the browser
  assert.match(xml, /launch="https:\/\/localhost:3000\/#\/networth"/);
  assert.match(xml, /<text>A bank needs you to sign in again<\/text>/);
  assert.match(toastXml({ page: '#/', title: 'x', body: 'y' }, { link: true }), /launch="wealthflow-open:dashboard"/);
  assert.match(toastXml({ page: '#/', title: 'Fish & <chips>', body: '"x"' }, { base: 'http://localhost:3000' }),
    /<text>Fish &amp; &lt;chips&gt;<\/text><text>&quot;x&quot;<\/text>/);
});

// A Start-menu shortcut as Chrome writes it: the launcher path as plain text, the arguments as UTF-16.
const shortcut = (proxy, args, pad = 0) => Buffer.concat([Buffer.from(`\0\0\x10\0${proxy}\0`, 'latin1'), Buffer.alloc(pad), Buffer.from(`${args}\0`, 'utf16le')]);
const PROXY = String.raw`C:\Program Files\Google\Chrome\Application\chrome_proxy.exe`, ID = 'abcdefghijklmnopabcdefghijklmnop';

test('the installed app is read from its Start-menu shortcut (Chrome or Edge, any profile)', async () => {
  for (const pad of [0, 1]) // the arguments can start on either byte
    assert.deepEqual(parseAppShortcut(shortcut(PROXY, ` --profile-directory=Default --app-id=${ID}`, pad)), { proxy: PROXY, profile: 'Default', appId: ID });
  const edge = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge_proxy.exe`;
  assert.deepEqual(parseAppShortcut(shortcut(edge, ` --profile-directory="Profile 1" --app-id=${ID}`)), { proxy: edge, profile: 'Profile 1', appId: ID });
  assert.equal(parseAppShortcut(shortcut(String.raw`C:\Windows\notepad.exe`, ` --app-id=${ID}`)), null);
  assert.equal(parseAppShortcut(Buffer.from('nothing here')), null);

  const fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mizo-start-'));
  assert.equal(installedApp({ APPDATA: home }), null); // not installed: the click opens the browser
  const dir = path.join(home, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Chrome Apps');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Mizo Money.lnk'), shortcut(PROXY, ` --profile-directory=Default --app-id=${ID}`));
  assert.equal(installedApp({ APPDATA: home }).appId, ID);
  fs.rmSync(home, { recursive: true });
});

test('the link runs open-page.mjs with no window, and passes the address last and quoted', () => {
  const app = { proxy: PROXY, profile: 'Default', appId: ID };
  assert.equal(openerCommand(app, 'https://localhost:3000', String.raw`C:\Users\Alex Rivera\Mizo Money`, String.raw`C:\Program Files\nodejs\node.exe`),
    String.raw`conhost.exe --headless "C:\Program Files\nodejs\node.exe" "C:\Users\Alex Rivera\Mizo Money\scripts\open-page.mjs" "https://localhost:3000" "${PROXY}" "Default" "${ID}" "%1"`);
  assert.match(openerCommand(null, 'https://localhost:3000', 'C:\\m', 'node.exe'), /open-page\.mjs" "https:\/\/localhost:3000" "%1"$/);
});

test('clicking: the address only ever picks one of three pages; anything else is the dashboard', () => {
  const base = 'https://localhost:3000';
  assert.equal(pageUrl(base, 'wealthflow-open:bills'), `${base}/#/bills`);
  assert.equal(pageUrl(base, 'wealthflow-open://networth/'), `${base}/#/networth`);
  assert.equal(pageUrl(base, 'wealthflow-open:dashboard'), `${base}/#/`);
  for (const odd of ['wealthflow-open:settings', 'wealthflow-open:bills?x=1', 'wealthflow-open:../../x', 'https://example.com', '', undefined])
    assert.equal(pageUrl(base, odd), `${base}/#/`, String(odd));
  assert.equal(pageUrl('https://example.com', 'wealthflow-open:bills'), 'https://localhost:3000/#/bills'); // only this computer
  assert.ok(appLauncher(PROXY, 'Default', ID));
  for (const bad of [[String.raw`C:\Windows\System32\cmd.exe`, 'Default', ID], [PROXY, 'Default" --x', ID], [PROXY, 'Default', 'not-an-id']])
    assert.equal(appLauncher(...bad), null);
});
