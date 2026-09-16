import { useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../api.js';

// Slim banner shown when a newer Pulse Server release is available.
export function UpdateBanner() {
  const { data } = useFetch('/updates', [], 6 * 3600 * 1000);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState('');

  if (!data?.updateAvailable || dismissed) return null;

  async function apply() {
    setApplying(true);
    setMsg('Downloading and applying update… the server will restart.');
    try {
      await api('/updates/apply', { method: 'POST' });
    } catch (e) {
      if (e.status !== 401) setMsg(`Update failed: ${e.data?.message || e.message}`);
    }
  }

  return (
    <div className="bg-[var(--color-brand)]/15 border-b border-[var(--color-brand)]/40 px-6 py-2.5 flex items-center gap-3 text-sm">
      <ArrowUpCircle size={18} className="text-[var(--color-brand-2)]" />
      <span>
        Pulse Server <b>{data.latest}</b> is available (you have {data.current}).
      </span>
      {msg && <span className="text-[var(--color-muted)]">{msg}</span>}
      <div className="ml-auto flex items-center gap-2">
        {data.releaseUrl && (
          <a className="btn py-1 px-2" href={data.releaseUrl} target="_blank" rel="noreferrer">Release notes</a>
        )}
        {data.canApply ? (
          <button className="btn btn-primary py-1 px-3" onClick={apply} disabled={applying}>
            {applying ? 'Updating…' : 'Update now'}
          </button>
        ) : (
          <span className="text-xs text-[var(--color-muted)]">Update the Docker image to upgrade</span>
        )}
        <button className="text-[var(--color-muted)] hover:text-[var(--color-text)]" onClick={() => setDismissed(true)}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
