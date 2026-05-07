import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let lastTs = '';
  let lastAnomalyTs = '';

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      const tick = async () => {
        try {
          // Check for new vitals
          const tsRows = await query<{ ts: string }>(
            `SELECT MAX(ts)::text AS ts FROM raw_telemetry`
          );
          const newTs = tsRows[0]?.ts ?? '';

          if (newTs !== lastTs) {
            lastTs = newTs;
            const vitals = await query(
              `SELECT DISTINCT ON (patient_id)
                 patient_id, ts, heart_rate, spo2, temperature, respiratory_rate, activity_level
               FROM raw_telemetry ORDER BY patient_id, ts DESC`
            );
            const stats = await query(
              `SELECT COUNT(*)::int AS total,
                      COUNT(*) FILTER (WHERE ts >= NOW()-INTERVAL '1 minute')::int AS last_min,
                      COUNT(*) FILTER (WHERE ts >= NOW()-INTERVAL '10 seconds')::int AS last_10s
               FROM raw_telemetry`
            );
            send('vitals', { vitals, stats: stats[0] });
          }

          // Check for new anomalies
          const anomTsRows = await query<{ ts: string }>(
            `SELECT MAX(detected_at)::text AS ts FROM anomalies`
          );
          const newAnomalyTs = anomTsRows[0]?.ts ?? '';

          if (newAnomalyTs !== lastAnomalyTs) {
            lastAnomalyTs = newAnomalyTs;
            const anomalies = await query(
              `SELECT patient_id, ts, heart_rate, spo2, temperature,
                      respiratory_rate, anomaly_type, severity, detected_at
               FROM anomalies
               WHERE ts >= NOW() - INTERVAL '15 minutes'
               ORDER BY ts DESC LIMIT 60`
            );
            send('anomalies', anomalies);
          }
        } catch (e) {
          send('error', { message: String(e) });
        }
      };

      // Send heartbeat immediately, then poll every 1s
      send('connected', { ts: new Date().toISOString() });
      await tick();
      const interval = setInterval(tick, 1000);

      // Cleanup when client disconnects
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
