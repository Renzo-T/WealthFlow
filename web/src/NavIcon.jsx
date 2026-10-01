// Small line icons for the sidebar. 24×24 grid, drawn in the text colour so they follow the active state.
const P = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  transactions: <><path d="M4 7h13l-3-3" /><path d="M20 17H7l3 3" /></>,
  budget: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.4 6.4" /></>,
  bills: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M9 15l2 2 4-4" /></>,
  flow: <><path d="M3 6h5c4 0 4 12 8 12h5" /><path d="M3 18h5c2 0 3-3 4-6" /><path d="M14 6h7" /></>,
  networth: <><path d="M3 20h18" /><path d="M5 20V10l7-6 7 6v10" /><path d="M10 20v-5h4v5" /></>,
  investments: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  forecast: <><path d="M3 20h18" /><path d="M4 16l4-4 3 2" /><path d="M11 14l4-4 5-2" strokeDasharray="2 2.6" /></>, // solid past, dashed projection
  trips: <path d="M10.5 13L4 11l1-2 7 .5 4-5a1.5 1.5 0 012.5 1.5l-3 5.5 1 7-2 1-2.5-6-2.5 2.5v2.5l-1.5 1-1-3.5-3.5-1 1-1.5h2.5L10.5 13z" />,
  reports: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" /></>,
  goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
};

export default function NavIcon({ id }) {
  if (!P[id]) return null;
  return (
    <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[id]}</svg>
  );
}
