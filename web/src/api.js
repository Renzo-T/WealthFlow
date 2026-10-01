export const api = (path, opts) =>
  fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts }).then((r) => r.json());
