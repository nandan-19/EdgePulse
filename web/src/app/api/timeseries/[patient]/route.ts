import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: { patient: string } }
) {
  const rows = await query(
    `SELECT ts, heart_rate, spo2, temperature, respiratory_rate
     FROM raw_telemetry
     WHERE patient_id = $1 AND ts >= NOW() - INTERVAL '10 minutes'
     ORDER BY ts ASC`,
    [params.patient]
  );
  return NextResponse.json(rows);
}
