import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, Keyboard, MousePointerClick, MousePointer2, Clock, Trash2, AppWindow, X,
} from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../api.js';
import { StatCard, Spinner, Chip, Empty } from '../components/ui.jsx';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { WorkHoursToggle } from '../components/WorkHoursToggle.jsx';
import { RangeControls, selToQuery, selToParams } from '../components/RangeControls.jsx';
import { TimelineChart } from '../components/TimelineChart.jsx';
import { useWorkHours } from '../lib/useWorkHours.js';
import { fmtNumber, fmtDuration, fmtClock, relativeTime, labelForBucket } from '../lib/format.js';

const chartAxis = { stroke: '#8792ad', fontSize: 12 };
const tooltipStyle = { background: '#131a2e', border: '1px solid #263153', borderRadius: 8, fontSize: 12, color: '#e7ecf7' };

export default function DeviceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sel, setSel] = useState({ kind: '24h' });
  const [workHoursOnly, setWorkHoursOnly] = useWorkHours();
  const [selectedApp, setSelectedApp] = useState(null);
  const q = selToQuery(sel);
  const whParam = workHoursOnly ? '&workHours=1' : '';

  const info = useFetch(`/devices/${id}`, [id], 20000);
  const analytics = useFetch(`/analytics/device/${id}?${q}${whParam}`, [id, q, workHoursOnly], 30000);
  const appEnc = selectedApp ? encodeURIComponent(selectedApp) : '';
  const appTitles = useFetch(
    selectedApp ? `/analytics/device/${id}/app-titles?app=${appEnc}&${q}${whParam}` : '',
    [id, q, workHoursOnly, selectedApp]);
  const windowsTl = useFetch(`/analytics/device/${id}/windows-timeline?${q}${whParam}`, [id, q, workHoursOnly]);

  const d = info.data?.device;
  const totals = analytics.data?.totals;
  const bucket = analytics.data?.bucket || 3600;
  const series = (analytics.data?.series || []).map((s) => ({
    ...s, label: labelForBucket(s.bucket, bucket),
    mouseActiveMin: Math.round(s.mouseActiveSec / 60), mouseIdleMin: Math.round(s.mouseIdleSec / 60),
  }));
  const topApps = (analytics.data?.topApps || []).map((a) => ({ ...a, minutes: Math.round(a.seconds / 60) }));
  const exportParams = { deviceId: id, ...selToParams(sel), ...(analytics.data?.workHoursApplied ? { workHours: 1 } : {}) };

  async function remove() {
    if (!confirm('Permanently delete this device and all its collected data? This cannot be undone.')) return;
    await api(`/devices/${id}`, { method: 'DELETE' });
    nav('/devices');
  }

  if (info.loading && !d) return <Spinner />;
  if (!d) return <Empty>Device not found. <Link className="underline" to="/devices">Back to devices</Link></Empty>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/devices" className="btn py-1.5 px-2"><ArrowLeft size={16} /></Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{d.displayName}</h1>
              <Chip color={d.status.color}>{d.status.label}</Chip>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              {d.deviceName} · {d.hostname || '—'} · {d.os || '—'} · agent {d.agentVersion || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <WorkHoursToggle value={workHoursOnly} onChange={setWorkHoursOnly} workHours={analytics.data?.workHours} />
        <RangeControls value={sel} onChange={setSel} />
        <ExportMenu kind="samples" params={exportParams} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Keyboard} label="Keypresses" accent="#818cf8" value={fmtNumber(totals?.keypresses)} />
        <StatCard icon={MousePointerClick} label="Mouse clicks" accent="#f472b6" value={fmtNumber(totals?.mouseClicks)} />
        <StatCard icon={MousePointer2} label="Active time" accent="#22c55e" value={fmtDuration(totals?.mouseActiveSec)} />
        <StatCard icon={Clock} label="Idle time" accent="#eab308" value={fmtDuration(totals?.mouseIdleSec)} />
        <StatCard icon={AppWindow} label="Last seen" accent="#6366f1"
          value={relativeTime(d.lastSeenAt)} sub={fmtClock(d.lastSeenAt)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Keyboard &amp; mouse activity</div>
          {series.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="dKeys" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} /><stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity={0.4} /><stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263153" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...chartAxis} tickLine={false} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="keypresses" name="Keypresses" stroke="#818cf8" fill="url(#dKeys)" strokeWidth={2} />
                <Area type="monotone" dataKey="mouseClicks" name="Mouse clicks" stroke="#f472b6" fill="url(#dClicks)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty>No activity in this range.</Empty>}
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Active vs. idle time (minutes)</div>
          {series.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="dActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dIdle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={0.4} /><stop offset="100%" stopColor="#eab308" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263153" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...chartAxis} tickLine={false} />
                <YAxis {...chartAxis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="mouseActiveMin" name="Active" stroke="#22c55e" fill="url(#dActive)" strokeWidth={2} />
                <Area type="monotone" dataKey="mouseIdleMin" name="Idle" stroke="#eab308" fill="url(#dIdle)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty>No activity in this range.</Empty>}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-medium mb-1">Top applications (minutes)</div>
        <div className="text-xs text-[var(--color-muted)] mb-3">Click an application to see its window titles over time.</div>
        {topApps.length ? (
          <ResponsiveContainer width="100%" height={Math.max(160, topApps.length * 30)}>
            <BarChart data={topApps} layout="vertical" margin={{ left: 40, right: 16 }}>
              <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="app" {...chartAxis} width={120} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="minutes" name="Minutes" fill="#818cf8" radius={[0, 4, 4, 0]}
                cursor="pointer" onClick={(bar) => setSelectedApp(bar?.app)} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty>No window activity recorded.</Empty>}
      </div>

      {selectedApp && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Window titles for <span className="text-[var(--color-brand-2)]">{selectedApp}</span></div>
            <button className="btn py-1 px-2" onClick={() => setSelectedApp(null)}><X size={14} /> Close</button>
          </div>
          {appTitles.loading && !appTitles.data ? <Spinner /> : appTitles.data?.points?.length ? (
            <TimelineChart points={appTitles.data.points}
              categories={appTitles.data.titles.map((t) => t.title)}
              catKey="title" bucketSeconds={appTitles.data.bucket} color="#f472b6" />
          ) : <Empty>No titles recorded for this app in the selected range.</Empty>}
        </div>
      )}

      <div className="card p-4">
        <div className="text-sm font-medium mb-3">Foreground windows timeline (all apps)</div>
        {windowsTl.data?.points?.length ? (
          <TimelineChart points={windowsTl.data.points}
            categories={windowsTl.data.apps} catKey="app"
            bucketSeconds={windowsTl.data.bucket} color="#6366f1" />
        ) : <Empty>No window activity recorded in this range.</Empty>}
      </div>
    </div>
  );
}
