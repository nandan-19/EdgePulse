'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

interface Toast {
  id: string;
  patient_id: string;
  anomaly_type: string;
  severity: 'CRITICAL' | 'HIGH';
  heart_rate: number;
  spo2: number;
  ts: string;
}

interface ToastCtx {
  addToast: (t: Omit<Toast, 'id'>) => void;
}

const Ctx = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(Ctx);

const SEV_STYLES = {
  CRITICAL: 'border-red-500/70 bg-red-950/80 shadow-[0_0_30px_rgba(239,68,68,0.4)]',
  HIGH:     'border-amber-500/60 bg-amber-950/70 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenRef = useRef(new Set<string>());

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const key = `${t.patient_id}-${t.anomaly_type}-${t.ts}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const id = crypto.randomUUID();
    setToasts(prev => [{ ...t, id }, ...prev].slice(0, 5)); // max 5 toasts

    // Change tab title
    const orig = document.title;
    document.title = `⚠️ ${t.patient_id} ${t.severity} | EdgePulse`;
    const titleTimer = setTimeout(() => { document.title = orig; }, 10000);

    // Auto-dismiss
    const ttl = t.severity === 'CRITICAL' ? 8000 : 5000;
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
      clearTimeout(titleTimer);
    }, ttl);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(x => x.id !== id));

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      {/* Toast stack */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map(t => (
          <div key={t.id}
            className={clsx(
              'pointer-events-auto border rounded-xl p-4 backdrop-blur-md text-sm',
              'animate-in slide-in-from-right-4 duration-300',
              SEV_STYLES[t.severity]
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className={clsx('w-4 h-4 shrink-0', t.severity === 'CRITICAL' ? 'text-red-400 animate-pulse' : 'text-amber-400')} />
                <div>
                  <div className="font-bold text-white">
                    {t.severity} — {t.patient_id}
                  </div>
                  <div className="text-slate-300 text-xs mt-0.5">
                    {t.anomaly_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-slate-400 text-xs mt-1 font-mono">
                    HR {t.heart_rate} bpm · SpO₂ {t.spo2}%
                  </div>
                </div>
              </div>
              <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-white shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Countdown bar */}
            <div className="mt-3 h-0.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', t.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500')}
                style={{ animation: `shrink ${t.severity === 'CRITICAL' ? 8 : 5}s linear forwards` }}
              />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
        @keyframes slide-in-from-right-4 { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }
        .animate-in { animation: slide-in-from-right-4 0.3s ease-out; }
      `}</style>
    </Ctx.Provider>
  );
}
