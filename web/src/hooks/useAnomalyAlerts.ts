'use client';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';

interface Anomaly {
  patient_id: string; ts: string; heart_rate: number; spo2: number;
  temperature: number; anomaly_type: string; severity: string; detected_at: string;
}

export function useAnomalyAlerts(anomalies: Anomaly[]) {
  const { addToast } = useToast();
  const prevRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // On first load, seed seen set without alerting (don't flood toasts on mount)
      anomalies.forEach(a => prevRef.current.add(`${a.patient_id}-${a.anomaly_type}-${a.ts}`));
      mountedRef.current = true;
      return;
    }

    anomalies.forEach(a => {
      const key = `${a.patient_id}-${a.anomaly_type}-${a.ts}`;
      if (!prevRef.current.has(key) && (a.severity === 'CRITICAL' || a.severity === 'HIGH')) {
        prevRef.current.add(key);
        addToast({
          patient_id:   a.patient_id,
          anomaly_type: a.anomaly_type,
          severity:     a.severity as 'CRITICAL' | 'HIGH',
          heart_rate:   a.heart_rate,
          spo2:         a.spo2,
          ts:           a.ts,
        });
      }
    });
  }, [anomalies, addToast]);
}
