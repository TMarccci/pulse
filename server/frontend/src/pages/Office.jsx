import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ExternalLink, X } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../api.js';
import { OfficeNode, MonitorIcon } from '../components/MonitorIcon.jsx';
import { Spinner } from '../components/ui.jsx';
import { relativeTime, fmtClock } from '../lib/format.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function Office() {
  const [refreshMs, setRefreshMs] = useState(15000);
  const { data, loading } = useFetch('/devices', [refreshMs], refreshMs);
  const settings = useFetch('/settings', []);
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const dragging = useRef(false);
  const canvasRef = useRef(null);

  // Sync incoming device data into local nodes, filling default positions,
  // but never clobber positions mid-drag.
  useEffect(() => {
    if (!data || dragging.current) return;
    setNodes(data.devices.map((d, i) => ({
      ...d,
      canvasX: d.canvasX ?? 40 + (i % 6) * 120,
      canvasY: d.canvasY ?? 60 + Math.floor(i / 6) * 120,
    })));
  }, [data]);

  function onPointerDown(e, id) {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find((n) => n.id === id);
    const offX = e.clientX - (rect.left + node.canvasX);
    const offY = e.clientY - (rect.top + node.canvasY);
    let curX = node.canvasX; let curY = node.canvasY;
    setSelected(id);
    dragging.current = true;

    const move = (ev) => {
      curX = clamp(ev.clientX - rect.left - offX, 20, rect.width - 20);
      curY = clamp(ev.clientY - rect.top - offY, 20, rect.height - 20);
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, canvasX: curX, canvasY: curY } : n)));
    };
    const up = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      try {
        await api(`/devices/${id}`, {
          method: 'PATCH', body: { canvasX: Math.round(curX), canvasY: Math.round(curY) },
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const rules = settings.data?.settings?.colorRules || [];
  const offlineColor = settings.data?.settings?.offlineColor || '#9ca3af';
  const sel = nodes.find((n) => n.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Office</h1>
          <p className="text-sm text-[var(--color-muted)]">Drag monitors to arrange your floor plan</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <RefreshCw size={15} /> refresh
            <select className="input py-1 w-auto" value={refreshMs}
              onChange={(e) => setRefreshMs(Number(e.target.value))}>
              <option value={5000}>5s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-3 flex items-center gap-4 flex-wrap text-xs">
        <span className="text-[var(--color-muted)] font-medium">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: offlineColor }} /> Offline
        </span>
        {[...rules].sort((a, b) => (a.idleForMinutes || 0) - (b.idleForMinutes || 0)).map((r, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: r.color }} /> {r.label}
          </span>
        ))}
      </div>

      {loading && !data ? <Spinner /> : (
        <div className="relative">
          <div
            ref={canvasRef}
            className="card relative overflow-hidden"
            style={{
              height: '65vh',
              backgroundImage:
                'radial-gradient(circle, #263153 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
            onPointerDown={(e) => { if (e.target === canvasRef.current) setSelected(null); }}
          >
            {nodes.map((d) => (
              <OfficeNode key={d.id} device={d} selected={selected === d.id}
                onPointerDown={(e) => onPointerDown(e, d.id)} />
            ))}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)] text-sm">
                No devices to place yet.
              </div>
            )}
          </div>

          {/* Selected device info card */}
          {sel && (
            <div className="absolute top-3 right-3 card p-3 w-64 shadow-xl z-30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MonitorIcon color={sel.status.color} size={30} />
                  <div>
                    <div className="font-semibold text-sm">{sel.displayName}</div>
                    <div className="text-xs" style={{ color: sel.status.color }}>{sel.status.label}</div>
                  </div>
                </div>
                <button className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  onClick={() => setSelected(null)}><X size={16} /></button>
              </div>
              <div className="mt-2 text-xs text-[var(--color-muted)] space-y-1">
                <div>Last update: {relativeTime(sel.lastSeenAt)}</div>
                <div title={fmtClock(sel.lastSeenAt)}>{sel.hostname || '—'}</div>
                {sel.lastWindow && <div className="truncate">▸ {sel.lastWindow.app}</div>}
              </div>
              <Link to={`/devices/${sel.id}`} className="btn w-full justify-center mt-3 py-1.5">
                <ExternalLink size={14} /> Open details
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
