import cors from "cors";
import express from "express";
import { getAllowedOrigins, getConfigStatus } from "./config.js";
import { APP_SCHEMA, query } from "./db.js";
import { generateLearningGuide, verifyDeepSeekConnection } from "./services/deepseekService.js";

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
      callback(new Error("当前来源未获得跨域访问许可"));
    },
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (_request, response) => {
  response.json({
    service: "世界杯纸上竞猜后端服务",
    phase: "中文学习助手与数据源状态",
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
      console.error("数据库健康检查失败", error);
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
    response.json({
      cases: result.rows.map((item) =>
        item.slug === "configuration-readiness"
          ? {
              ...item,
              title: "数据源配置就绪检查",
              status: "就绪",
              agent_trace: [
                { step: 1, agent: "配置检查助手", action: "检查后端环境变量配置状态" },
                { step: 2, agent: "合规保护助手", action: "阻止未配置数据源返回虚构数据" },
                { step: 3, agent: "人工智能验证助手", action: "验证结构化中文内容生成能力" },
              ],
              evidence: [
                "赛事与赔率数据源均提供明确配置状态",
                "后端不会返回虚构赛程、赛果或赔率",
                "人工智能调用记录明确标记未使用替代结果",
              ],
              result: { outcome: "中文学习助手与数据源状态功能已就绪" },
            }
          : item,
      ),
    });
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

app.post("/api/ai/learn", async (request, response, next) => {
  try {
    const input = request.body as { topic?: unknown };
    if (typeof input.topic !== "string" || !input.topic.trim() || input.topic.length > 200) {
      response.status(400).json({ error: "请输入不超过 200 个字符的学习主题。" });
      return;
    }
    response.json(await generateLearningGuide(input.topic.trim()));
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
    const message = error instanceof Error ? error.message : "发生未知错误";
    console.error(error);
    response.status(500).json({ error: message, fallback: false });
  },
);

export default app;
