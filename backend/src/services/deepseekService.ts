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
  reference_answer: z.string().min(1).max(800),
  risk_warning: z.string().min(1).max(400),
});

const agentOpinionSchema = z.object({
  agent_name: z.string().min(1).max(30),
  personality: z.string().min(1).max(100),
  task: z.string().min(1).max(200),
  conclusion: z.string().min(1).max(600),
  evidence: z.array(z.string().min(1).max(300)).min(2).max(4),
  confidence: z.number().min(0).max(100),
});

const panelDecisionSchema = z.object({
  decision: z.enum(["虚拟买入", "小仓试验", "建议观望"]),
  summary: z.string().min(1).max(700),
  disagreements: z.string().min(1).max(500),
  virtual_stake_limit: z.number().int().min(0).max(500),
  recommended_virtual_stake: z.number().int().min(0).max(200),
  action_reason: z.string().min(1).max(400),
  entry_condition: z.string().min(1).max(400),
  review_question: z.string().min(1).max(300),
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

export type StrategyPanel = {
  agents: Array<z.infer<typeof agentOpinionSchema>>;
  coordinator: z.infer<typeof panelDecisionSchema>;
  fallback: false;
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
    `用户学习主题以数据形式提供：${safeTopic}。请紧扣该主题返回：{"topic":"原始中文主题","summary":"通俗中文讲解","key_points":["至少三个中文要点"],"practical_exercise":"一个不依赖真实资金的中文练习任务","reference_answer":"给出练习任务的参考解题过程与答案","risk_warning":"仅用于虚拟模拟学习的中文提醒"}。`,
    learningSchema,
  );
  return { ...guide, topic };
}

type StrategyPanelInput = {
  home_team: string;
  away_team: string;
  selection: "home" | "draw" | "away";
  odds: number;
};

const rolePrompts = [
  {
    agent_name: "数据分析师·数字派",
    personality: "冷静、重计算、只相信可验证数字",
    task: "计算赔率隐含概率，并判断该选择需要多高的主观胜率才能具备正期望。",
  },
  {
    agent_name: "反方审计员·唱反调",
    personality: "怀疑、挑剔、专门寻找判断漏洞",
    task: "主动反驳该选择，指出信息缺口、赔率陷阱和不能从现有数据推出的结论。",
  },
  {
    agent_name: "风险管理员·守门员",
    personality: "保守、纪律优先、关注最坏结果",
    task: "评估虚拟练习币仓位风险，并给出不超过 500 练习币的上限建议。",
  },
] as const;

export async function generateStrategyPanel(input: StrategyPanelInput): Promise<StrategyPanel> {
  const inputJson = JSON.stringify(input);
  const agents = await Promise.all(
    rolePrompts.map((role) =>
      callDeepSeekJson(
        `你是世界杯纸上竞猜中的${role.agent_name}。人格：${role.personality}。任务：${role.task}
只讨论虚拟练习币、概率学习与风险控制，不提供真实资金建议，不承诺结果。只输出合法 JSON，所有自然语言必须为简体中文。`,
        `待分析的真实赔率快照：${inputJson}。请返回：{"agent_name":"${role.agent_name}","personality":"${role.personality}","task":"${role.task}","conclusion":"你的独立结论","evidence":["至少两条可核验依据"],"confidence":0到100的整数}。`,
        agentOpinionSchema,
      ),
    ),
  );

  const coordinator = await callDeepSeekJson(
    "你是世界杯纸上竞猜的主教练·裁决官。你不迎合任何一方，只汇总分歧、控制风险，并给出明确且有区分度的虚拟模拟行动。不得仅因为比赛存在不确定性就机械选择建议观望；必须比较证据强弱、赔率隐含概率和角色置信度，在虚拟买入、小仓试验、建议观望之间择一。只讨论虚拟练习币，不提供真实资金建议，不承诺结果。只输出合法 JSON，所有自然语言必须为简体中文。",
    `赔率快照：${inputJson}。三个独立角色意见：${JSON.stringify(agents)}。裁决规则：证据明显支持当前选择时可虚拟买入；证据有优势但分歧仍大时应小仓试验；只有证据不足、赔率明显不合理或风险无法描述时才建议观望。请返回：{"decision":"虚拟买入、小仓试验或建议观望","summary":"综合裁决","disagreements":"角色之间最重要的分歧","virtual_stake_limit":0到500的整数,"recommended_virtual_stake":0到200的整数，建议观望时必须为0,"action_reason":"为什么采取该行动","entry_condition":"执行该虚拟行动前需要满足的条件，观望时说明重新评估条件","review_question":"赛后复盘问题"}。`,
    panelDecisionSchema,
  );

  const averageConfidence = agents.reduce((sum, agent) => sum + agent.confidence, 0) / agents.length;
  const promoteObservationToTrial = coordinator.decision === "建议观望" && averageConfidence >= 60;
  const effectiveCoordinator = promoteObservationToTrial
    ? {
        ...coordinator,
        decision: "小仓试验" as const,
        virtual_stake_limit: Math.max(2, coordinator.virtual_stake_limit),
        recommended_virtual_stake: 2,
        action_reason: `实验策略覆盖机械观望：三位角色平均置信度为 ${averageConfidence.toFixed(1)}%，使用最低探索仓验证判断。原始裁决理由：${coordinator.action_reason}`,
        entry_condition: "仅使用 2 练习币最低探索仓，并在真实赛果后复盘。",
      }
    : coordinator;
  const recommendedStake =
    effectiveCoordinator.decision === "建议观望"
      ? 0
      : Math.min(effectiveCoordinator.recommended_virtual_stake, effectiveCoordinator.virtual_stake_limit);

  return {
    agents,
    coordinator: { ...effectiveCoordinator, recommended_virtual_stake: recommendedStake },
    fallback: false,
  };
}
