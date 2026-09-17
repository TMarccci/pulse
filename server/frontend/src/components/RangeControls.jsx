// Range selector supporting presets, a single day, or a custom date interval.
// `value` is a selection object: { kind, day?, from?, to? }.

const PRESETS = [['1h', '1h'], ['24h', '24h'], ['7d', '7d'], ['30d', '30d']];

function localMidnight(dateStr) {
  return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000);
}

// Convert a selection to API query params ({range} or {from,to} unix seconds).
export function selToParams(sel) {
  const s = sel || { kind: '24h' };
  if (s.kind === 'day' && s.day) {
    const from = localMidnight(s.day);
    return { from, to: from + 86400 };
  }
  if (s.kind === 'custom' && s.from && s.to) {
    return { from: localMidnight(s.from), to: localMidnight(s.to) + 86400 };
  }
  return { range: ['1h', '24h', '7d', '30d'].includes(s.kind) ? s.kind : '24h' };
}

export function selToQuery(sel) {
  return Object.entries(selToParams(sel)).map(([k, v]) => `${k}=${v}`).join('&');
}

export function RangeControls({ value, onChange }) {
  const sel = value || { kind: '24h' };
  const set = (patch) => onChange({ ...sel, ...patch });
  const today = new Date().toISOString().slice(0, 10);
  const btn = (active) =>
    `px-3 py-1.5 text-sm ${active
      ? 'bg-[var(--color-brand)] text-white'
      : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg overflow-hidden border border-[var(--color-border)]">
        {PRESETS.map(([v, l]) => (
          <button key={v} onClick={() => onChange({ kind: v })} className={btn(sel.kind === v)}>{l}</button>
        ))}
        <button onClick={() => onChange({ kind: 'day', day: sel.day || today })}
          className={btn(sel.kind === 'day')}>Day</button>
        <button onClick={() => onChange({ kind: 'custom', from: sel.from || today, to: sel.to || today })}
          className={btn(sel.kind === 'custom')}>Custom</button>
      </div>

      {sel.kind === 'day' && (
        <input type="date" className="input py-1 w-auto" value={sel.day || today} max={today}
          onChange={(e) => set({ day: e.target.value })} />
      )}
      {sel.kind === 'custom' && (
        <div className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
          <input type="date" className="input py-1 w-auto" value={sel.from || today} max={today}
            onChange={(e) => set({ from: e.target.value })} />
          <span>→</span>
          <input type="date" className="input py-1 w-auto" value={sel.to || today} max={today}
            onChange={(e) => set({ to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
