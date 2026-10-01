import fs from 'node:fs';
import path from 'node:path';
import db from './db.js';

// Daily automatic backups. Net worth history accumulates one real point per day and can't be recreated later
// (Plaid doesn't provide past investment values), so after the first sync of each day we keep a copy of the
// database: data/backups/auto-YYYY-MM-DD.db, newest KEEP kept. Manual downloads (wealthflow-*.db) are separate.
// Backups contain the bank tokens encrypted with ENCRYPTION_KEY from .env; restoring needs that same .env.
const DIR = path.resolve('data', 'backups');
const KEEP = 14;

export async function autoBackup(today = new Date().toLocaleDateString('en-CA')) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `auto-${today}.db`);
  if (fs.existsSync(file)) return null; // already have today's
  await db.backup(file); // consistent snapshot, safe while the app runs
  const autos = fs.readdirSync(DIR).filter((f) => /^auto-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const old of autos.slice(0, -KEEP)) fs.unlinkSync(path.join(DIR, old));
  return file;
}

export const listBackups = () => {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.db')).sort().reverse()
    .map((f) => ({ name: f, auto: f.startsWith('auto-'), size: fs.statSync(path.join(DIR, f)).size }));
};
