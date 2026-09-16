import { relativeTime } from '../lib/format.js';

// A monitor glyph whose screen is filled with the device's status colour.
// Used on the Office canvas. `compact` hides the labels (legend usage).
export function MonitorIcon({ color, size = 44 }) {
  const w = size;
  const h = size * 0.82;
  return (
    <svg width={w} height={h + 10} viewBox="0 0 44 46" fill="none" aria-hidden>
      <rect x="2" y="2" width="40" height="28" rx="3" fill={color} stroke="#0b1020" strokeWidth="2" />
      <rect x="6" y="6" width="32" height="20" rx="1.5" fill="#0b1020" opacity="0.28" />
      <rect x="17" y="31" width="10" height="6" fill={color} />
      <rect x="11" y="37" width="22" height="4" rx="2" fill={color} />
    </svg>
  );
}

export function OfficeNode({ device, selected, onPointerDown }) {
  const s = device.status;
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing select-none
        ${selected ? 'z-20' : 'z-10'}`}
      style={{ left: device.canvasX ?? 60, top: device.canvasY ?? 60 }}
      title={`${device.displayName} — ${s.label}`}
    >
      <div className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition
        ${selected ? 'ring-2 ring-[var(--color-brand)] bg-[var(--color-surface-2)]' : ''}`}>
        <MonitorIcon color={s.color} />
        <div className="text-[11px] font-semibold leading-tight text-center max-w-[90px] truncate">
          {device.displayName}
        </div>
        <div className="text-[10px] text-[var(--color-muted)] leading-tight">
          {device.lastSeenAt ? relativeTime(device.lastSeenAt) : 'no data'}
        </div>
      </div>
    </div>
  );
}
