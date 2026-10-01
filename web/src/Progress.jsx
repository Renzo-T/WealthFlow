// `warn` turns the bar amber at 80% and red when over (for budgets).
export default function Progress({ value, max, warn = false }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  const color = warn ? (p > 100 ? '#e5484d' : p >= 80 ? '#f59e42' : '#2f6bed') : '#2f6bed';
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin="0" aria-valuemax="100">
      <i style={{ width: `${Math.min(p, 100)}%`, background: color }} />
    </div>
  );
}
