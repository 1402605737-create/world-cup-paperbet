import cors from "cors";
import express from "express";
import { getAllowedOrigins, getConfigStatus } from "./config.js";
import { APP_SCHEMA, query } from "./db.js";
import { verifyDeepSeekConnection } from "./services/deepseekService.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || getAllowedOrigins().includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (_request, response) => {
  response.json({
    service: "World Cup PaperBet API",
    phase: "skeleton-deepseek-config-status",
  });
});

app.get("/health", async (_request, response) => {
  const config = getConfigStatus();
  let databaseConnected = false;
  let caseCount = 0;
  let currentUser: string | null = null;

  if (config.database.configured) {
    try {
      const identity = await query<{ current_database: string; current_user: string }>(
        "select current_database(), current_user",
      );
      currentUser = identity.rows[0].current_user;
      const cases = await query<{ count: string }>(
        `select (
          (select count(*) from ${APP_SCHEMA}.demo_cases) +
          (select count(*) from ${APP_SCHEMA}.ai_call_logs)
        )::text as count`,
      );
      caseCount = Number(cases.rows[0].count);
      databaseConnected = true;
    } catch (error) {
      console.error("Health database check failed", error);
    }
  }

  response.status(databaseConnected || !config.database.configured ? 200 : 503).json({
    status: databaseConnected || !config.database.configured ? "ok" : "degraded",
    database: config.database.engine,
    database_connected: databaseConnected,
    current_user: currentUser,
    deepseek_configured: config.deepseek.configured,
    case_count: caseCount,
  });
});

app.get("/api/system/config-status", (_request, response) => {
  response.json(getConfigStatus());
});

app.get("/api/demo/cases", async (_request, response, next) => {
  try {
    const result = await query(
      `select slug, title, status, agent_trace, evidence, result, created_at
       from ${APP_SCHEMA}.demo_cases order by created_at asc`,
    );
    response.json({ cases: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai/verify", async (_request, response, next) => {
  try {
    response.json(await verifyDeepSeekConnection());
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error(error);
    response.status(500).json({ error: message, fallback: false });
  },
);

export default app;
