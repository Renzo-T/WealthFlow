// Round icon for a budget group or subcategory. The icon and the text label beside it carry identity; the tint
// is a secondary cue from the shared palette (format.js), so it never has to tell categories apart on its own.
import { SERIES, NEUTRAL, INCOME } from './format.js';

const I = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  cart: <><path d="M3 4h2l2.4 11h10.2L20 8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  fork: <><path d="M7 3v8a2 2 0 002 2v8M11 3v6M7 7h4" /><path d="M16 3c-1.5 1-2 3-2 6s1 4 2 4v8" /></>,
  cup: <><path d="M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5V9z" /><path d="M16 11h1.5a2.5 2.5 0 010 5H16" /><path d="M8 3v3M12 3v3" /></>,
  car: <><path d="M5 16l1.5-5a2 2 0 012-1.5h7a2 2 0 012 1.5L19 16" /><rect x="3" y="15" width="18" height="4" rx="1.5" /><circle cx="7.5" cy="19.5" r="1" /><circle cx="16.5" cy="19.5" r="1" /></>,
  fuel: <><rect x="4" y="4" width="10" height="16" rx="1.5" /><path d="M4 10h10M14 8l4 3v6a1.5 1.5 0 003 0V9l-3-3" /></>,
  shield: <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" />,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  bag: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  plane: <path d="M10.5 13L4 11l1-2 7 .5 4-5a1.5 1.5 0 012.5 1.5l-3 5.5 1 7-2 1-2.5-6-2.5 2.5v2.5l-1.5 1-1-3.5-3.5-1 1-1.5h2.5L10.5 13z" />,
  play: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3V9z" /></>,
  dumbbell: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></>,
  paw: <><circle cx="7" cy="10" r="1.6" /><circle cx="11" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="18" cy="10.5" r="1.6" /><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 1.5-1.5 2-4 2s-4-.5-4-2z" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  dots: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  piggy: <><path d="M4 12a7 6 0 0113-3h2v3l2 1v3h-2.5a7 6 0 01-2.5 2v2h-3v-1.5a8 8 0 01-3 0V20H7v-2.5A6 6 0 014 12z" /><circle cx="15" cy="11" r=".8" /></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  arrowin: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
  swap: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  receipt: <><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" /><path d="M9 8h6M9 12h6" /></>,
};

const GROUP = {
  Housing: ['home', SERIES[0]], Utilities: ['bolt', SERIES[2]], Food: ['cart', SERIES[1]], Transportation: ['car', SERIES[2]],
  Insurance: ['shield', SERIES[0]], Healthcare: ['heart', SERIES[3]], 'Personal & fun': ['bag', SERIES[3]], Travel: ['plane', SERIES[0]],
  Misc: ['dots', NEUTRAL], 'Savings & investments': ['piggy', INCOME], 'Debt repayment': ['card', NEUTRAL], Income: ['arrowin', INCOME],
  Transfer: ['swap', NEUTRAL],
};
const SUB = { Restaurants: 'fork', Coffee: 'cup', 'Alcohol & bars': 'cup', Gas: 'fuel', Entertainment: 'play', Fitness: 'dumbbell', Pets: 'paw', 'Phone & internet': 'phone' };

export default function CategoryIcon({ group, sub, kind, size = 30 }) {
  const [icon0, color] = GROUP[group] ?? ['receipt', NEUTRAL];
  const icon = kind ?? SUB[sub] ?? icon0;
  return (
    <span className="caticon" style={{ width: size, height: size, color, background: `${color}1f` }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{I[icon]}</svg>
    </span>
  );
}
