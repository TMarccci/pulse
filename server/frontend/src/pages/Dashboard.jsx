import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MonitorSmartphone, Wifi, Keyboard, MousePointer2, Clock } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { StatCard, RangePicker, Spinner, Empty } from '../components/ui.jsx';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { WorkHoursToggle } from '../components/WorkHoursToggle.jsx';
import { useWorkHours } from '../lib/useWorkHours.js';
import { fmtNumber, fmtDuration, bucketLabel } from '../lib/format.js';

const chartAxis = { stroke: '#8792ad', fontSize: 12 };
const tooltipStyle = {
  background: '#131a2e', border: '1px solid #263153', borderRadius: 8, fontSize: 12, color: '#e7ecf7',
};

export default function Dashboard() {
  const [range, setRange] = useState('24h');
  const [workHoursOnly, setWorkHoursOnly] = useWorkHours();
  const whParam = workHoursOnly ? '&workHours=1' : '';
  const { data, loading } = useFetch(
    `/analytics/overview?range=${range}${whParam}`, [range, workHoursOnly], 30000);

  const series = (data?.series || []).map((s) => ({
    ...s,
    label: bucketLabel(s.bucket, range),
    mouseActiveMin: Math.round(s.mouseActiveSec / 60),
  }));
  const topApps = (data?.topApps || []).map((a) => ({ ...a, minutes: Math.round(a.seconds / 60) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workplace overview</h1>
          <p className="text-sm text-[var(--color-muted)]">Aggregated activity across all devices</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WorkHoursToggle value={workHoursOnly} onChange={setWorkHoursOnly} workHours={data?.workHours} />
          <RangePicker value={range} onChange={setRange} />
          <ExportMenu kind="samples"
            params={{ range, ...(data?.workHoursApplied ? { workHours: 1 } : {}) }}
            label="Export data" />
        </div>
      </div>
      {data?.workHoursApplied && (
        <div className="text-xs text-[var(--color-brand-2)] -mt-3">
          Showing work-hours activity only ({data.workHours.start}–{data.workHours.end}).
        </div>
      )}

      {loading && !data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Wifi} label="Online now" accent="#22c55e"
              value={`${data?.devices?.online || 0}`} sub={`${data?.devices?.active || 0} enrolled`} />
            <StatCard icon={MonitorSmartphone} label="Devices" accent="#6366f1"
              value={fmtNumber(data?.devices?.active)} sub={`${data?.devices?.total || 0} incl. archived`} />
            <StatCard icon={Keyboard} label="Keypresses" accent="#818cf8"
              value={fmtNumber(data?.totals?.keypresses)} sub={`in ${range}`} />
            <StatCard icon={MousePointer2} label="Active time" accent="#22c55e"
              value={fmtDuration(data?.totals?.mouseActiveSec)} sub="mouse/keyboard active" />
            <StatCard icon={Clock} label="Idle time" accent="#eab308"
              value={fmtDuration(data?.totals?.mouseIdleSec)} sub="mouse idle" />
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium mb-3">Activity over time</div>
            {series.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gKeys" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#263153" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" {...chartAxis} tickLine={false} />
                  <YAxis {...chartAxis} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="keypresses" name="Keypresses" stroke="#6366f1" fill="url(#gKeys)" strokeWidth={2} />
                  <Area type="monotone" dataKey="mouseActiveMin" name="Active (min)" stroke="#22c55e" fill="url(#gActive)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty>No activity recorded in this range.</Empty>}
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
