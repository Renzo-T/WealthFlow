import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { config } from './config.js';

// The Plaid client, built from the current settings. It's rebuilt when the keys change (first-run setup or
// Settings), so the rest of the app just imports it and calls methods as usual.
export const plaidClient = (c = config()) => new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[c.PLAID_ENV || 'sandbox'],
  baseOptions: { headers: { 'PLAID-CLIENT-ID': c.PLAID_CLIENT_ID, 'PLAID-SECRET': c.PLAID_SECRET } },
}));
let client = null;
export const resetPlaid = () => { client = null; };
export default new Proxy({}, { get: (_t, name) => { client ??= plaidClient(); const v = client[name]; return typeof v === 'function' ? v.bind(client) : v; } });
