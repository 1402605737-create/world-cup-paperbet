import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("必须配置数据库连接地址");
}

const pool = new pg.Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/i.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
  max: 1,
});

try {
  const identity = await pool.query("select current_database(), current_user");
  const count = await pool.query(
    "select count(*)::int as count from world_cup_paperbet.demo_cases",
  );
  console.log(JSON.stringify({ identity: identity.rows[0], case_count: count.rows[0].count }));
} finally {
  await pool.end();
}
