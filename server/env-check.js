// Runs before the database opens. The encryption key is created on first start if needed; Plaid keys are entered in
// the app's setup screen, so missing ones don't stop the app any more.
import path from 'node:path';
import { ensureEncryptionKey, plaidConfigured, dataDir } from './config.js';

// The database is Node's built-in SQLite, which needs Node 22.13 or newer.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nWealthFlow needs Node 22.13 or newer; this is Node ${process.versions.node}. Install the current LTS from nodejs.org.\n`);
  process.exit(1);
}

try {
  if (ensureEncryptionKey()) console.log(`Created a new encryption key in ${path.join(dataDir, 'config.json')} (keep it with your data).`);
} catch (e) {
  console.error(`\nSetup problem: ${e.message}\n`);
  process.exit(1);
}
if (!plaidConfigured()) console.log('No Plaid keys yet: open the app to finish setup.');
