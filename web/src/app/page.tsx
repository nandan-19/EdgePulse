'use client';
import { useState, useCallback } from 'react';
import PatientCard, { type VitalData } from '@/components/PatientCard';
import VitalsChart from '@/components/VitalsChart';
import WindowTrendChart from '@/components/WindowTrendChart';
import AnomalyFeed from '@/components/AnomalyFeed';
import { useStream } from '@/hooks/useStream';
import { useAnomalyAlerts } from '@/hooks/useAnomalyAlerts';
import { Database, Zap, Users, AlertTriangle, Radio } from 'lucide-react';

interface Anomaly {
  patient_id: string; ts: string; heart_rate: number; spo2: number;
  temperature: number; respiratory_rate: number; anomaly_type: string; severity: string; detected_at: string;
}
interface Stats { total: number; last_min: number; last_10s: number; }

function StatBadge({ icon: Icon, label, value, sub, accent = 'text-blue-600' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-slate-50 border border-slate-100 ${accent}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className={`text-xl font-bold tabular-nums font-mono ${accent}`}>{value}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [vitals,    setVitals]    = useState<VitalData[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, last_min: 0, last_10s: 0 });
  const [selected,  setSelected]  = useState<string | null>(null);
  const [lastPush,  setLastPush]  = useState<string>('—');

  // SSE push — replaces all setInterval polling
  useStream({
    vitals: useCallback((data: unknown) => {
      const d = data as { vitals: VitalData[]; stats: Stats };
      setVitals(d.vitals);
      setStats(d.stats);
      setLastPush(new Date().toLocaleTimeString('en-GB'));
      setSelected(s => s ?? d.vitals[0]?.patient_id ?? null);
    }, []),
    anomalies: useCallback((data: unknown) => {
      setAnomalies(data as Anomaly[]);
    }, []),
  });

  // Toast alerts for CRITICAL/HIGH anomalies
  useAnomalyAlerts(anomalies);

  const criticalCount = vitals.filter(v => (v.heart_rate > 130 && v.spo2 < 90) || v.spo2 < 88).length;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBadge icon={Database} label="Total Ingested" value={stats.total.toLocaleString()} accent="text-blue-600" />
        <StatBadge icon={Zap}      label="Events / Minute" value={stats.last_min} sub="Kafka → Spark → DB" accent="text-orange-500" />
        <StatBadge icon={Users}    label="Active Patients" value={vitals.length} sub="streaming now" accent="text-emerald-600" />
        <StatBadge icon={AlertTriangle} label="Critical Alerts" value={criticalCount} sub="abnormal vitals" accent={criticalCount > 0 ? 'text-red-600' : 'text-slate-400'} />
      </div>

      {/* Live indicator + last push time */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
        <span>SSE stream active · last push <span className="font-mono text-slate-600 font-medium">{lastPush}</span></span>
      </div>

      {/* Patient grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          🏥 Live Patient Snapshot
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {vitals.map(v => (
            <PatientCard key={v.patient_id} {...v}
              selected={selected === v.patient_id}
              onClick={() => setSelected(v.patient_id)} />
          ))}
          {vitals.length === 0 && (
            <div className="col-span-4 card p-8 text-center text-slate-500 animate-pulse">
              ⏳ Connecting to SSE stream…
            </div>
          )}
        </div>
      </div>

      {/* Charts + Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {selected && <VitalsChart patientId={selected} />}
          {selected && <WindowTrendChart patientId={selected} />}
        </div>
        <div className="lg:col-span-2">
          <AnomalyFeed anomalies={anomalies} />
        </div>
      </div>
    </div>
  );
}
