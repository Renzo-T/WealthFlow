// One-time setup: creates .env with a fresh ENCRYPTION_KEY and local HTTPS certs (if mkcert is installed).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const major = Number(process.versions.node.split('.')[0]);
if (major < 22 || major >= 24) console.warn(`! Node ${process.versions.node} detected. Use Node 22 LTS (see .nvmrc); newer versions can crash the SQLite module.\n`);

if (!fs.existsSync('.env')) {
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync('.env', fs.readFileSync('.env.example', 'utf8').replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${key}`));
  console.log('Created .env with a new ENCRYPTION_KEY. Keep this file safe: without the key, stored bank tokens cannot be decrypted.');
} else console.log('.env already exists, left unchanged.');

fs.mkdirSync('certs', { recursive: true });
if (!fs.existsSync('certs/localhost.pem')) {
  try {
    execSync('mkcert -install && mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost', { stdio: 'inherit' });
  } catch { console.log('mkcert not found. Install it to connect real banks (OAuth needs https). Sandbox works without it.'); }
}
console.log('\nNext: add your Plaid keys to .env, then run: npm start');
