// Small line icons for the sidebar. 24×24 grid, drawn in the text colour so they follow the active state.
const P = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  transactions: <><path d="M4 7h13l-3-3" /><path d="M20 17H7l3 3" /></>,
  budget: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.4 6.4" /></>,
  bills: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M9 15l2 2 4-4" /></>,
  flow: <><path d="M3 6h5c4 0 4 12 8 12h5" /><path d="M3 18h5c2 0 3-3 4-6" /><path d="M14 6h7" /></>,
  networth: <><path d="M3 20h18" /><path d="M5 20V10l7-6 7 6v10" /><path d="M10 20v-5h4v5" /></>,
  investments: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  trips: <path d="M10.5 13L4 11l1-2 7 .5 4-5a1.5 1.5 0 012.5 1.5l-3 5.5 1 7-2 1-2.5-6-2.5 2.5v2.5l-1.5 1-1-3.5-3.5-1 1-1.5h2.5L10.5 13z" />,
  reports: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" /></>,
  plan: <><path d="M3 20h18" /><path d="M4 16l4-4 3 2" /><path d="M11 14l3.5-3.5" strokeDasharray="2 2.6" /><circle cx="17.5" cy="7.5" r="3.5" /><circle cx="17.5" cy="7.5" r=".9" fill="currentColor" /></>, // solid past, dashed projection, a target at the end
  settings: <><path d="M10.22 4.82L10.59 2.1h2.82l.37 2.72 2.04.84L18 4l2 2-1.66 2.18.84 2.04 2.72.37v2.82l-2.72.37-.84 2.04L20 18l-2 2-2.18-1.66-2.04.84-.37 2.72h-2.82l-.37-2.72-2.04-.84L6 20l-2-2 1.66-2.18-.84-2.04-2.72-.37v-2.82l2.72-.37.84-2.04L4 6l2-2 2.18 1.66z" /><circle cx="12" cy="12" r="3" /></>, // a cog: eight teeth round a hole
  // The rail foot's tools, for Ctrl+K's commands (the same drawings as the rail's own buttons in App.jsx)
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
};

export default function NavIcon({ id }) {
  if (!P[id]) return null;
  return (
    <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[id]}</svg>
  );
}
