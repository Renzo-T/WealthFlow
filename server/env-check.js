// Runs before the database opens, so a missing setting exits cleanly with a readable message.
const problems = [];
for (const k of ['PLAID_CLIENT_ID', 'PLAID_SECRET']) if (!process.env[k]) problems.push(`${k} is empty`);
if (Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex').length !== 32) problems.push('ENCRYPTION_KEY is missing or not 32 bytes of hex');
if (problems.length) {
  console.error(`\nSetup incomplete:\n - ${problems.join('\n - ')}\nEdit .env (run "npm run setup" first if you have no .env yet).\n`);
  process.exit(1);
}
