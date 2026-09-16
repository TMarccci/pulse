import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Check, X, ExternalLink } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../api.js';
import { Spinner, Chip, Empty } from '../components/ui.jsx';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { relativeTime, fmtClock } from '../lib/format.js';

export default function Devices() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data, loading, reload } = useFetch(
    `/devices?includeArchived=${includeArchived ? 1 : 0}`, [includeArchived], 20000);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  const devices = data?.devices || [];

  async function saveNickname(id) {
    await api(`/devices/${id}`, { method: 'PATCH', body: { nickname: draft } });
    setEditing(null);
    reload();
  }
  async function setArchived(id, archived) {
    await api(`/devices/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Devices</h1>
          <p className="text-sm text-[var(--color-muted)]">{devices.length} shown</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)] cursor-pointer">
            <input type="checkbox" checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
          <ExportMenu kind="devices" label="Export devices" />
        </div>
      </div>

      {loading && !data ? <Spinner /> : devices.length === 0 ? (
        <div className="card"><Empty>No devices enrolled yet. Install a Pulse Agent to get started.</Empty></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Name / Nickname</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/40 ${d.archived ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3"><Chip color={d.status.color}>{d.status.label}</Chip></td>
                  <td className="px-4 py-3">
                    {editing === d.id ? (
                      <div className="flex items-center gap-1">
                        <input className="input py-1" value={draft} autoFocus
                          placeholder={d.deviceName}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveNickname(d.id)} />
                        <button className="btn py-1 px-2" onClick={() => saveNickname(d.id)}><Check size={15} /></button>
                        <button className="btn py-1 px-2" onClick={() => setEditing(null)}><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{d.displayName}</div>
                          {d.nickname && <div className="text-xs text-[var(--color-muted)]">{d.deviceName}</div>}
                        </div>
                        <button className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                          onClick={() => { setEditing(d.id); setDraft(d.nickname || ''); }}>
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {d.hostname || '—'}<div className="text-xs">{d.os}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{d.agentVersion || '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]" title={fmtClock(d.lastSeenAt)}>
                    {relativeTime(d.lastSeenAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link className="btn py-1 px-2" to={`/devices/${d.id}`}><ExternalLink size={14} /> Details</Link>
                      {d.archived ? (
                        <button className="btn py-1 px-2" onClick={() => setArchived(d.id, false)}>
                          <ArchiveRestore size={14} /> Restore
                        </button>
                      ) : (
                        <button className="btn py-1 px-2" onClick={() => setArchived(d.id, true)}>
                          <Archive size={14} /> Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
