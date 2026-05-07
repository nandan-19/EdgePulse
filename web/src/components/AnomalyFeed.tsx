'use client';
import clsx from 'clsx';

interface Anomaly {
  patient_id: string; ts: string; heart_rate: number; spo2: number;
  temperature: number; respiratory_rate: number; anomaly_type: string; severity: string; detected_at: string;
}

const sevStyle = (s: string) => ({
  CRITICAL: 'badge-critical',
  HIGH:     'badge-high',
  MEDIUM:   'badge-medium',
})[s] ?? 'badge-medium';

export default function AnomalyFeed({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">⚠️ Anomaly Feed</h3>
        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">{anomalies.length} events · 15 min</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ maxHeight: 420 }}>
        {anomalies.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-10 font-medium">✅ No anomalies detected</div>
        )}
        {anomalies.map((a, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 shadow-sm rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-slate-100">
            <span className={clsx(sevStyle(a.severity), "shrink-0 shadow-sm")}>{a.severity}</span>
            <span className="font-mono text-slate-700 font-bold shrink-0">{a.patient_id}</span>
            <span className="text-slate-600 truncate flex-1 font-medium">{a.anomaly_type.replace(/_/g, ' ')}</span>
            <span className="text-slate-500 font-mono whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-slate-100 shadow-sm">
              {a.heart_rate}bpm / {a.spo2}%
            </span>
            <span className="text-slate-400 font-mono whitespace-nowrap font-medium">
              {new Date(a.ts).toLocaleTimeString('en-GB')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
