import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: { patient: string } }
) {
  const rows = await query(
    `SELECT window_start, window_end, avg_heart_rate, avg_spo2, avg_temperature, avg_respiratory_rate, event_count
     FROM processed_telemetry
     WHERE patient_id = $1
     ORDER BY window_end DESC LIMIT 12`,
    [params.patient]
  );
  return NextResponse.json(rows.reverse()); // chronological for charting
}
