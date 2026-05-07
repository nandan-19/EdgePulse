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
  CRITICAL: 'border-red-200 bg-white shadow-xl',
  HIGH:     'border-orange-200 bg-white shadow-xl',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenRef = useRef(new Set<string>());

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const key = `${t.patient_id}-${t.anomaly_type}-${t.ts}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const id = crypto.randomUUID();
    setToasts(prev => [{ ...t, id }, ...prev].slice(0, 5));

    const orig = document.title;
    document.title = `⚠️ ${t.patient_id} ${t.severity} | EdgePulse`;
    const titleTimer = setTimeout(() => { document.title = orig; }, 10000);

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
      <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map(t => (
          <div key={t.id}
            className={clsx(
              'pointer-events-auto border rounded-xl p-4 backdrop-blur-md text-sm',
              'animate-in slide-in-from-right-4 duration-300',
              SEV_STYLES[t.severity]
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx("p-2 rounded-full", t.severity === 'CRITICAL' ? 'bg-red-50' : 'bg-orange-50')}>
                  <AlertTriangle className={clsx('w-5 h-5 shrink-0', t.severity === 'CRITICAL' ? 'text-red-600 animate-pulse' : 'text-orange-600')} />
                </div>
                <div>
                  <div className={clsx("font-bold text-sm", t.severity === 'CRITICAL' ? 'text-red-700' : 'text-orange-700')}>
                    {t.severity} — {t.patient_id}
                  </div>
                  <div className="text-slate-700 text-xs mt-0.5 font-medium">
                    {t.anomaly_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-slate-500 text-xs mt-1 font-mono">
                    HR {t.heart_rate} bpm · SpO₂ {t.spo2}%
                  </div>
                </div>
              </div>
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', t.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500')}
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
