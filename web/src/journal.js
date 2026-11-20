// The journal you picked (Settings › Journal) and whether its decoration shows, remembered in this browser like the
// theme. startJournal() runs in main.jsx before the first render, so the page never flashes another journal.
import { JOURNALS, DEFAULT_JOURNAL, journalCss } from './journals.js';

const KEY = 'wealthflow.journal', DECO_KEY = 'wealthflow.decoration';
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export const currentJournal = () => (JOURNALS[read(KEY)] ? read(KEY) : DEFAULT_JOURNAL);
export const decorationOn = () => read(DECO_KEY) !== 'off';

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};
// The window's title bar follows the cover.
export function syncThemeColor() {
  const j = JOURNALS[currentJournal()];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', (isDark() ? j.dark : j.light).rail);
}

function apply(id) {
  document.documentElement.dataset.journal = id;
  syncThemeColor();
}

export function setJournal(id) {
  if (!JOURNALS[id]) return;
  write(KEY, id === DEFAULT_JOURNAL ? null : id);
  apply(id);
}

export function setDecoration(on) {
  write(DECO_KEY, on ? null : 'off');
  if (on) delete document.documentElement.dataset.decoration; else document.documentElement.dataset.decoration = 'off';
}

export function startJournal() {
  const style = document.createElement('style');
  style.id = 'journals';
  style.textContent = journalCss();
  document.head.appendChild(style);
  // ?journal=plum shows that journal without remembering it (screenshots and the page check).
  const preview = new URLSearchParams(location.search).get('journal');
  apply(JOURNALS[preview] ? preview : currentJournal());
  setDecoration(decorationOn());
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeColor);
}
