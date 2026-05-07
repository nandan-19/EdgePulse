'use client';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';

interface Anomaly {
  patient_id: string; ts: string; heart_rate: number; spo2: number;
  temperature: number; respiratory_rate: number; anomaly_type: string; severity: string; detected_at: string;
}

export function useAnomalyAlerts(anomalies: Anomaly[]) {
  const { addToast } = useToast();
  // Map of "patient_id-severity" -> timestamp of last alert
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // Seed cooldowns on initial load to avoid flooding on refresh
      const now = Date.now();
      anomalies.forEach(a => {
        lastAlertTimeRef.current.set(`${a.patient_id}-${a.severity}`, now);
      });
      mountedRef.current = true;
      return;
    }

    const now = Date.now();
    // Sort oldest to newest
    const sorted = [...anomalies].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    sorted.forEach(a => {
      const key = `${a.patient_id}-${a.severity}`;
      const lastAlert = lastAlertTimeRef.current.get(key) || 0;
      
      // 60-second cooldown per patient per severity level to prevent spam
      if (now - lastAlert > 60000 && (a.severity === 'CRITICAL' || a.severity === 'HIGH')) {
        lastAlertTimeRef.current.set(key, now);
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
