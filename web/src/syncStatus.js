// How long ago something happened, in words ("14 min ago"). `now` is injectable for tests.
export const ago = (iso, now = Date.now()) => {
  const m = Math.round((now - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
// The line at the rail's foot: while a sync runs, then when the last one finished ("Synced just now" reads fine too).
export const syncLine = (lastSync, busy, now = Date.now()) => busy ? 'Checking for new data…' : lastSync ? `Synced ${ago(lastSync, now)}` : 'Not synced yet';
