import { z } from "zod";
import { APP_SCHEMA, query } from "../db.js";

const prohibitedTerms = ["稳赚", "真实下注", "跟单赚钱", "推荐平台", "必中", "保证盈利"];

const verificationSchema = z.object({
  status: z.literal("connected"),
  summary: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(300)).min(2).max(5),
  result: z.string().min(1).max(500),
});

const learningSchema = z.object({
  topic: z.string().min(1).max(200),
  summary: z.string().min(1).max(800),
  key_points: z.array(z.string().min(1).max(400)).min(3).max(6),
  practical_exercise: z.string().min(1).max(600),
  risk_warning: z.string().min(1).max(400),
});

export type DeepSeekVerification = z.infer<typeof verificationSchema> & {
  fallback: false;
  model: string;
  request_id: string | null;
};

export type LearningGuide = z.infer<typeof learningSchema> & {
  fallback: false;
  model: string;
  request_id: string | null;
};

function assertSafeContent(content: string) {
  const found = prohibitedTerms.find((term) => content.includes(term));
  if (found) throw new Error(`人工智能输出包含禁止表达：${found}`);
}

async function saveCallLog(model: string, requestId: string | null, responseJson: unknown) {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(
      `insert into ${APP_SCHEMA}.ai_call_logs (provider, model, request_id, fallback, response_json)
       values ('deepseek', $1, $2, false, $3::jsonb)`,
      [model, requestId, JSON.stringify(responseJson)],
    );
  } catch (error) {
    console.error("人工智能调用记录保存失败", error);
  }
}

async function callDeepSeekJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T & { fallback: false; model: string; request_id: string | null }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("人工智能服务尚未配置。");

  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`人工智能服务返回错误状态：${response.status}`);

      const payload = z.object({
        id: z.string().optional(),
        choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
      }).parse(await response.json());
      const content = payload.choices[0].message.content;
      assertSafeContent(content);
      const value = schema.parse(JSON.parse(content));
      const result = {
        ...value,
        fallback: false as const,
        model,
        request_id: payload.id || null,
      };
      await saveCallLog(model, payload.id || null, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("人工智能服务调用失败");
}

export function verifyDeepSeekConnection(): Promise<DeepSeekVerification> {
  return callDeepSeekJson(
    "你是世界杯纸上竞猜的系统连通验证助手。只输出合法 JSON，所有自然语言内容必须使用简体中文。",
    '请返回：{"status":"connected","summary":"中文摘要","evidence":["中文证据一","中文证据二"],"result":"中文结果"}。确认人工智能服务可以返回结构化中文内容。',
    verificationSchema,
  );
}

export async function generateLearningGuide(topic: string): Promise<LearningGuide> {
  const safeTopic = JSON.stringify({ topic });
  const guide = await callDeepSeekJson(
    "你是世界杯纸上竞猜的中文学习助手。你只做虚拟策略、赔率数学、概率、风险控制和赛后复盘教育。不得提供真实资金操作建议，不得承诺结果。只输出合法 JSON，所有自然语言内容必须使用简体中文。",
    `用户学习主题以数据形式提供：${safeTopic}。请紧扣该主题返回：{"topic":"原始中文主题","summary":"通俗中文讲解","key_points":["至少三个中文要点"],"practical_exercise":"一个不依赖真实比赛或真实资金的中文练习任务","risk_warning":"仅用于虚拟模拟学习的中文提醒"}。`,
    learningSchema,
  );
  return { ...guide, topic };
}
