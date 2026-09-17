import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { labelForBucket, fmtDuration } from '../lib/format.js';

const axis = { stroke: '#8792ad', fontSize: 11 };

function TimelineTip({ active, payload, bucketSeconds }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: '#131a2e', border: '1px solid #263153', borderRadius: 8, padding: 8, fontSize: 12, color: '#e7ecf7', maxWidth: 320 }}>
      <div style={{ color: '#8792ad' }}>{labelForBucket(p.x, bucketSeconds)}</div>
      {p.app && <div style={{ fontWeight: 600 }}>{p.app}</div>}
      <div style={{ whiteSpace: 'normal' }}>{p.title || p.y}</div>
      <div style={{ color: '#8792ad' }}>{fmtDuration(p.seconds)} in foreground</div>
    </div>
  );
}

// Scatter timeline: X = time bucket, Y = category (app or title), dot size = seconds.
export function TimelineChart({ points, categories, catKey, bucketSeconds, color = '#818cf8' }) {
  const rank = new Map(categories.map((c, i) => [c, i]));
  const data = points
    .map((p) => ({ x: p.bucket, y: p[catKey], seconds: p.seconds, title: p.title, app: p.app }))
    .sort((a, b) => (rank.get(a.y) ?? 0) - (rank.get(b.y) ?? 0));
  const height = Math.max(150, categories.length * 30 + 50);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="#263153" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} {...axis}
          tickLine={false} tickFormatter={(v) => labelForBucket(v, bucketSeconds)} />
        <YAxis type="category" dataKey="y" allowDuplicatedCategory={false} {...axis}
          width={150} interval={0} tickLine={false}
          tickFormatter={(v) => (v && v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
        <ZAxis type="number" dataKey="seconds" range={[40, 300]} />
        <Tooltip content={<TimelineTip bucketSeconds={bucketSeconds} />} cursor={{ stroke: '#334155', strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={color} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
