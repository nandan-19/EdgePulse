'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useEffect, useState } from 'react';

interface Row { ts: string; heart_rate: number; spo2: number; temperature: number; respiratory_rate: number; }

export default function VitalsChart({ patientId }: { patientId: string }) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    if (!patientId) return;
    const load = () => fetch(`/api/timeseries/${patientId}`)
      .then(r => r.json()).then((rows: Row[]) => setData(rows.slice(-80)));
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [patientId]);

  const fmt = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const display = data.map(d => ({ ...d, time: fmt(d.ts) }));

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        <span className="text-blue-400">{patientId}</span> — Live Vitals (10 min)
      </h3>
      <div className="grid grid-cols-1 gap-4">
        <Chart data={display} keys={[{ k: 'heart_rate', c: '#f87171', n: 'HR (bpm)' }, { k: 'spo2', c: '#34d399', n: 'SpO₂ (%)' }]} />
        <Chart data={display} keys={[{ k: 'temperature', c: '#fbbf24', n: 'Temp (°C)' }, { k: 'respiratory_rate', c: '#a78bfa', n: 'Resp (bpm)' }]} />
      </div>
    </div>
  );
}

function Chart({ data, keys }: { data: Record<string, unknown>[]; keys: { k: string; c: string; n: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        {keys.map(({ k, c, n }) => (
          <Line key={k} type="monotone" dataKey={k} name={n} stroke={c} dot={false} strokeWidth={2} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
