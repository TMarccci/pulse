// Small shared presentational components.

export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 text-[var(--color-muted)] text-sm py-8 justify-center">
      <span className="inline-block w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-brand)] rounded-full animate-spin" />
      {label || 'Loading…'}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      {Icon && (
        <div className="rounded-lg p-2" style={{ background: (accent || '#6366f1') + '22', color: accent || '#6366f1' }}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[var(--color-muted)] text-xs font-medium">{label}</div>
        <div className="text-2xl font-semibold mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export function RangePicker({ value, onChange, options }) {
  const opts = options || [
    ['1h', '1h'], ['24h', '24h'], ['7d', '7d'], ['30d', '30d'],
  ];
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-[var(--color-border)]">
      {opts.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-sm ${value === v ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ color, children }) {
  return (
    <span className="chip" style={{ background: color + '22', color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export function Empty({ children }) {
  return <div className="text-center text-[var(--color-muted)] text-sm py-10">{children}</div>;
}
