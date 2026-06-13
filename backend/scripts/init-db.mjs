import fs from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql = await fs.readFile(new URL("../sql/001_initial.sql", import.meta.url), "utf8");
const pool = new pg.Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/i.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
  max: 1,
});

try {
  const identity = await pool.query("select current_database(), current_user");
  await pool.query(sql);
  const count = await pool.query("select count(*)::int as count from demo_cases");
  console.log(JSON.stringify({ identity: identity.rows[0], case_count: count.rows[0].count }));
} finally {
  await pool.end();
}

