import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const rows = await query(`
    SELECT DISTINCT ON (patient_id)
      patient_id, ts, heart_rate, spo2, temperature, respiratory_rate, activity_level
    FROM raw_telemetry
    ORDER BY patient_id, ts DESC
  `);
  return NextResponse.json(rows);
}
