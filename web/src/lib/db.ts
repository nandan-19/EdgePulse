import { Pool } from 'pg';

const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'db',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME     ?? 'edgepulse',
  user:     process.env.DB_USER     ?? 'edgepulse',
  password: process.env.DB_PASSWORD ?? 'edgepulse_secret',
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export default pool;
