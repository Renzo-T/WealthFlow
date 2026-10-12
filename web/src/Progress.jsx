// `warn` turns the bar amber at 80% and red when over (for budgets).
export default function Progress({ value, max, warn = false }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  const color = warn ? (p > 100 ? 'var(--red)' : p >= 80 ? 'var(--amber)' : 'var(--accent)') : 'var(--accent)';
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin="0" aria-valuemax="100">
      <i style={{ width: `${Math.min(p, 100)}%`, background: color }} />
    </div>
  );
}
