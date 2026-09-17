export function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtNumber(n) {
  return new Intl.NumberFormat().format(Math.round(n || 0));
}

export function relativeTime(unixSeconds) {
  if (!unixSeconds) return 'never';
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fmtClock(unixSeconds) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString();
}

// Label an x-axis bucket depending on the selected range.
export function bucketLabel(unixSeconds, range) {
  const d = new Date(unixSeconds * 1000);
  if (range === '30d' || range === '7d') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Label an x-axis bucket from the actual bucket size (seconds).
export function labelForBucket(unixSeconds, bucketSeconds) {
  const d = new Date(unixSeconds * 1000);
  if (bucketSeconds >= 86400) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
