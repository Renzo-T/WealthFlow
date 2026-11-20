// Requests still running, so a page can wait for all of its data before it shows (App.jsx, whenSettled).
let inflight = 0;

const get = (path, opts) => fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts }).then((r) => r.json());
export const api = (path, opts) => {
  inflight += 1;
  return get(path, opts).finally(() => { inflight -= 1; });
};
// The same, for a refresh of something already on screen: the page shows what it has meanwhile, so nothing waits on it.
export const apiRefresh = get;

// Resolves once no request has run for two frames in a row, or after `max` ms, whichever comes first. Two frames, because
// a page's sections start their own requests only after its first data arrives and they render.
export function whenSettled(max = 700) {
  let raf = 0, timer = 0, cancelled = false;
  const promise = new Promise((resolve) => {
    const done = () => { cancelAnimationFrame(raf); clearTimeout(timer); if (!cancelled) resolve(); };
    timer = setTimeout(done, max);
    const check = (quiet) => { raf = requestAnimationFrame(() => (inflight ? check(0) : quiet >= 1 ? done() : check(quiet + 1))); };
    check(0);
  });
  promise.cancel = () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(timer); };
  return promise;
}
