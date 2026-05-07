'use client';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Window {
  window_end: string;
  avg_heart_rate: number;
  avg_spo2: number;
  avg_temperature: number;
  avg_respiratory_rate: number;
  event_count: number;
}

function trendIcon(vals: number[]) {
  if (vals.length < 2) return null;
  const delta = vals[vals.length - 1] - vals[0];
  if (Math.abs(delta) < 1) return null;
  return delta > 0
    ? <TrendingUp className="w-3 h-3 text-red-500" />
    : <TrendingDown className="w-3 h-3 text-emerald-500" />;
}

export default function WindowTrendChart({ patientId }: { patientId: string }) {
  const [data, setData] = useState<Window[]>([]);

  useEffect(() => {
    if (!patientId) return;
    const load = () => fetch(`/api/trends/${patientId}`).then(r => r.json()).then(setData);
    load();
    const id = setInterval(load, 30000); // matches Spark window trigger
    return () => clearInterval(id);
  }, [patientId]);

  if (data.length === 0) return (
    <div className="card p-4 text-center text-slate-500 text-sm font-medium">
      ⏳ Waiting for 5-min window data (Spark aggregates every 30s)…
    </div>
  );

  const fmt = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const display = data.map(d => ({
    time: fmt(d.window_end),
    hr:   +Number(d.avg_heart_rate).toFixed(1),
    spo2: +Number(d.avg_spo2).toFixed(1),
    temp: +Number(d.avg_temperature).toFixed(2),
    resp: +Number(d.avg_respiratory_rate).toFixed(1),
    n:    d.event_count,
  }));

  const hrs  = display.map(d => d.hr);
  const spo2s = display.map(d => d.spo2);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          📊 5-min Rolling Averages · <span className="text-blue-600 font-mono">{patientId}</span>
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{trendIcon(hrs)} HR trend</span>
          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{trendIcon(spo2s)} SpO₂ trend</span>
          <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-md font-bold">
            {display.length} windows
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={display} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={4} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dx={-4} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#475569', fontWeight: 600, marginBottom: 4 }}
            formatter={(v: number, name: string) => [v, name === 'hr' ? 'Avg HR' : 'Avg SpO₂']}
          />
          <ReferenceLine y={120} stroke="#ef444460" strokeDasharray="4 4" label={{ value: 'HR limit', fill: '#ef4444', fontSize: 10, fontWeight: 600 }} />
          <ReferenceLine y={92}  stroke="#f59e0b60" strokeDasharray="4 4" label={{ value: 'SpO₂ min', fill: '#f59e0b', fontSize: 10, fontWeight: 600 }} />
          <Area type="monotone" dataKey="hr"   name="hr"   stroke="#ef4444" fill="url(#hrGrad)"   strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="spo2" name="spo2" stroke="#10b981" fill="url(#spo2Grad)" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 mt-2 font-medium text-center">
        Computed by Spark Window Aggregation · 5-min window · 1-min step · 30s watermark
      </p>
    </div>
  );
}
