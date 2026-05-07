import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query(`
    SELECT patient_id, ts, heart_rate, spo2, temperature, respiratory_rate, anomaly_type, severity, detected_at
    FROM anomalies
    WHERE ts >= NOW() - INTERVAL '15 minutes'
    ORDER BY ts DESC LIMIT 60
  `);
  return NextResponse.json(rows);
}
