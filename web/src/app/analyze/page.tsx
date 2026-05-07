'use client';
import PipelineFlow from '@/components/PipelineFlow';
import { useEffect, useState } from 'react';

interface PipelineStats {
  raw:  { total: number; last_min: number; last_10s: number };
  proc: { total: number };
  anom: { total: number; last_min: number };
  patients: { patient_id: string; heart_rate: number; spo2: number }[];
}

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card px-4 py-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyzePage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/pipeline').then(r => r.json()).then(setStats);
    load(); const id = setInterval(load, 3000); return () => clearInterval(id);
  }, []);

  const evRate = stats ? Math.round((stats.raw.last_10s ?? 0) * 6) : 0;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pipeline Flow Analysis</h1>
        <p className="text-slate-500 text-sm mt-1">
          Real-time visualization of the Kafka → Spark → PostgreSQL data pipeline
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total Ingested"    value={(stats?.raw?.total  ?? 0).toLocaleString()} color="text-blue-400" />
        <StatCard label="Events / min"      value={stats?.raw?.last_min ?? 0}  sub="Kafka throughput" color="text-amber-400" />
        <StatCard label="Events / 10s"      value={stats?.raw?.last_10s ?? 0}  sub="burst rate" color="text-amber-300" />
        <StatCard label="Windows Computed"  value={(stats?.proc?.total ?? 0).toLocaleString()} sub="5-min sliding" color="text-purple-400" />
        <StatCard label="Anomalies Detected" value={(stats?.anom?.total ?? 0).toLocaleString()} color="text-red-400" />
        <StatCard label="Anomalies / min"   value={stats?.anom?.last_min ?? 0} sub="alert rate" color="text-red-300" />
      </div>

      {/* Pipeline Flow Canvas */}
      <PipelineFlow />

      {/* Legend */}
      <div className="card px-6 py-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Pipeline Stages</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {[
            { color: 'bg-blue-500',   label: 'Generators',  desc: '8 simulated patients · random-walk vitals' },
            { color: 'bg-amber-500',  label: 'Apache Kafka', desc: '3 topics · 3 partitions · gzip compressed' },
            { color: 'bg-purple-500', label: 'Spark Streaming', desc: '3 concurrent queries · 2s & 30s triggers' },
            { color: 'bg-emerald-500',label: 'PostgreSQL',   desc: '3 tables · indexed on patient_id + ts' },
            { color: 'bg-pink-500',   label: 'Dashboard',   desc: 'Next.js · 4s polling · Recharts' },
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <span className={`w-3 h-3 rounded-sm ${color} mt-0.5 shrink-0`} />
              <div>
                <div className="font-semibold text-slate-300">{label}</div>
                <div className="text-slate-500">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
