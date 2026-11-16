import { usd } from './format.js';

// What's left, or how far past the target. A goal reached exactly has nothing to add: the "Reached" stamp says it.
export const statusText = (g) => (g.saved < g.target ? `${usd(g.target - g.saved)} to go` : g.saved > g.target ? `${usd(g.saved - g.target)} past the target` : '');
