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
  if (vals.length < 2) return <Minus className="w-3 h-3 text-slate-500" />;
  const delta = vals[vals.length - 1] - vals[0];
  if (Math.abs(delta) < 1) return <Minus className="w-3 h-3 text-slate-500" />;
  return delta > 0
    ? <TrendingUp className="w-3 h-3 text-red-400" />
    : <TrendingDown className="w-3 h-3 text-emerald-400" />;
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
    <div className="card p-4 text-center text-slate-600 text-sm">
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
    <div className="card p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">
          📊 5-min Rolling Averages · <span className="text-blue-400">{patientId}</span>
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">{trendIcon(hrs)} HR trend</span>
          <span className="flex items-center gap-1">{trendIcon(spo2s)} SpO₂ trend</span>
          <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
            {display.length} windows
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={display} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} />
          <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: number, name: string) => [v, name === 'hr' ? 'Avg HR' : 'Avg SpO₂']}
          />
          <ReferenceLine y={120} stroke="#ef444450" strokeDasharray="4 4" label={{ value: 'HR limit', fill: '#ef4444', fontSize: 9 }} />
          <ReferenceLine y={92}  stroke="#f5970050" strokeDasharray="4 4" label={{ value: 'SpO₂ min', fill: '#f59700', fontSize: 9 }} />
          <Area type="monotone" dataKey="hr"   name="hr"   stroke="#f87171" fill="url(#hrGrad)"   strokeWidth={2} dot={{ r: 3, fill: '#f87171' }} isAnimationActive={false} />
          <Area type="monotone" dataKey="spo2" name="spo2" stroke="#34d399" fill="url(#spo2Grad)" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-600 mt-1">
        Computed by Spark Window Aggregation · 5-min window · 1-min step · 30s watermark
      </p>
    </div>
  );
}
