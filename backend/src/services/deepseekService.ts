import { z } from "zod";
import { APP_SCHEMA, query } from "../db.js";

const prohibitedTerms = [
  "稳赚",
  "真实下注",
  "充值",
  "提现",
  "跟单赚钱",
  "推荐平台",
  "必中",
  "保证盈利",
];

const verificationSchema = z.object({
  status: z.literal("connected"),
  summary: z.string().min(1).max(500),
  evidence: z.array(z.string().min(1).max(300)).min(2).max(5),
  result: z.string().min(1).max(500),
});

export type DeepSeekVerification = z.infer<typeof verificationSchema> & {
  fallback: false;
  model: string;
  request_id: string | null;
};

function assertSafeContent(content: string) {
  const found = prohibitedTerms.find((term) => content.includes(term));
  if (found) {
    throw new Error(`DeepSeek output contained prohibited term: ${found}`);
  }
}

function parseContent(payload: unknown) {
  const responseSchema = z.object({
    id: z.string().optional(),
    choices: z.array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    ).min(1),
  });
  const parsedResponse = responseSchema.parse(payload);
  const content = parsedResponse.choices[0].message.content;
  assertSafeContent(content);
  return {
    requestId: parsedResponse.id || null,
    value: verificationSchema.parse(JSON.parse(content)),
  };
}

async function saveCallLog(
  model: string,
  requestId: string | null,
  responseJson: unknown,
) {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(
      `insert into ${APP_SCHEMA}.ai_call_logs (provider, model, request_id, fallback, response_json)
       values ('deepseek', $1, $2, false, $3::jsonb)`,
      [model, requestId, JSON.stringify(responseJson)],
    );
  } catch (error) {
    console.error("Unable to save AI call log", error);
  }
}

export async function verifyDeepSeekConnection(): Promise<DeepSeekVerification> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("AI 服务未配置，请在后端环境变量中配置 DEEPSEEK_API_KEY。");
  }

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
            {
              role: "system",
              content:
                "You are the World Cup PaperBet configuration verifier. Return only valid JSON. This product uses practice-only virtual coins and does not provide real-money wagering. Never include prohibited promotional language.",
            },
            {
              role: "user",
              content:
                'Return exactly this JSON shape: {"status":"connected","summary":"short Chinese summary","evidence":["evidence one","evidence two"],"result":"short Chinese result"}. Confirm that the AI service is reachable and can return structured JSON.',
            },
          ],
          temperature: 0.2,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek HTTP ${response.status}: ${await response.text()}`);
      }

      const parsed = parseContent(await response.json());
      const result: DeepSeekVerification = {
        ...parsed.value,
        fallback: false,
        model,
        request_id: parsed.requestId,
      };
      await saveCallLog(model, parsed.requestId, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DeepSeek verification failed");
}
