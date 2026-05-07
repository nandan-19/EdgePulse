import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const [raw, proc, anom, patients] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE ts >= NOW()-INTERVAL '1 minute')::int AS last_min,
                  COUNT(*) FILTER (WHERE ts >= NOW()-INTERVAL '10 seconds')::int AS last_10s,
                  MAX(ts) AS last_write FROM raw_telemetry`),
    query(`SELECT COUNT(*)::int AS total, MAX(computed_at) AS last_write FROM processed_telemetry`),
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE detected_at >= NOW()-INTERVAL '1 minute')::int AS last_min,
                  MAX(detected_at) AS last_write FROM anomalies`),
    query(`SELECT DISTINCT ON (patient_id) patient_id, heart_rate, spo2, temperature, activity_level
           FROM raw_telemetry ORDER BY patient_id, ts DESC`),
  ]);
  return NextResponse.json({
    raw:      raw[0]  ?? {},
    proc:     proc[0] ?? {},
    anom:     anom[0] ?? {},
    patients: patients,
  });
}
