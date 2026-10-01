// The database layer on Node's built-in SQLite: transactions (all or nothing, nestable) and backups.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './helpers.js';

beforeEach(() => db.exec('DROP TABLE IF EXISTS t; CREATE TABLE t (v INTEGER)'));
const values = () => db.prepare('SELECT v FROM t ORDER BY v').all().map((r) => r.v);
const add = (v) => db.prepare('INSERT INTO t (v) VALUES (?)').run(v);

test('a transaction saves everything, or nothing when it throws', () => {
  assert.equal(db.transaction((a, b) => { add(a); add(b); return 'done'; })(1, 2), 'done');
  assert.throws(() => db.transaction(() => { add(3); throw new Error('stop'); })(), /stop/);
  assert.deepEqual(values(), [1, 2]);
});

test('nested transactions: an inner failure caught by the outer one undoes only the inner part', () => {
  const inner = db.transaction((v) => { add(v); if (v < 0) throw new Error('bad'); });
  db.transaction(() => {
    add(1);
    inner(2);
    try { inner(-1); } catch { /* the caller decided to carry on */ }
  })();
  assert.deepEqual(values(), [1, 2]);
  assert.throws(() => db.transaction(() => { inner(5); throw new Error('outer'); })(), /outer/);
  assert.deepEqual(values(), [1, 2]); // the outer failure undoes the inner work too
  add(9); // and the connection is usable afterwards (no transaction left open)
  assert.deepEqual(values(), [1, 2, 9]);
});

test('rows are plain objects, and run() reports changes and the new row id', () => {
  const r = add(7);
  assert.equal(r.changes, 1);
  assert.equal(typeof r.lastInsertRowid, 'number');
  assert.deepEqual(db.prepare('SELECT v FROM t').get(), { v: 7 });
  assert.equal(db.prepare('SELECT v FROM t WHERE v = 0').get(), undefined);
});

test('backup writes a complete copy that opens on its own', async () => {
  add(42);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wf-backup-')), "it's a copy.db"); // quote in the name
  await db.backup(file);
  const { DatabaseSync } = await import('node:sqlite');
  const copy = new DatabaseSync(file, { readOnly: true });
  assert.equal(copy.prepare('SELECT v FROM t').get().v, 42);
  copy.close();
});
