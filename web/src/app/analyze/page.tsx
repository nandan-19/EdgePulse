'use client';
import PipelineFlow from '@/components/PipelineFlow';
import { Database, Activity, Cpu, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

function StatCard({ label, value, sub, color = 'text-slate-800' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card px-4 py-5 text-center">
      <div className="text-xs text-slate-500 font-bold tracking-wide uppercase mb-2">{label}</div>
      <div className={`text-3xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1 font-medium">{sub}</div>}
    </div>
  );
}

export default function AnalyzePage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch('/api/pipeline').then(r => r.json()).then(setStats);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pipeline Flow Analysis</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          Real-time visualization of the Kafka → Spark → PostgreSQL data pipeline
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Ingested" value={stats?.raw.total.toLocaleString() ?? '—'} sub="Events in raw_telemetry" color="text-blue-600" />
        <StatCard label="Current Rate" value={`${stats?.raw.last_min ?? '—'} / min`} sub="Throughput" color="text-orange-500" />
        <StatCard label="Aggregations" value={stats?.proc.total.toLocaleString() ?? '—'} sub="5-min rolling windows" color="text-purple-600" />
        <StatCard label="Anomalies" value={stats?.anom.total.toLocaleString() ?? '—'} sub="Flagged critical events" color="text-red-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <PipelineFlow />
        </div>
        
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Pipeline Stages</h3>
            <div className="space-y-4 text-sm">
              {[
                { icon: Database, label: '1. Ingestion', desc: 'Patient generators write JSON events to Kafka topic raw-telemetry via TCP.' },
                { icon: Cpu, label: '2. Micro-batch Processing', desc: 'Spark Structured Streaming reads Kafka. Three separate streams run concurrently every 5s & 30s.' },
                { icon: Activity, label: '3. Storage', desc: 'Processed DataFrames are written via JDBC to PostgreSQL. Events are permanently persisted.' },
                { icon: Bell, label: '4. Serving', desc: 'Next.js App Router polls DB every 4s and serves clinical endpoints.' }
              ].map(({ icon: Icon, label, desc }, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5"><Icon className="w-4 h-4 text-slate-400" /></div>
                  <div>
                    <div className="font-bold text-slate-700">{label}</div>
                    <div className="text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
