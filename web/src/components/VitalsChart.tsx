'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function VitalsChart({ patientId }: { patientId: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!patientId) return;
    const load = () => fetch(`/api/timeseries/${patientId}`).then(r => r.json()).then(setData);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [patientId]);

  if (data.length === 0) return <div className="card p-8 text-center text-slate-500 font-medium">⏳ Loading chart data…</div>;

  const display = data.map(d => ({
    time: new Date(d.ts).toLocaleTimeString('en-GB'),
    heart_rate: d.heart_rate,
    spo2: d.spo2,
    temperature: +d.temperature,
    respiratory_rate: d.respiratory_rate,
  }));

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center justify-between">
        <span><span className="text-blue-600 font-mono">{patientId}</span> — Live Vitals (10 min)</span>
      </h3>
      <div className="grid grid-cols-1 gap-5">
        <Chart data={display} keys={[{ k: 'heart_rate', c: '#ef4444', n: 'HR (bpm)' }, { k: 'spo2', c: '#10b981', n: 'SpO₂ (%)' }]} />
        <Chart data={display} keys={[{ k: 'temperature', c: '#f59e0b', n: 'Temp (°C)' }, { k: 'respiratory_rate', c: '#64748b', n: 'Resp (bpm)' }]} />
      </div>
    </div>
  );
}

function Chart({ data, keys }: { data: any[]; keys: { k: string; c: string; n: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} interval="preserveStartEnd" axisLine={false} tickLine={false} dy={4} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dx={-4} />
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ color: '#475569', fontWeight: 600, marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#475569', fontWeight: 500, paddingTop: 8 }} iconType="circle" />
        {keys.map(({ k, c, n }) => (
          <Line key={k} type="monotone" dataKey={k} name={n} stroke={c} dot={false} strokeWidth={2.5} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
