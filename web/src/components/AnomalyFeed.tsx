'use client';
import clsx from 'clsx';

interface Anomaly {
  patient_id: string; ts: string; heart_rate: number; spo2: number;
  temperature: number; respiratory_rate: number; anomaly_type: string; severity: string;
}

const sevStyle = (s: string) => ({
  CRITICAL: 'badge-critical',
  HIGH:     'badge-high',
  MEDIUM:   'badge-medium',
})[s] ?? 'badge-medium';

export default function AnomalyFeed({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <div className="card p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">⚠️ Anomaly Feed</h3>
        <span className="text-xs text-slate-500">{anomalies.length} events · 15 min</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: 420 }}>
        {anomalies.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">✅ No anomalies detected</div>
        )}
        {anomalies.map((a, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 text-xs">
            <span className={clsx(sevStyle(a.severity))}>{a.severity}</span>
            <span className="font-mono text-slate-300 font-medium shrink-0">{a.patient_id}</span>
            <span className="text-slate-400 truncate flex-1">{a.anomaly_type.replace(/_/g, ' ')}</span>
            <span className="text-slate-600 font-mono whitespace-nowrap">
              {a.heart_rate}bpm / {a.spo2}%
            </span>
            <span className="text-slate-600 font-mono whitespace-nowrap">
              {new Date(a.ts).toLocaleTimeString('en-GB')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
