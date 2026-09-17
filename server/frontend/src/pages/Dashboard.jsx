import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  MonitorSmartphone, Wifi, Keyboard, MousePointerClick, MousePointer2, Clock,
} from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { StatCard, Spinner, Empty } from '../components/ui.jsx';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { WorkHoursToggle } from '../components/WorkHoursToggle.jsx';
import { RangeControls, selToQuery, selToParams } from '../components/RangeControls.jsx';
import { useWorkHours } from '../lib/useWorkHours.js';
import { fmtNumber, fmtDuration, labelForBucket } from '../lib/format.js';

const chartAxis = { stroke: '#8792ad', fontSize: 12 };
const tooltipStyle = {
  background: '#131a2e', border: '1px solid #263153', borderRadius: 8, fontSize: 12, color: '#e7ecf7',
};

export default function Dashboard() {
  const [sel, setSel] = useState({ kind: '24h' });
  const [workHoursOnly, setWorkHoursOnly] = useWorkHours();
  const q = selToQuery(sel);
  const whParam = workHoursOnly ? '&workHours=1' : '';
  const { data, loading } = useFetch(`/analytics/overview?${q}${whParam}`, [q, workHoursOnly], 30000);

  const bucket = data?.bucket || 3600;
  const series = (data?.series || []).map((s) => ({
    ...s,
    label: labelForBucket(s.bucket, bucket),
    mouseActiveMin: Math.round(s.mouseActiveSec / 60),
    mouseIdleMin: Math.round(s.mouseIdleSec / 60),
  }));
  const topApps = (data?.topApps || []).map((a) => ({ ...a, minutes: Math.round(a.seconds / 60) }));
  const exportParams = { ...selToParams(sel), ...(data?.workHoursApplied ? { workHours: 1 } : {}) };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workplace overview</h1>
          <p className="text-sm text-[var(--color-muted)]">Aggregated activity across all devices</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WorkHoursToggle value={workHoursOnly} onChange={setWorkHoursOnly} workHours={data?.workHours} />
          <RangeControls value={sel} onChange={setSel} />
          <ExportMenu kind="samples" params={exportParams} label="Export data" />
        </div>
      </div>
      {data?.workHoursApplied && (
        <div className="text-xs text-[var(--color-brand-2)] -mt-3">
          Showing work-hours activity only ({data.workHours.start}–{data.workHours.end}).
        </div>
      )}

      {loading && !data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Wifi} label="Online now" accent="#22c55e"
              value={`${data?.devices?.online || 0}`} sub={`${data?.devices?.active || 0} enrolled`} />
            <StatCard icon={MonitorSmartphone} label="Devices" accent="#6366f1"
              value={fmtNumber(data?.devices?.active)} sub={`${data?.devices?.total || 0} incl. archived`} />
            <StatCard icon={Keyboard} label="Keypresses" accent="#818cf8"
              value={fmtNumber(data?.totals?.keypresses)} />
            <StatCard icon={MousePointerClick} label="Mouse clicks" accent="#f472b6"
              value={fmtNumber(data?.totals?.mouseClicks)} />
            <StatCard icon={MousePointer2} label="Active time" accent="#22c55e"
              value={fmtDuration(data?.totals?.mouseActiveSec)} />
            <StatCard icon={Clock} label="Idle time" accent="#eab308"
              value={fmtDuration(data?.totals?.mouseIdleSec)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-sm font-medium mb-3">Keyboard &amp; mouse activity</div>
              {series.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="gKeys" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f472b6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#263153" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...chartAxis} tickLine={false} />
                    <YAxis {...chartAxis} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="keypresses" name="Keypresses" stroke="#818cf8" fill="url(#gKeys)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mouseClicks" name="Mouse clicks" stroke="#f472b6" fill="url(#gClicks)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty>No activity recorded in this range.</Empty>}
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium mb-3">Active vs. idle time (minutes)</div>
              {series.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gIdle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#eab308" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#263153" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...chartAxis} tickLine={false} />
                    <YAxis {...chartAxis} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="mouseActiveMin" name="Active" stroke="#22c55e" fill="url(#gActive)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mouseIdleMin" name="Idle" stroke="#eab308" fill="url(#gIdle)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty>No activity recorded in this range.</Empty>}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium mb-3">Top applications (minutes)</div>
            {topApps.length ? (
              <ResponsiveContainer width="100%" height={Math.max(160, topApps.length * 30)}>
                <BarChart data={topApps} layout="vertical" margin={{ left: 40, right: 16 }}>
                  <XAxis type="number" {...chartAxis} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="app" {...chartAxis} width={120} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="minutes" name="Minutes" fill="#818cf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty>No window activity recorded.</Empty>}
          </div>
        </>
      )}
    </div>
  );
}
