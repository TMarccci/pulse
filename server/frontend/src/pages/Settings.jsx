import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, KeyRound, Copy, Ban, Check, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../lib/useFetch.js';
import { Spinner } from '../components/ui.jsx';
import { fmtClock } from '../lib/format.js';

function Section({ title, desc, children, right }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {desc && <p className="text-sm text-[var(--color-muted)] mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { data, loading } = useFetch('/settings', []);
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data?.settings) setS(structuredClone(data.settings)); }, [data]);

  if (loading || !s) return <Spinner />;
  const meta = data?.meta || {};

  const update = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const updateSync = (patch) => setS((prev) => ({ ...prev, sync: { ...prev.sync, ...patch } }));
  const updateWork = (patch) => setS((prev) => ({ ...prev, workHours: { ...prev.workHours, ...patch } }));
  const toggleDay = (d) => setS((prev) => {
    const days = prev.workHours.days.includes(d)
      ? prev.workHours.days.filter((x) => x !== d)
      : [...prev.workHours.days, d].sort((a, b) => a - b);
    return { ...prev, workHours: { ...prev.workHours, days } };
  });
  const updateRule = (i, patch) => setS((prev) => {
    const colorRules = prev.colorRules.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    return { ...prev, colorRules };
  });
  const addRule = () => setS((prev) => ({
    ...prev, colorRules: [...prev.colorRules, { color: '#a855f7', label: 'New rule', idleForMinutes: 10 }],
  }));
  const removeRule = (i) => setS((prev) => ({
    ...prev, colorRules: prev.colorRules.filter((_, idx) => idx !== i),
  }));

  async function save() {
    setBusy(true); setSaved(false);
    try {
      const body = { ...s };
      delete body.rev;
      await api('/settings', { method: 'PUT', body });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-[var(--color-muted)]">Monitoring rules pushed to every agent</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save changes</>}
        </button>
      </div>

      <Section title="Activity definition"
        desc="How agents classify active vs. idle time.">
        <label className="label">Idle threshold (seconds)</label>
        <input type="number" min={5} max={3600} className="input w-40"
          value={s.idleThresholdSeconds}
          onChange={(e) => update({ idleThresholdSeconds: Number(e.target.value) })} />
        <p className="text-xs text-[var(--color-muted)] mt-2">
          A second counts as <b>idle</b> after this many seconds without mouse or keyboard activity.
        </p>
      </Section>

      <Section title="Work hours"
        desc="Focus analytics and exports on working time; activity outside these hours is filtered out.">
        <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
          <input type="checkbox" checked={s.workHours.enabled}
            onChange={(e) => updateWork({ enabled: e.target.checked })} />
          Enable the work-hours filter
        </label>
        <div className={s.workHours.enabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="label">Start</label>
              <input type="time" className="input w-32" value={s.workHours.start}
                onChange={(e) => updateWork({ start: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="time" className="input w-32" value={s.workHours.end}
                onChange={(e) => updateWork({ end: e.target.value })} />
            </div>
          </div>
          <label className="label mt-4">Work days</label>
          <div className="flex gap-2 flex-wrap">
            {[['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]].map(([name, d]) => (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`btn py-1.5 px-3 ${s.workHours.days.includes(d) ? 'btn-primary' : ''}`}>
                {name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-3">
            Evaluated in the server's local timezone. Turn on “Work hours” on the Dashboard or a
            device to apply the filter.
          </p>
        </div>
      </Section>

      <Section title="Sync mode" desc="How and when agents deliver data to the server.">
        <div className="flex gap-3 mb-4">
          {['live', 'timed'].map((mode) => (
            <button key={mode}
              onClick={() => updateSync({ mode })}
              className={`btn ${s.sync.mode === mode ? 'btn-primary' : ''}`}>
              {mode === 'live' ? 'Live sync' : 'Timed sync'}
            </button>
          ))}
        </div>
        {s.sync.mode === 'live' ? (
          <div>
            <label className="label">Poll interval (seconds)</label>
            <input type="number" min={10} className="input w-40" value={s.sync.livePollSeconds}
              onChange={(e) => updateSync({ livePollSeconds: Number(e.target.value) })} />
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Agents flush buffered data and send a heartbeat every {s.sync.livePollSeconds}s.
            </p>
          </div>
        ) : (
          <div>
            <label className="label">Daily sync time (agent local time)</label>
            <input type="time" className="input w-40" value={s.sync.timedAt}
              onChange={(e) => updateSync({ timedAt: e.target.value })} />
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Agents buffer all day and upload once at {s.sync.timedAt}.
            </p>
          </div>
        )}
      </Section>

      <Section title="Office colour rules"
        desc="Evaluated by idle duration; a device matches the highest threshold it meets."
        right={<button className="btn" onClick={addRule}><Plus size={16} /> Add rule</button>}>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent"
              value={s.offlineColor} onChange={(e) => update({ offlineColor: e.target.value })} />
            <div className="text-sm w-40">Offline</div>
            <div className="text-xs text-[var(--color-muted)]">shown when a device stops reporting</div>
          </div>
          {s.colorRules.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent"
                value={r.color} onChange={(e) => updateRule(i, { color: e.target.value })} />
              <input className="input w-40" value={r.label}
                onChange={(e) => updateRule(i, { label: e.target.value })} />
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                idle ≥
                <input type="number" min={0} className="input w-20"
                  value={r.idleForMinutes}
                  onChange={(e) => updateRule(i, { idleForMinutes: Number(e.target.value) })} />
                min
              </div>
              <button className="btn btn-danger py-1.5 px-2 ml-auto" onClick={() => removeRule(i)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Agent updates"
        desc="Agents at or below this version are told to update from GitHub Releases.">
        <label className="label">Minimum agent version</label>
        <input className="input w-40" value={s.minAgentVersion}
          onChange={(e) => update({ minAgentVersion: e.target.value })} placeholder="0.0.0" />
        <p className="text-xs text-[var(--color-muted)] mt-2">
          Update source: {meta.agentUpdateRepo
            ? <code>{meta.agentUpdateRepo}</code>
            : <span>not configured (set <code>PULSE_AGENT_REPO</code>)</span>}.
          Devices count as offline after {meta.onlineWindowSeconds}s of silence.
        </p>
      </Section>

      <EnrollmentKeys />
      <ServerUpdates />
    </div>
  );
}

function ServerUpdates() {
  const { data, loading, reload } = useFetch('/updates', []);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function check() {
    setBusy('check'); setMsg('');
    try { await api('/updates/check', { method: 'POST' }); reload(); }
    finally { setBusy(''); }
  }
  async function apply() {
    setBusy('apply'); setMsg('Downloading and applying update… the server will restart shortly.');
    try { await api('/updates/apply', { method: 'POST' }); }
    catch (e) { if (e.status !== 401) setMsg(`Update failed: ${e.data?.message || e.message}`); }
    finally { setBusy(''); }
  }

  if (loading || !data) return null;

  return (
    <Section title="Server updates"
      desc={`This Pulse Server checks ${data.repo} for new server-v* releases.`}
      right={<button className="btn" onClick={check} disabled={busy === 'check'}>
        <RefreshCw size={16} /> {busy === 'check' ? 'Checking…' : 'Check now'}
      </button>}>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <div className="text-[var(--color-muted)] text-xs">Current</div>
          <div className="font-medium">{data.current}</div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] text-xs">Latest</div>
          <div className="font-medium">{data.latest || '—'}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data.updateAvailable ? (
            data.canApply ? (
              <button className="btn btn-primary" onClick={apply} disabled={busy === 'apply'}>
                <ArrowUpCircle size={16} /> {busy === 'apply' ? 'Updating…' : `Update to ${data.latest}`}
              </button>
            ) : (
              <span className="chip" style={{ background: '#78350f', color: '#fde68a' }}>
                Update via Docker image
              </span>
            )
          ) : (
            <span className="chip" style={{ background: '#064e3b', color: '#6ee7b7' }}>Up to date</span>
          )}
        </div>
      </div>
      {data.inDocker && (
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Running in Docker — self-update is disabled; pull the new image to upgrade.
        </p>
      )}
      {data.error && <p className="text-xs text-red-400 mt-2">Last check error: {data.error}</p>}
      {msg && <p className="text-xs text-[var(--color-muted)] mt-2">{msg}</p>}
    </Section>
  );
}

function EnrollmentKeys() {
  const { data, loading, reload } = useFetch('/settings/keys', []);
  const [label, setLabel] = useState('');
  const [copied, setCopied] = useState(null);

  async function create() {
    await api('/settings/keys', { method: 'POST', body: { label } });
    setLabel('');
    reload();
  }
  async function revoke(id) {
    if (!confirm('Revoke this enrollment key? New devices can no longer enroll with it.')) return;
    await api(`/settings/keys/${id}/revoke`, { method: 'POST' });
    reload();
  }
  function copy(key) {
    navigator.clipboard?.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const keys = data?.keys || [];
  return (
    <Section title="Enrollment keys"
      desc="Agents present one of these keys during setup to enroll."
      right={
        <div className="flex items-center gap-2">
          <input className="input w-40" placeholder="Label (optional)"
            value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn btn-primary" onClick={create}><Plus size={16} /> New key</button>
        </div>
      }>
      {loading ? <Spinner /> : keys.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No keys yet. Create one to enroll your first device.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-3 p-2 rounded-lg bg-[var(--color-surface-2)] ${k.revoked ? 'opacity-50' : ''}`}>
              <KeyRound size={16} className="text-[var(--color-brand)]" />
              <code className="text-sm">{k.key}</code>
              {k.label && <span className="text-xs text-[var(--color-muted)]">({k.label})</span>}
              <span className="text-xs text-[var(--color-muted)] ml-auto">{fmtClock(k.created_at)}</span>
              {k.revoked ? <span className="chip" style={{ background: '#7f1d1d', color: '#fecaca' }}>revoked</span> : (
                <>
                  <button className="btn py-1 px-2" onClick={() => copy(k.key)}>
                    {copied === k.key ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button className="btn btn-danger py-1 px-2" onClick={() => revoke(k.id)}><Ban size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
