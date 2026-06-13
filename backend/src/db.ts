import pg from "pg";

const { Pool } = pg;

export const APP_SCHEMA = "world_cup_paperbet";

function sslConfig(connectionString: string) {
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) {
    return undefined;
  }

  return { rejectUnauthorized: false };
}

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: sslConfig(connectionString),
      max: 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 8_000,
    })
  : null;

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  if (!pool) {
    throw new Error("数据库连接尚未配置");
  }
  return pool.query<T>(text, values);
}
