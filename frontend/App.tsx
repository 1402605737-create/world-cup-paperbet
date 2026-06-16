import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const INITIAL_BALANCE = 10_000;
const MAX_STAKE = 500;
const AGENT_EXPLORATION_STAKE = 2;

type Page = "首页" | "真实数据" | "比赛下单" | "虚拟模拟" | "Agent 实验室" | "多角色分析" | "学习助手" | "系统状态" | "使用说明";
type Selection = "home" | "draw" | "away";
type OrderWindow = "切换比赛" | "选择玩法" | "下单汇总" | "本场票据";
type HomeWindow = "赛季概览" | "核心流程";
type DataWindow = "2026 赔率" | "2026 比分" | "2022 复盘";
type SimulationWindow = "人机概览" | "建立模拟" | "我的票据" | "Agent 票据";
type AgentWindow = "总览" | "待结算持仓" | "已结算记录";
type AnalysisWindow = "当前会审" | "人机对比" | "会审历史";
type LearningWindow = "开始学习" | "学习结果" | "学习历史";
type SystemWindow = "核心服务" | "数据源状态";
type GuideWindow = "操作步骤" | "数据与合规";
type OrderDateFilter = "全部" | "今天" | "明天" | "近3天" | "已结束";
type OrderMarketWindow = "胜平负" | "让球" | "猜比分" | "总进球";

type ConfigStatus = {
  deepseek: { configured: boolean };
  sports_data: { configured: boolean; message: string };
  odds_data: { configured: boolean; message: string };
};

type Health = {
  database_connected: boolean;
  deepseek_configured: boolean;
  case_count: number;
};

type LearningResult = {
  topic: string;
  summary: string;
  key_points: string[];
  practical_exercise: string;
  reference_answer: string;
  risk_warning: string;
  fallback: false;
};

type Match = {
  external_match_id: string;
  home_team: string;
  away_team: string;
  stage: string;
  kickoff_time: string;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  home_team_flag_url: string;
  away_team_flag_url: string;
};

type Odds = {
  external_event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  bookmaker: string;
  home_team_flag_url: string | null;
  away_team_flag_url: string | null;
  selections: Array<{ selection: Selection; odds: number }>;
};

type CurrentScore = {
  external_event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  completed: boolean;
  home_score: number | null;
  away_score: number | null;
  last_update: string | null;
  home_team_flag_url: string | null;
  away_team_flag_url: string | null;
};

type ReplayMatch = {
  external_match_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number;
  away_score: number;
  home_team_flag_url: string | null;
  away_team_flag_url: string | null;
};

type OrderMatch = {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string | null;
  awayFlag: string | null;
  kickoffTime: string;
  mode: "赛前模拟" | "赛后复盘";
  score?: { home: number; away: number };
  selections: Array<{ selection: Selection; odds: number }>;
};

type OrderPick = {
  id: string;
  market: "胜平负" | "让球胜平负" | "猜比分" | "总进球";
  label: string;
  odds: number;
  selection?: Selection;
  handicap?: number;
  exactScore?: string;
  totalGoals?: number | "7+";
  realOdds: boolean;
};

type SelectedBet = {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string | null;
  awayFlag: string | null;
  kickoffTime: string;
  selection: Selection;
  odds: number;
};

type PracticeSlip = SelectedBet & {
  id: string;
  stake: number;
  potentialReturn: number;
  reason: string;
  status: "待结算" | "已命中" | "未命中" | "已归档";
  createdAt: string;
  settledAt?: string;
  payout?: number;
  experienceEarned?: number;
  mode?: "赛前模拟" | "赛后复盘";
  market?: "胜平负" | "让球胜平负" | "猜比分" | "总进球";
  pickLabel?: string;
  handicap?: number;
  exactScore?: string;
  totalGoals?: number | "7+";
  settledScore?: { home: number; away: number };
};

type AgentSlip = PracticeSlip & {
  agentDecision: "虚拟买入" | "小仓试验" | "建议观望";
  agentExecution: "按建议执行" | "观望探索";
  agentBaseStake?: number;
  agentMultiplier?: number;
};

type AgentSettings = {
  autoBuyEnabled: boolean;
  multiplier: number;
  maxStake: number;
};

type AgentOpinion = {
  agent_name: string;
  personality: string;
  task: string;
  conclusion: string;
  evidence: string[];
  confidence: number;
};

type StrategyPanel = {
  agents: AgentOpinion[];
  coordinator: {
    decision: "虚拟买入" | "小仓试验" | "建议观望";
    summary: string;
    disagreements: string;
    virtual_stake_limit: number;
    recommended_virtual_stake: number;
    action_reason: string;
    entry_condition: string;
    review_question: string;
    opportunity_tags?: string[];
    action_checklist?: string[];
    preferred_ticket_structure?: string;
    avoid_list?: string[];
    alternative_view?: string;
  };
  fallback: false;
};

type PanelHistoryItem = {
  id: string;
  bet: SelectedBet;
  panel: StrategyPanel;
  createdAt: string;
};

type ExperienceProfile = {
  experience: number;
  discipline: number;
  season: number;
  totalGranted: number;
  panelsCompleted: number;
  slipsCreated: number;
  slipsSettled: number;
};

const topics = ["赔率是什么意思", "如何理解数学期望", "如何控制虚拟仓位", "如何做好赛后复盘"];

const teamNames: Record<string, string> = {
  Algeria: "阿尔及利亚", Argentina: "阿根廷", Australia: "澳大利亚", Austria: "奥地利",
  Belgium: "比利时", Brazil: "巴西", Cameroon: "喀麦隆", Canada: "加拿大",
  "Cape Verde": "佛得角", Chile: "智利", China: "中国", Colombia: "哥伦比亚",
  "Costa Rica": "哥斯达黎加", Croatia: "克罗地亚", Curaçao: "库拉索", Denmark: "丹麦",
  "Bosnia & Herzegovina": "波斯尼亚和黑塞哥维那", "Czech Republic": "捷克", "DR Congo": "刚果民主共和国",
  Ecuador: "厄瓜多尔", Egypt: "埃及", England: "英格兰", France: "法国",
  Germany: "德国", Ghana: "加纳", Greece: "希腊", Haiti: "海地", Honduras: "洪都拉斯",
  Hungary: "匈牙利", Iceland: "冰岛", Iran: "伊朗", Iraq: "伊拉克", Ireland: "爱尔兰",
  Italy: "意大利", "Ivory Coast": "科特迪瓦", Japan: "日本", Jordan: "约旦",
  Mexico: "墨西哥", Morocco: "摩洛哥", Netherlands: "荷兰", "New Zealand": "新西兰",
  Nigeria: "尼日利亚", Norway: "挪威", Panama: "巴拿马", Paraguay: "巴拉圭",
  Peru: "秘鲁", Poland: "波兰", Portugal: "葡萄牙", Qatar: "卡塔尔",
  Romania: "罗马尼亚", "Saudi Arabia": "沙特阿拉伯", Scotland: "苏格兰", Senegal: "塞内加尔",
  Serbia: "塞尔维亚", Slovakia: "斯洛伐克", Slovenia: "斯洛文尼亚", "South Africa": "南非",
  "South Korea": "韩国", Spain: "西班牙", Sweden: "瑞典", Switzerland: "瑞士",
  Tunisia: "突尼斯", Turkey: "土耳其", Ukraine: "乌克兰", Uruguay: "乌拉圭",
  USA: "美国", "United States": "美国", Uzbekistan: "乌兹别克斯坦", Venezuela: "委内瑞拉",
  Wales: "威尔士",
};

const stageNames: Record<string, string> = {
  Final: "决赛",
  "3rd Place Final": "季军赛",
  "Semi-finals": "半决赛",
  "Quarter-finals": "四分之一决赛",
  "Round of 16": "十六强赛",
};

const selectionNames: Record<Selection, string> = { home: "主胜", draw: "平局", away: "客胜" };
const storageKeys = {
  balance: "纸上竞猜_练习币余额",
  slips: "纸上竞猜_模拟单",
  learning: "纸上竞猜_学习历史",
  panels: "纸上竞猜_会审历史",
  profile: "纸上竞猜_成长档案",
  agentSlips: "纸上竞猜_Agent自动模拟单",
  agentSettings: "纸上竞猜_Agent自动购入设置",
};

const initialAgentSettings: AgentSettings = {
  autoBuyEnabled: true,
  multiplier: 1,
  maxStake: 200,
};

const initialProfile: ExperienceProfile = {
  experience: 0,
  discipline: 0,
  season: 1,
  totalGranted: INITIAL_BALANCE,
  panelsCompleted: 0,
  slipsCreated: 0,
  slipsSettled: 0,
};

const quickReasons = ["赔率隐含概率值得练习", "跟随会审建议小仓试验", "刻意练习逆向判断", "记录直觉并等待赛后验证"];

function zhTeam(name: string) {
  return teamNames[name] || name;
}

function zhStage(stage: string) {
  const groupStage = stage.match(/^Group Stage - (\d+)$/);
  if (groupStage) return `小组赛第 ${groupStage[1]} 轮`;
  return stageNames[stage] || stage.replace("Group ", "小组 ");
}

function zhDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeTeamName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameMatch(slip: PracticeSlip, score: CurrentScore) {
  if (slip.eventId === score.external_event_id) return true;
  const teamsMatch =
    normalizeTeamName(slip.homeTeam) === normalizeTeamName(score.home_team) &&
    normalizeTeamName(slip.awayTeam) === normalizeTeamName(score.away_team);
  const kickoffGap = Math.abs(new Date(slip.kickoffTime).getTime() - new Date(score.kickoff_time).getTime());
  return teamsMatch && kickoffGap <= 24 * 60 * 60 * 1000;
}

function resultSelection(homeScore: number, awayScore: number): Selection {
  return homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";
}

function slipWins(slip: PracticeSlip, homeScore: number, awayScore: number) {
  if (slip.market === "猜比分") {
    const actual = `${homeScore}:${awayScore}`;
    if (!slip.exactScore?.startsWith("other-")) return slip.exactScore === actual;
    const listed = new Set(scorePicks.filter((pick) => !pick.exactScore?.startsWith("other-")).map((pick) => pick.exactScore));
    if (listed.has(actual)) return false;
    return slip.exactScore === `other-${resultSelection(homeScore, awayScore)}`;
  }
  if (slip.market === "总进球") {
    const total = homeScore + awayScore;
    return slip.totalGoals === "7+" ? total >= 7 : slip.totalGoals === total;
  }
  if (slip.market === "让球胜平负") {
    return slip.selection === resultSelection(homeScore + (slip.handicap || 0), awayScore);
  }
  return slip.selection === resultSelection(homeScore, awayScore);
}

const handicapPicks: OrderPick[] = [
  { id: "h-1-home", market: "让球胜平负", label: "让 1 球·主胜", odds: 3.1, selection: "home", handicap: -1, realOdds: false },
  { id: "h-1-draw", market: "让球胜平负", label: "让 1 球·平局", odds: 3.6, selection: "draw", handicap: -1, realOdds: false },
  { id: "h-1-away", market: "让球胜平负", label: "让 1 球·客胜", odds: 1.85, selection: "away", handicap: -1, realOdds: false },
  { id: "h-2-home", market: "让球胜平负", label: "让 2 球·主胜", odds: 5.2, selection: "home", handicap: -2, realOdds: false },
  { id: "h-2-draw", market: "让球胜平负", label: "让 2 球·平局", odds: 4.3, selection: "draw", handicap: -2, realOdds: false },
  { id: "h-2-away", market: "让球胜平负", label: "让 2 球·客胜", odds: 1.35, selection: "away", handicap: -2, realOdds: false },
];

const scorePicks: OrderPick[] = [
  ["0:0", 7], ["1:0", 6], ["0:1", 7], ["1:1", 5.5], ["2:0", 8], ["0:2", 10],
  ["2:1", 7.5], ["1:2", 9], ["2:2", 11], ["3:0", 13], ["0:3", 17], ["3:1", 12], ["1:3", 15], ["3:2", 18], ["2:3", 20],
  ["4:0", 24], ["0:4", 32], ["4:1", 22], ["1:4", 28], ["4:2", 30], ["2:4", 36], ["5:0", 45], ["0:5", 55], ["5:1", 42], ["1:5", 50], ["5:2", 52], ["2:5", 60],
].map(([score, odds]) => ({
  id: `score-${score}`,
  market: "猜比分" as const,
  label: String(score),
  odds: Number(odds),
  exactScore: String(score),
  realOdds: false,
}));

scorePicks.push(
  { id: "score-other-home", market: "猜比分", label: "胜其他", odds: 25, exactScore: "other-home", realOdds: false },
  { id: "score-other-draw", market: "猜比分", label: "平其他", odds: 18, exactScore: "other-draw", realOdds: false },
  { id: "score-other-away", market: "猜比分", label: "负其他", odds: 30, exactScore: "other-away", realOdds: false },
);

const totalGoalPicks: OrderPick[] = [
  [0, 9], [1, 5.5], [2, 3.8], [3, 3.5], [4, 4.8], [5, 7], [6, 11], ["7+", 15],
].map(([goals, odds]) => ({
  id: `goals-${goals}`,
  market: "总进球" as const,
  label: `${goals} 球`,
  odds: Number(odds),
  totalGoals: goals as number | "7+",
  realOdds: false,
}));

function SectionTitle({ children, caption }: { children: string; caption?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

function WindowTabs<T extends string>({ value, items, onChange }: { value: T; items: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <View style={styles.windowTabs}>
      {items.map(([itemValue, label]) => (
        <Pressable key={itemValue} onPress={() => onChange(itemValue)} style={[styles.windowTab, value === itemValue && styles.windowTabActive]}>
          <Text style={[styles.windowTabText, value === itemValue && styles.windowTabTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatusRow({ title, configured, detail }: { title: string; configured: boolean; detail: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.flex}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <View style={[styles.badge, configured ? styles.badgeReady : styles.badgePending]}>
        <Text style={configured ? styles.readyText : styles.pendingText}>{configured ? "已就绪" : "待配置"}</Text>
      </View>
    </View>
  );
}

function Team({ name, flag }: { name: string; flag: string | null }) {
  return (
    <View style={styles.teamBlock}>
      {flag ? <Image source={{ uri: flag }} style={styles.flag} /> : <View style={styles.flagPlaceholder} />}
      <Text style={styles.teamName}>{zhTeam(name)}</Text>
    </View>
  );
}

function SlipTeams({ slip }: { slip: PracticeSlip }) {
  return (
    <>
      <View style={styles.teamsRow}>
        <Team name={slip.homeTeam} flag={slip.homeFlag} />
        <Text style={styles.versus}>对阵</Text>
        <Team name={slip.awayTeam} flag={slip.awayFlag} />
      </View>
      {slip.settledScore ? <Text style={styles.matchScore}>{slip.settledScore.home} : {slip.settledScore.away}</Text> : null}
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("首页");
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [odds, setOdds] = useState<Odds[]>([]);
  const [currentScores, setCurrentScores] = useState<CurrentScore[]>([]);
  const [liveDataLoading, setLiveDataLoading] = useState(false);
  const [matchesMessage, setMatchesMessage] = useState("");
  const [oddsMessage, setOddsMessage] = useState("");
  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);
  const [stake, setStake] = useState("25");
  const [reason, setReason] = useState("");
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [slips, setSlips] = useState<PracticeSlip[]>([]);
  const [topic, setTopic] = useState(topics[0]);
  const [learning, setLearning] = useState<LearningResult | null>(null);
  const [learningHistory, setLearningHistory] = useState<LearningResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [panel, setPanel] = useState<StrategyPanel | null>(null);
  const [panelPick, setPanelPick] = useState<OrderPick | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelHistory, setPanelHistory] = useState<PanelHistoryItem[]>([]);
  const [profile, setProfile] = useState<ExperienceProfile>(initialProfile);
  const [grantAmount, setGrantAmount] = useState("1000");
  const [replayMatch, setReplayMatch] = useState<ReplayMatch | null>(null);
  const [replaySelection, setReplaySelection] = useState<Selection>("home");
  const [replayStake, setReplayStake] = useState("10");
  const [orderMatch, setOrderMatch] = useState<OrderMatch | null>(null);
  const [orderPicks, setOrderPicks] = useState<OrderPick[]>([]);
  const [orderMultiplier, setOrderMultiplier] = useState(1);
  const [orderReason, setOrderReason] = useState("");
  const [orderMatchSearch, setOrderMatchSearch] = useState("");
  const [orderWindow, setOrderWindow] = useState<OrderWindow>("选择玩法");
  const [orderDateFilter, setOrderDateFilter] = useState<OrderDateFilter>("全部");
  const [orderMarketWindow, setOrderMarketWindow] = useState<OrderMarketWindow>("胜平负");
  const [agentSlips, setAgentSlips] = useState<AgentSlip[]>([]);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(initialAgentSettings);
  const [homeWindow, setHomeWindow] = useState<HomeWindow>("赛季概览");
  const [dataWindow, setDataWindow] = useState<DataWindow>("2026 赔率");
  const [simulationWindow, setSimulationWindow] = useState<SimulationWindow>("人机概览");
  const [agentWindow, setAgentWindow] = useState<AgentWindow>("总览");
  const [analysisWindow, setAnalysisWindow] = useState<AnalysisWindow>("当前会审");
  const [learningWindow, setLearningWindow] = useState<LearningWindow>("开始学习");
  const [systemWindow, setSystemWindow] = useState<SystemWindow>("核心服务");
  const [guideWindow, setGuideWindow] = useState<GuideWindow>("操作步骤");

  const stakeNumber = Number(stake) || 0;
  const potentialReturn = selectedBet ? Math.round(stakeNumber * selectedBet.odds * 100) / 100 : 0;
  const level = Math.floor(profile.experience / 100) + 1;
  const levelProgress = profile.experience % 100;
  const orderUnitStake = 2;
  const orderStakePerSelection = orderUnitStake * orderMultiplier;
  const orderTotalStake = orderStakePerSelection * orderPicks.length;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [configResponse, healthResponse] = await Promise.all([
        fetch(`${API_BASE}/api/system/config-status`),
        fetch(`${API_BASE}/health`),
      ]);
      if (!configResponse.ok || !healthResponse.ok) throw new Error("系统状态暂时无法加载");
      setConfig(await configResponse.json());
      setHealth(await healthResponse.json());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "系统状态加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void (async () => {
      const [savedBalance, savedSlips, savedLearning, savedPanels, savedProfile, savedAgentSlips, savedAgentSettings] = await Promise.all([
        AsyncStorage.getItem(storageKeys.balance),
        AsyncStorage.getItem(storageKeys.slips),
        AsyncStorage.getItem(storageKeys.learning),
        AsyncStorage.getItem(storageKeys.panels),
        AsyncStorage.getItem(storageKeys.profile),
        AsyncStorage.getItem(storageKeys.agentSlips),
        AsyncStorage.getItem(storageKeys.agentSettings),
      ]);
      if (savedBalance) setBalance(Number(savedBalance));
      if (savedSlips) setSlips(JSON.parse(savedSlips));
      if (savedLearning) setLearningHistory(JSON.parse(savedLearning));
      if (savedPanels) setPanelHistory(JSON.parse(savedPanels));
      if (savedProfile) setProfile({ ...initialProfile, ...JSON.parse(savedProfile) });
      if (savedAgentSlips) setAgentSlips(JSON.parse(savedAgentSlips));
      if (savedAgentSettings) setAgentSettings({ ...initialAgentSettings, ...JSON.parse(savedAgentSettings) });
    })();
  }, [loadStatus]);

  const settlePendingSlips = async (scores: CurrentScore[]) => {
    let payoutTotal = 0;
    let experienceTotal = 0;
    let settledCount = 0;
    let enrichedCount = 0;
    const settledAt = new Date().toISOString();
    const nextSlips = slips.map((slip) => {
      const score = scores.find((item) => sameMatch(slip, item));
      if (!score?.completed || score.home_score === null || score.away_score === null) return slip;
      if (slip.status !== "待结算" || slip.mode === "赛后复盘") {
        if (!slip.settledScore && slip.status !== "待结算") {
          enrichedCount += 1;
          return { ...slip, settledScore: { home: score.home_score, away: score.away_score } };
        }
        return slip;
      }
      const won = slipWins(slip, score.home_score, score.away_score);
      const payout = won ? slip.potentialReturn : 0;
      const experienceEarned = won ? 60 : 35;
      payoutTotal += payout;
      experienceTotal += experienceEarned;
      settledCount += 1;
      return {
        ...slip,
        status: won ? "已命中" as const : "未命中" as const,
        settledAt,
        payout,
        experienceEarned,
        settledScore: { home: score.home_score, away: score.away_score },
      };
    });
    let agentSettledCount = 0;
    const nextAgentSlips = agentSlips.map((slip) => {
      const score = scores.find((item) => sameMatch(slip, item));
      if (!score?.completed || score.home_score === null || score.away_score === null) return slip;
      if (slip.status !== "待结算") {
        if (!slip.settledScore) {
          enrichedCount += 1;
          return { ...slip, settledScore: { home: score.home_score, away: score.away_score } };
        }
        return slip;
      }
      const won = slipWins(slip, score.home_score, score.away_score);
      agentSettledCount += 1;
      return {
        ...slip,
        status: won ? "已命中" as const : "未命中" as const,
        settledAt,
        payout: won ? slip.potentialReturn : 0,
        settledScore: { home: score.home_score, away: score.away_score },
      };
    });
    if (settledCount === 0 && agentSettledCount === 0 && enrichedCount === 0) return;
    const nextBalance = Math.round((balance + payoutTotal) * 100) / 100;
    const nextProfile = {
      ...profile,
      experience: profile.experience + experienceTotal,
      discipline: profile.discipline + settledCount * 5,
      slipsSettled: profile.slipsSettled + settledCount,
    };
    setSlips(nextSlips);
    setAgentSlips(nextAgentSlips);
    setBalance(nextBalance);
    setProfile(nextProfile);
    setSuccess(`已按真实赛果结算：你的票 ${settledCount} 张，Agent 票 ${agentSettledCount} 张；你获得 ${experienceTotal} 点经验。`);
    await Promise.all([
      AsyncStorage.setItem(storageKeys.slips, JSON.stringify(nextSlips)),
      AsyncStorage.setItem(storageKeys.agentSlips, JSON.stringify(nextAgentSlips)),
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
      AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
    ]);
  };

  const settleNow = async () => {
    setLiveDataLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/current-scores`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "真实比分暂不可用");
      const scores = payload.scores || [];
      setCurrentScores(scores);
      const before = slips.filter((item) => item.status === "待结算" && item.mode !== "赛后复盘").length + agentSlips.filter((item) => item.status === "待结算").length;
      await settlePendingSlips(scores);
      const matchable = [...slips.filter((slip) => slip.mode !== "赛后复盘"), ...agentSlips]
        .filter((slip) => slip.status === "待结算" && scores.some((score: CurrentScore) => score.completed && sameMatch(slip, score))).length;
      if (matchable === 0) setSuccess(`已检查 ${before} 张待结算票，当前没有可匹配的已结束比赛。`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "结算失败");
    } finally {
      setLiveDataLoading(false);
    }
  };

  const loadLiveData = async () => {
    setLiveDataLoading(true);
    setMatchesMessage("");
    setOddsMessage("");
    try {
      const [matchesResponse, oddsResponse, scoresResponse] = await Promise.all([
        fetch(`${API_BASE}/api/matches`),
        fetch(`${API_BASE}/api/odds`),
        fetch(`${API_BASE}/api/current-scores`),
      ]);
      const matchesPayload = await matchesResponse.json();
      const oddsPayload = await oddsResponse.json();
      const scoresPayload = await scoresResponse.json();
      if (matchesResponse.ok) setMatches(matchesPayload.matches || []);
      else setMatchesMessage(matchesPayload.error || "历史赛果暂不可用");
      if (oddsResponse.ok) setOdds(oddsPayload.odds || []);
      else setOddsMessage(oddsPayload.error || "2026 世界杯真实赔率暂不可用");
      if (scoresResponse.ok) {
        const scores = scoresPayload.scores || [];
        setCurrentScores(scores);
        await settlePendingSlips(scores);
      }
    } catch {
      setMatchesMessage("真实数据服务暂时无法连接");
      setOddsMessage("真实数据服务暂时无法连接");
    } finally {
      setLiveDataLoading(false);
    }
  };

  const openPage = (item: Page) => {
    setPage(item);
    setError("");
    setSuccess("");
    if (item === "真实数据" && odds.length === 0) void loadLiveData();
    if (item === "Agent 实验室" && odds.length === 0) void loadLiveData();
    if (item === "虚拟模拟" && (slips.some((slip) => slip.status === "待结算") || agentSlips.some((slip) => slip.status === "待结算"))) void settleNow();
  };

  const updateAgentSettings = async (next: AgentSettings) => {
    setAgentSettings(next);
    await AsyncStorage.setItem(storageKeys.agentSettings, JSON.stringify(next));
  };

  const chooseAgentBet = (event: Odds, selection: Odds["selections"][number]) => {
    setSelectedBet({
      eventId: event.external_event_id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      homeFlag: event.home_team_flag_url,
      awayFlag: event.away_team_flag_url,
      kickoffTime: event.kickoff_time,
      selection: selection.selection,
      odds: selection.odds,
    });
    setPanel(null);
    setPanelPick(null);
    setAnalysisWindow("当前会审");
    setPage("多角色分析");
    setError("");
    setSuccess("已为 Agent 选择比赛与结果，请启动会审；会审完成后将按当前自动购入设置执行。");
  };

  const chooseBet = (event: Odds, selection: Odds["selections"][number]) => {
    setSelectedBet({
      eventId: event.external_event_id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      homeFlag: event.home_team_flag_url,
      awayFlag: event.away_team_flag_url,
      kickoffTime: event.kickoff_time,
      selection: selection.selection,
      odds: selection.odds,
    });
    setPanel(null);
    setPanelPick(null);
    setReason("");
    setStake("25");
    setPage("虚拟模拟");
    setSuccess("");
  };

  const openOrderCenter = (event: Odds) => {
    setOrderMatch({
      eventId: event.external_event_id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      homeFlag: event.home_team_flag_url,
      awayFlag: event.away_team_flag_url,
      kickoffTime: event.kickoff_time,
      mode: "赛前模拟",
      selections: event.selections,
    });
    setOrderPicks([]);
    setOrderMultiplier(1);
    setOrderReason("");
    setOrderMatchSearch("");
    setOrderWindow("选择玩法");
    setOrderDateFilter("全部");
    setOrderMarketWindow("胜平负");
    setPanel(null);
    setPanelPick(null);
    setPage("比赛下单");
    setError("");
    setSuccess("");
  };

  const openReplayOrderCenter = (match: ReplayMatch) => {
    setOrderMatch({
      eventId: match.external_match_id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      homeFlag: match.home_team_flag_url,
      awayFlag: match.away_team_flag_url,
      kickoffTime: match.kickoff_time,
      mode: "赛后复盘",
      score: { home: match.home_score, away: match.away_score },
      selections: [
        { selection: "home", odds: 2.35 },
        { selection: "draw", odds: 3.2 },
        { selection: "away", odds: 2.75 },
      ],
    });
    setOrderPicks([]);
    setOrderMultiplier(1);
    setOrderReason("赛后补购复盘：结果已知，仅练习组合选择、倍数和返还计算。");
    setOrderMatchSearch("");
    setOrderWindow("选择玩法");
    setOrderDateFilter("已结束");
    setOrderMarketWindow("胜平负");
    setPanel(null);
    setPanelPick(null);
    setPage("比赛下单");
    setError("");
    setSuccess("已进入赛后补购下单中心。复盘票不计入正式盈亏。");
  };

  const toggleOrderPick = (pick: OrderPick) => {
    setOrderPicks((current) =>
      current.some((item) => item.id === pick.id)
        ? current.filter((item) => item.id !== pick.id)
        : [...current, pick],
    );
  };

  const submitIntegratedOrder = async () => {
    if (!orderMatch || orderPicks.length === 0) return setError("请至少选择一个玩法选项。");
    if (orderMatch.mode === "赛前模拟" && new Date(orderMatch.kickoffTime).getTime() <= Date.now()) return setError("比赛已经开始，不能建立正式模拟票；请从已结束比赛进入赛后复盘。");
    if (orderTotalStake > balance) return setError("练习币余额不足，可以先在虚拟模拟页面补充额度。");
    const now = new Date().toISOString();
    let replayPayout = 0;
    const tickets: PracticeSlip[] = orderPicks.map((pick) => {
      const selection = pick.selection || "draw";
      const won = orderMatch.score ? slipWins({
        eventId: orderMatch.eventId,
        homeTeam: orderMatch.homeTeam,
        awayTeam: orderMatch.awayTeam,
        homeFlag: orderMatch.homeFlag,
        awayFlag: orderMatch.awayFlag,
        kickoffTime: orderMatch.kickoffTime,
        selection,
        odds: pick.odds,
        id: "",
        stake: orderStakePerSelection,
        potentialReturn: 0,
        reason: "",
        status: "待结算",
        createdAt: now,
        market: pick.market,
        handicap: pick.handicap,
        exactScore: pick.exactScore,
        totalGoals: pick.totalGoals,
      }, orderMatch.score.home, orderMatch.score.away) : false;
      const payout = orderMatch.mode === "赛后复盘" && won ? orderStakePerSelection * pick.odds : undefined;
      if (payout) replayPayout += payout;
      return {
        id: `${orderMatch.mode === "赛后复盘" ? "replay" : "ticket"}-${orderMatch.eventId}-${pick.id}-${Date.now()}`,
        eventId: orderMatch.eventId,
        homeTeam: orderMatch.homeTeam,
        awayTeam: orderMatch.awayTeam,
        homeFlag: orderMatch.homeFlag,
        awayFlag: orderMatch.awayFlag,
        kickoffTime: orderMatch.kickoffTime,
        selection,
        odds: pick.odds,
        stake: orderStakePerSelection,
        potentialReturn: Math.round(orderStakePerSelection * pick.odds * 100) / 100,
        reason: orderReason.trim() || "整合下单中心快速出票。",
        status: orderMatch.mode === "赛后复盘" ? (won ? "已命中" : "未命中") : "待结算",
        createdAt: now,
        settledAt: orderMatch.mode === "赛后复盘" ? now : undefined,
        payout,
        experienceEarned: orderMatch.mode === "赛后复盘" ? 10 : 8,
        mode: orderMatch.mode,
        market: pick.market,
        pickLabel: pick.label,
        handicap: pick.handicap,
        exactScore: pick.exactScore,
        totalGoals: pick.totalGoals,
        settledScore: orderMatch.mode === "赛后复盘" && orderMatch.score ? orderMatch.score : undefined,
      };
    });
    const nextSlips = [...tickets, ...slips].slice(0, 120);
    const nextBalance = Math.round((balance - orderTotalStake + replayPayout) * 100) / 100;
    const experienceEarned = tickets.length * (orderMatch.mode === "赛后复盘" ? 10 : 8);
    const nextProfile = {
      ...profile,
      experience: profile.experience + experienceEarned,
      discipline: profile.discipline + (orderReason.trim() ? 2 : 0),
      slipsCreated: profile.slipsCreated + tickets.length,
    };
    setSlips(nextSlips);
    setBalance(nextBalance);
    setProfile(nextProfile);
    setError("");
    setSuccess(`${orderPicks.length} 注已出票，总投入 ${orderTotalStake} 练习币，获得 ${experienceEarned} 点经验。`);
    await Promise.all([
      AsyncStorage.setItem(storageKeys.slips, JSON.stringify(nextSlips)),
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
      AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
    ]);
  };

  const submitSlip = async () => {
    if (!selectedBet) return setError("请先从真实赔率中选择一个结果。");
    if (new Date(selectedBet.kickoffTime).getTime() <= Date.now()) return setError("比赛已经开始，不能建立正式模拟票；请使用赛后复盘玩法。");
    if (stakeNumber <= 0 || stakeNumber > MAX_STAKE) return setError(`单次模拟投入必须为 1 至 ${MAX_STAKE} 练习币。`);
    if (stakeNumber > balance) return setError("练习币余额不足。");
    const recordedReason = reason.trim() || "快速体验：暂未填写理由，赛后需要补充复盘。";
    const experienceEarned = reason.trim() ? 15 : 8;
    const slip: PracticeSlip = {
      ...selectedBet,
      id: `${selectedBet.eventId}-${Date.now()}`,
      stake: stakeNumber,
      potentialReturn,
      reason: recordedReason,
      status: "待结算",
      createdAt: new Date().toISOString(),
      experienceEarned,
    };
    const nextSlips = [slip, ...slips].slice(0, 50);
    const nextBalance = balance - stakeNumber;
    const nextProfile = {
      ...profile,
      experience: profile.experience + experienceEarned,
      discipline: profile.discipline + (reason.trim() ? 2 : 0),
      slipsCreated: profile.slipsCreated + 1,
    };
    setSlips(nextSlips);
    setBalance(nextBalance);
    setProfile(nextProfile);
    setError("");
    setSuccess(`虚拟模拟单已建立，获得 ${experienceEarned} 点经验。`);
    await Promise.all([
      AsyncStorage.setItem(storageKeys.slips, JSON.stringify(nextSlips)),
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
      AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
    ]);
  };

  const grantPracticeCoins = async () => {
    const amount = Number(grantAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      setError("单次补充额度必须为 1 至 1,000,000 练习币。");
      return;
    }
    const nextBalance = Math.round((balance + amount) * 100) / 100;
    const nextProfile = { ...profile, totalGranted: profile.totalGranted + amount };
    setBalance(nextBalance);
    setProfile(nextProfile);
    setError("");
    setSuccess(`已补充 ${amount.toLocaleString("zh-CN")} 练习币。该额度不计入盈亏。`);
    await Promise.all([
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
      AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
    ]);
  };

  const startReplay = (match: ReplayMatch) => {
    setReplayMatch(match);
    setReplaySelection("home");
    setReplayStake("10");
    setPage("虚拟模拟");
    setSuccess("已进入赛后补购模拟。该练习不会计入正式盈亏。");
  };

  const submitReplay = async () => {
    if (!replayMatch || replayMatch.home_score === null || replayMatch.away_score === null) return;
    const amount = Number(replayStake);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_STAKE) {
      setError(`赛后补购投入必须为 1 至 ${MAX_STAKE} 练习币。`);
      return;
    }
    if (amount > balance) return setError("练习币余额不足，可以先任意补充额度。");
    const result: Selection = replayMatch.home_score > replayMatch.away_score ? "home" : replayMatch.home_score < replayMatch.away_score ? "away" : "draw";
    const won = replaySelection === result;
    const replayOdds: Record<Selection, number> = { home: 2.35, draw: 3.2, away: 2.75 };
    const teachingOdds = replayOdds[replaySelection];
    const payout = won ? amount * teachingOdds : 0;
    const experienceEarned = 10;
    const slip: PracticeSlip = {
      id: `replay-${replayMatch.external_match_id}-${Date.now()}`,
      eventId: replayMatch.external_match_id,
      homeTeam: replayMatch.home_team,
      awayTeam: replayMatch.away_team,
      homeFlag: replayMatch.home_team_flag_url,
      awayFlag: replayMatch.away_team_flag_url,
      kickoffTime: replayMatch.kickoff_time,
      selection: replaySelection,
      odds: teachingOdds,
      stake: amount,
      potentialReturn: amount * teachingOdds,
      reason: "赛后补购复盘：结果已知，仅练习选择与返还计算。",
      status: won ? "已命中" : "未命中",
      createdAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      payout,
      experienceEarned,
      mode: "赛后复盘",
      settledScore: { home: replayMatch.home_score, away: replayMatch.away_score },
    };
    const nextSlips = [slip, ...slips].slice(0, 100);
    const nextBalance = balance - amount + payout;
    const nextProfile = { ...profile, experience: profile.experience + experienceEarned };
    setSlips(nextSlips);
    setBalance(nextBalance);
    setProfile(nextProfile);
    setSuccess(`赛后补购复盘完成，获得 ${experienceEarned} 点经验。该结果不计入正式盈亏。`);
    await Promise.all([
      AsyncStorage.setItem(storageKeys.slips, JSON.stringify(nextSlips)),
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
      AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
    ]);
  };

  const generateLearningGuide = async () => {
    if (!topic.trim()) return;
    setAiLoading(true);
    setLearning(null);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/ai/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "学习内容生成失败");
      const nextHistory = [payload, ...learningHistory].slice(0, 20);
      setLearning(payload);
      setLearningWindow("学习结果");
      setLearningHistory(nextHistory);
      await AsyncStorage.setItem(storageKeys.learning, JSON.stringify(nextHistory));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "学习内容生成失败");
    } finally {
      setAiLoading(false);
    }
  };

  const createAgentSlip = async (bet: SelectedBet, panelResult: StrategyPanel, pick?: OrderPick, manual = false) => {
    if (!agentSettings.autoBuyEnabled && !manual) return "自动关闭";
    if (new Date(bet.kickoffTime).getTime() <= Date.now()) return "已开赛";
    const coordinator = panelResult.coordinator;
    const market = pick?.market || "胜平负";
    const pickLabel = pick?.label || selectionNames[bet.selection];
    const duplicate = agentSlips.some((item) =>
      item.status === "待结算" &&
      item.eventId === bet.eventId &&
      (item.market || "胜平负") === market &&
      (item.pickLabel || selectionNames[item.selection]) === pickLabel,
    );
    if (duplicate) return "重复";
    const isExploration = coordinator.decision === "建议观望" || coordinator.recommended_virtual_stake <= 0;
    const baseStake = isExploration
      ? AGENT_EXPLORATION_STAKE
      : Math.min(MAX_STAKE, coordinator.recommended_virtual_stake, coordinator.virtual_stake_limit);
    const stake = Math.min(MAX_STAKE, agentSettings.maxStake, baseStake * agentSettings.multiplier);
    if (stake <= 0) return "失败";
    const slip: AgentSlip = {
      ...bet,
      id: `agent-${bet.eventId}-${pick?.id || bet.selection}-${Date.now()}`,
      stake,
      potentialReturn: Math.round(stake * bet.odds * 100) / 100,
      reason: isExploration
        ? `主教练建议观望；Agent 使用最低探索仓验证该判断。原始理由：${coordinator.action_reason}`
        : coordinator.action_reason,
      status: "待结算",
      createdAt: new Date().toISOString(),
      mode: "赛前模拟",
      market,
      pickLabel,
      handicap: pick?.handicap,
      exactScore: pick?.exactScore,
      totalGoals: pick?.totalGoals,
      agentDecision: coordinator.decision,
      agentExecution: isExploration ? "观望探索" : "按建议执行",
      agentBaseStake: baseStake,
      agentMultiplier: agentSettings.multiplier,
    };
    const nextAgentSlips = [slip, ...agentSlips].slice(0, 100);
    setAgentSlips(nextAgentSlips);
    await AsyncStorage.setItem(storageKeys.agentSlips, JSON.stringify(nextAgentSlips));
    return isExploration ? "探索出票" : "已出票";
  };

  const executeCurrentPanelForAgent = async () => {
    if (!selectedBet || !panel) return setError("当前没有可执行的会审裁决。");
    const action = await createAgentSlip(selectedBet, panel, panelPick || undefined, true);
    setAgentWindow("待结算持仓");
    if (action === "已出票" || action === "探索出票") {
      setPage("Agent 实验室");
      setSuccess(`Agent 已按 ${agentSettings.multiplier} 倍设置建立模拟持仓。`);
    } else if (action === "重复") {
      setError("Agent 已持有本场同选项待结算票，不能重复购入。");
    } else if (action === "已开赛") {
      setError("比赛已经开始，Agent 不能补建正式模拟票；请使用赛后复盘。");
    } else {
      setError("Agent 当前裁决执行失败，请检查最大单票上限设置。");
    }
  };

  const runOrderPanel = async () => {
    if (!orderMatch || orderPicks.length === 0) return setError("请先选择至少一个玩法选项，再启动会审。");
    const focusPick = orderPicks[0];
    const focusSelection = focusPick.selection || "draw";
    const focusOdds = focusPick.odds;
    const bet: SelectedBet = {
      eventId: orderMatch.eventId,
      homeTeam: orderMatch.homeTeam,
      awayTeam: orderMatch.awayTeam,
      homeFlag: orderMatch.homeFlag,
      awayFlag: orderMatch.awayFlag,
      kickoffTime: orderMatch.kickoffTime,
      selection: focusSelection,
      odds: focusOdds,
    };
    setPanelLoading(true);
    setPanel(null);
    setPanelPick(null);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/ai/strategy-panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team: bet.homeTeam,
          away_team: bet.awayTeam,
          selection: bet.selection,
          odds: bet.odds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "多角色分析失败");
      const historyItem: PanelHistoryItem = { id: `${bet.eventId}-${bet.selection}-${Date.now()}`, bet, panel: payload, createdAt: new Date().toISOString() };
      const nextHistory = [historyItem, ...panelHistory].slice(0, 30);
      const nextProfile = { ...profile, experience: profile.experience + 20, discipline: profile.discipline + 3, panelsCompleted: profile.panelsCompleted + 1 };
      setSelectedBet(bet);
      setPanel(payload);
      setPanelPick(focusPick);
      setPanelHistory(nextHistory);
      setProfile(nextProfile);
      if (payload.coordinator.action_reason) setOrderReason(payload.coordinator.action_reason);
      const agentAction = orderMatch.mode === "赛前模拟" ? await createAgentSlip(bet, payload, focusPick) : "复盘跳过";
      if (agentAction === "已出票" || agentAction === "探索出票") setAgentWindow("待结算持仓");
      setSuccess(agentAction === "已出票"
        ? `会审已保存，Agent 已按 ${agentSettings.multiplier} 倍设置自动建立独立模拟票。`
        : agentAction === "探索出票"
          ? `会审已保存；主教练建议观望，Agent 已按 ${agentSettings.multiplier} 倍探索设置自动出票。`
        : agentAction === "重复"
          ? "会审已保存；Agent 已持有本场同玩法待结算票，未重复出票。"
          : agentAction === "自动关闭"
            ? "会审已保存；Agent 自动购入当前已关闭，可在 Agent 实验室开启或手动执行。"
          : agentAction === "已开赛"
            ? "会审已保存；比赛已经开始，Agent 不建立正式自动票。"
          : agentAction === "复盘跳过"
            ? "会审已保存；当前为结果已知的赛后复盘，Agent 不建立正式自动票。"
          : "会审已保存，但 Agent 自动出票失败。");
      await Promise.all([
        AsyncStorage.setItem(storageKeys.panels, JSON.stringify(nextHistory)),
        AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "多角色分析失败");
    } finally {
      setPanelLoading(false);
    }
  };

  const runPanel = async () => {
    if (!selectedBet) return setError("请先选择一个真实赔率结果。");
    setPanelLoading(true);
    setPanel(null);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/ai/strategy-panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team: selectedBet.homeTeam,
          away_team: selectedBet.awayTeam,
          selection: selectedBet.selection,
          odds: selectedBet.odds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "多角色分析失败");
      setPanel(payload);
      setPanelPick(null);
      const historyItem: PanelHistoryItem = {
        id: `${selectedBet.eventId}-${selectedBet.selection}-${Date.now()}`,
        bet: selectedBet,
        panel: payload,
        createdAt: new Date().toISOString(),
      };
      const nextHistory = [historyItem, ...panelHistory].slice(0, 30);
      const nextProfile = {
        ...profile,
        experience: profile.experience + 20,
        discipline: profile.discipline + 3,
        panelsCompleted: profile.panelsCompleted + 1,
      };
      setPanelHistory(nextHistory);
      setProfile(nextProfile);
      if (payload.coordinator.recommended_virtual_stake > 0) {
        setStake(String(payload.coordinator.recommended_virtual_stake));
        setReason(payload.coordinator.action_reason);
      }
      const agentAction = await createAgentSlip(selectedBet, payload);
      if (agentAction === "已出票" || agentAction === "探索出票") setAgentWindow("待结算持仓");
      setSuccess(agentAction === "已出票"
        ? `会审已保存，Agent 已按 ${agentSettings.multiplier} 倍设置自动出票；你获得 20 点经验和 3 点纪律分。`
        : agentAction === "探索出票"
          ? `会审已保存；主教练建议观望，Agent 已按 ${agentSettings.multiplier} 倍探索设置自动出票。`
        : agentAction === "重复"
          ? "会审已保存；Agent 已持有本场同选项待结算票，未重复出票。"
          : agentAction === "自动关闭"
            ? "会审已保存；Agent 自动购入当前已关闭，可在 Agent 实验室开启或手动执行。"
          : agentAction === "已开赛"
            ? "会审已保存；比赛已经开始，Agent 不建立正式自动票。"
          : "会审已保存，但 Agent 自动出票失败。");
      await Promise.all([
        AsyncStorage.setItem(storageKeys.panels, JSON.stringify(nextHistory)),
        AsyncStorage.setItem(storageKeys.profile, JSON.stringify(nextProfile)),
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "多角色分析失败");
    } finally {
      setPanelLoading(false);
    }
  };

  const pendingExposure = useMemo(
    () => slips.filter((item) => item.mode !== "赛后复盘" && item.status === "待结算").reduce((sum, item) => sum + item.stake, 0),
    [slips],
  );
  const realizedProfitLoss = useMemo(
    () => slips
      .filter((item) => item.mode !== "赛后复盘" && (item.status === "已命中" || item.status === "未命中"))
      .reduce((sum, item) => sum + (item.payout || 0) - item.stake, 0),
    [slips],
  );
  const replayProfitLoss = useMemo(
    () => slips
      .filter((item) => item.mode === "赛后复盘")
      .reduce((sum, item) => sum + (item.payout || 0) - item.stake, 0),
    [slips],
  );
  const userSettledSlips = useMemo(
    () => slips.filter((item) => item.mode !== "赛后复盘" && (item.status === "已命中" || item.status === "未命中")),
    [slips],
  );
  const agentSettledSlips = useMemo(
    () => agentSlips.filter((item) => item.status === "已命中" || item.status === "未命中"),
    [agentSlips],
  );
  const agentRealizedProfitLoss = useMemo(
    () => agentSettledSlips.reduce((sum, item) => sum + (item.payout || 0) - item.stake, 0),
    [agentSettledSlips],
  );
  const agentPendingExposure = useMemo(
    () => agentSlips.filter((item) => item.status === "待结算").reduce((sum, item) => sum + item.stake, 0),
    [agentSlips],
  );
  const userHitRate = userSettledSlips.length ? userSettledSlips.filter((item) => item.status === "已命中").length / userSettledSlips.length * 100 : 0;
  const agentHitRate = agentSettledSlips.length ? agentSettledSlips.filter((item) => item.status === "已命中").length / agentSettledSlips.length * 100 : 0;
  const comparisonDifference = realizedProfitLoss - agentRealizedProfitLoss;
  const currentMatchUserSlips = useMemo(
    () => orderMatch ? slips.filter((slip) => slip.eventId === orderMatch.eventId) : [],
    [orderMatch?.eventId, slips],
  );
  const currentMatchAgentSlips = useMemo(
    () => orderMatch ? agentSlips.filter((slip) => slip.eventId === orderMatch.eventId) : [],
    [agentSlips, orderMatch?.eventId],
  );
  const currentMatchTickets = useMemo(
    () => [
      ...currentMatchUserSlips.map((slip) => ({ owner: "我的票" as const, slip })),
      ...currentMatchAgentSlips.map((slip) => ({ owner: "Agent票" as const, slip })),
    ],
    [currentMatchAgentSlips, currentMatchUserSlips],
  );
  const currentMatchStats = useMemo(() => {
    const settled = currentMatchTickets.filter(({ slip }) => slip.status === "已命中" || slip.status === "未命中");
    const won = settled.filter(({ slip }) => slip.status === "已命中");
    const statusCounts = currentMatchTickets.reduce<Record<string, number>>((map, { slip }) => {
      map[slip.status] = (map[slip.status] || 0) + 1;
      return map;
    }, {});
    const marketCounts = currentMatchTickets.reduce<Record<string, number>>((map, { slip }) => {
      const key = slip.market || "胜平负";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});
    return {
      total: currentMatchTickets.length,
      user: currentMatchUserSlips.length,
      agent: currentMatchAgentSlips.length,
      stake: currentMatchTickets.reduce((sum, { slip }) => sum + slip.stake, 0),
      pendingStake: currentMatchTickets.filter(({ slip }) => slip.status === "待结算").reduce((sum, { slip }) => sum + slip.stake, 0),
      potentialReturn: currentMatchTickets.reduce((sum, { slip }) => sum + slip.potentialReturn, 0),
      settled: settled.length,
      hitRate: settled.length ? won.length / settled.length * 100 : 0,
      realized: settled.reduce((sum, { slip }) => sum + (slip.payout || 0) - slip.stake, 0),
      statusCounts,
      marketCounts,
    };
  }, [currentMatchAgentSlips.length, currentMatchTickets, currentMatchUserSlips.length]);
  const futureOdds = useMemo(() => odds.filter((event) => new Date(event.kickoff_time).getTime() > Date.now()), [odds]);
  const replaySwitchMatches = useMemo(() => {
    const unique = new Map<string, ReplayMatch>();
    currentScores
      .filter((item) => item.completed && item.home_score !== null && item.away_score !== null)
      .forEach((item) => unique.set(item.external_event_id, {
        external_match_id: item.external_event_id,
        home_team: item.home_team,
        away_team: item.away_team,
        kickoff_time: item.kickoff_time,
        home_score: item.home_score as number,
        away_score: item.away_score as number,
        home_team_flag_url: item.home_team_flag_url,
        away_team_flag_url: item.away_team_flag_url,
      }));
    matches
      .filter((item) => item.home_score !== null && item.away_score !== null)
      .forEach((item) => unique.set(item.external_match_id, {
        external_match_id: item.external_match_id,
        home_team: item.home_team,
        away_team: item.away_team,
        kickoff_time: item.kickoff_time,
        home_score: item.home_score as number,
        away_score: item.away_score as number,
        home_team_flag_url: item.home_team_flag_url,
        away_team_flag_url: item.away_team_flag_url,
      }));
    return [...unique.values()];
  }, [currentScores, matches]);
  const normalizedOrderSearch = orderMatchSearch.trim().toLowerCase();
  const dateMatchesOrderFilter = (kickoffTime: string, completed = false) => {
    if (orderDateFilter === "全部") return true;
    if (orderDateFilter === "已结束") return completed;
    const kickoff = new Date(kickoffTime);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTomorrow = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
    const startAfterTomorrow = new Date(startTomorrow.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (orderDateFilter === "今天") return kickoff >= startToday && kickoff < startTomorrow;
    if (orderDateFilter === "明天") return kickoff >= startTomorrow && kickoff < startAfterTomorrow;
    return kickoff >= threeDaysAgo && kickoff <= now;
  };
  const visibleOrderOdds = odds.filter((item) =>
    dateMatchesOrderFilter(item.kickoff_time) &&
    (!normalizedOrderSearch ||
      `${item.home_team} ${item.away_team} ${zhTeam(item.home_team)} ${zhTeam(item.away_team)}`.toLowerCase().includes(normalizedOrderSearch)),
  );
  const visibleReplaySwitchMatches = replaySwitchMatches.filter((item) =>
    dateMatchesOrderFilter(item.kickoff_time, true) &&
    (!normalizedOrderSearch ||
      `${item.home_team} ${item.away_team} ${zhTeam(item.home_team)} ${zhTeam(item.away_team)}`.toLowerCase().includes(normalizedOrderSearch)),
  );
  const currentMatchTicketCount = currentMatchStats.total;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.container} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>2026 世界杯纸上竞猜</Text>
          <Text style={styles.brandTitle}>2026 世界杯虚拟策略实验室</Text>
          <Text style={styles.brandSubtitle}>围绕 2026 世界杯真实赔率、赛程与近期比分建立模拟单，再让不同人格的人工智能角色共同审查。2022 数据仅作为历史复盘档案，全程不涉及真实资金。</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {(["首页", "真实数据", ...(orderMatch ? ["比赛下单" as Page] : []), "虚拟模拟", "Agent 实验室", "多角色分析", "学习助手", "系统状态", "使用说明"] as Page[]).map((item) => (
            <Pressable key={item} onPress={() => openPage(item)} style={[styles.navItem, page === item && styles.navItemActive]}>
              <Text style={[styles.navText, page === item && styles.navTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {page === "首页" ? (
          <>
            <WindowTabs value={homeWindow} onChange={setHomeWindow} items={[["赛季概览", "赛季概览"], ["核心流程", "核心流程"]]} />
            {homeWindow === "赛季概览" ? (
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>第 {profile.season} 练习赛季 · 等级 {level}</Text>
              <Text style={styles.heroBalance}>{balance.toLocaleString("zh-CN")} 练习币</Text>
              <Text style={styles.heroText}>经验 {profile.experience} · 纪律分 {profile.discipline} · 已建立 {slips.length} 张模拟单 · 待结算投入 {pendingExposure.toLocaleString("zh-CN")} 练习币。</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${levelProgress}%` }]} /></View>
              <Text style={styles.heroText}>距离下一等级还需 {100 - levelProgress} 点经验。会审、建单和真实赛果结算都会积累经验。</Text>
              <Pressable style={styles.lightButton} onPress={() => openPage("真实数据")}><Text style={styles.lightButtonText}>从真实赔率开始模拟</Text></Pressable>
            </View>
            ) : null}
            {homeWindow === "核心流程" ? (
            <>
            <SectionTitle caption="从选择、质疑到复盘，形成完整学习闭环">核心流程</SectionTitle>
            {[
              ["01", "选择 2026 真实赔率", "查看 2026 世界杯真实赛程赔率与球队国旗，选择主胜、平局或客胜。", "真实数据"],
              ["02", "建立虚拟模拟单", "输入练习币和选择理由，系统固定记录赔率快照与潜在回报。", "虚拟模拟"],
              ["03", "启动多角色会审", "数据分析师、反方审计员和风险管理员独立分析，由主教练裁决。", "多角色分析"],
              ["04", "学习与复盘", "完成有参考答案的练习，并保留学习历史与模拟单历史。", "学习助手"],
            ].map(([number, title, text, target]) => (
              <Pressable key={number} style={styles.featureCard} onPress={() => openPage(target as Page)}>
                <Text style={styles.featureNumber}>{number}</Text><Text style={styles.featureTitle}>{title}</Text><Text style={styles.muted}>{text}</Text>
              </Pressable>
            ))}
            </>
            ) : null}
          </>
        ) : null}

        {page === "真实数据" ? (
          <>
            <SectionTitle caption="当前主要体验为 2026 世界杯；2022 数据只用于历史复盘">2026 世界杯真实数据中心</SectionTitle>
            <Pressable style={styles.primaryButton} onPress={loadLiveData} disabled={liveDataLoading}><Text style={styles.primaryButtonText}>{liveDataLoading ? "正在刷新…" : "刷新真实数据"}</Text></Pressable>
            {liveDataLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            <WindowTabs value={dataWindow} onChange={setDataWindow} items={[["2026 赔率", `2026 赔率 ${odds.length}`], ["2026 比分", `2026 比分 ${currentScores.length}`], ["2022 复盘", `2022 复盘 ${matches.length}`]]} />
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>当前赛事：2026 世界杯</Text>
              <Text style={styles.noticeText}>页面优先展示 2026 世界杯当前真实赔率、未来赛程，以及实时/近三天比分。页面底部另保留 2022 年世界杯 64 场完整赛果，仅用于已结束比赛复盘，不代表当前届次。</Text>
            </View>
            {matchesMessage ? <Text style={styles.dataMessage}>{matchesMessage}</Text> : null}
            {oddsMessage ? <Text style={styles.dataMessage}>{oddsMessage}</Text> : null}
            {dataWindow === "2026 赔率" ? (
            <>
            <SectionTitle caption={`${odds.length} 场可用于虚拟模拟`}>2026 世界杯当前真实赔率</SectionTitle>
            {odds.map((item) => (
              <View key={item.external_event_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>胜平负赔率</Text><Text style={styles.muted}>{zhDate(item.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={item.home_team} flag={item.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={item.away_team} flag={item.away_team_flag_url} /></View>
                <View style={styles.oddsRow}>
                  {item.selections.map((selection) => (
                    <View key={selection.selection} style={styles.oddsCell}>
                      <Text style={styles.oddsLabel}>{selectionNames[selection.selection]}</Text>
                      <Text style={styles.oddsValue}>{selection.odds.toFixed(2)}</Text>
                      <Text style={styles.oddsAction}>真实赔率</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.primaryButton} onPress={() => openOrderCenter(item)}><Text style={styles.primaryButtonText}>进入本场整合下单中心</Text></Pressable>
              </View>
            ))}
            </>
            ) : null}
            {dataWindow === "2026 比分" ? (
            <>
            <SectionTitle caption={`${currentScores.length} 场 2026 世界杯赛事；比分由数据源实时返回，近三天赛果可查询`}>2026 世界杯实时与近期比分</SectionTitle>
            {currentScores.length === 0 ? <Text style={styles.dataMessage}>当前比分接口暂未返回比赛；开赛后刷新即可查看实时与近三天赛果。</Text> : currentScores.map((match) => (
              <View key={match.external_event_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{match.completed ? "已完赛" : "未完赛或进行中"}</Text><Text style={styles.muted}>{zhDate(match.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={match.home_team} flag={match.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={match.away_team} flag={match.away_team_flag_url} /></View>
                {match.home_score !== null && match.away_score !== null ? <Text style={styles.matchScore}>{match.home_score} : {match.away_score}</Text> : <Text style={styles.muted}>尚无比分</Text>}
                {match.last_update ? <Text style={styles.muted}>数据更新时间：{zhDate(match.last_update)}</Text> : null}
                {match.completed && match.home_score !== null && match.away_score !== null ? (
                  <Pressable style={styles.secondaryButton} onPress={() => openReplayOrderCenter({
                    external_match_id: match.external_event_id,
                    home_team: match.home_team,
                    away_team: match.away_team,
                    kickoff_time: match.kickoff_time,
                    home_score: match.home_score as number,
                    away_score: match.away_score as number,
                    home_team_flag_url: match.home_team_flag_url,
                    away_team_flag_url: match.away_team_flag_url,
                  })}><Text style={styles.secondaryButtonText}>进入本场赛后整合补购中心</Text></Pressable>
                ) : null}
              </View>
            ))}
            </>
            ) : null}
            {dataWindow === "2022 复盘" ? (
            <>
            <View style={styles.archiveNotice}><Text style={styles.archiveNoticeTitle}>以下为 2022 历史复盘档案，不是当前 2026 届赛事</Text><Text style={styles.muted}>保留完整历史比分、国旗和赛后补购入口，用于训练结算与复盘。</Text></View>
            <SectionTitle caption={`${matches.length} 场真实已完赛记录，仅供历史复盘`}>2022 世界杯历史复盘档案</SectionTitle>
            {matches.map((match) => (
              <View key={match.external_match_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{zhStage(match.stage)}</Text><Text style={styles.muted}>{zhDate(match.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={match.home_team} flag={match.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={match.away_team} flag={match.away_team_flag_url} /></View>
                <Text style={styles.matchScore}>{match.home_score} : {match.away_score}</Text>
                {match.home_score !== null && match.away_score !== null ? (
                  <Pressable style={styles.secondaryButton} onPress={() => openReplayOrderCenter({
                    external_match_id: match.external_match_id,
                    home_team: match.home_team,
                    away_team: match.away_team,
                    kickoff_time: match.kickoff_time,
                    home_score: match.home_score as number,
                    away_score: match.away_score as number,
                    home_team_flag_url: match.home_team_flag_url,
                    away_team_flag_url: match.away_team_flag_url,
                  })}><Text style={styles.secondaryButtonText}>进入本场赛后整合补购中心</Text></Pressable>
                ) : null}
              </View>
            ))}
            </>
            ) : null}
          </>
        ) : null}

        {page === "比赛下单" ? (
          <>
            <SectionTitle caption="胜平负使用真实赔率；让球与比分使用明确标注的虚拟练习赔率">比赛整合下单中心</SectionTitle>
            {orderMatch ? (
              <>
                <View style={styles.orderHero}>
                  <View style={styles.matchMeta}>
                    <Text style={styles.replayBadge}>{orderMatch.mode === "赛前模拟" ? "赛前正式模拟" : "结果已知 · 赛后复盘补购"}</Text>
                    <Text style={styles.muted}>{zhDate(orderMatch.kickoffTime)}</Text>
                  </View>
                  <View style={styles.teamsRow}><Team name={orderMatch.homeTeam} flag={orderMatch.homeFlag} /><Text style={styles.versus}>对阵</Text><Team name={orderMatch.awayTeam} flag={orderMatch.awayFlag} /></View>
                  {orderMatch.score ? <Text style={styles.matchScore}>{orderMatch.score.home} : {orderMatch.score.away}</Text> : null}
                  <Text style={styles.muted}>每个选项按一注计算，每注 2 练习币 × 倍数。可以跨玩法多选，系统分别出票并分别结算。</Text>
                </View>

                <View style={styles.windowTabs}>
                  {([
                    ["切换比赛", "切换国家/比赛"],
                    ["选择玩法", "选择玩法"],
                    ["下单汇总", `下单汇总 ${orderPicks.length}`],
                    ["本场票据", `本场票据 ${currentMatchTicketCount}`],
                  ] as Array<[OrderWindow, string]>).map(([value, label]) => (
                    <Pressable key={value} onPress={() => setOrderWindow(value)} style={[styles.windowTab, orderWindow === value && styles.windowTabActive]}>
                      <Text style={[styles.windowTabText, orderWindow === value && styles.windowTabTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {orderWindow === "切换比赛" ? (
                  <View style={styles.switchPanel}>
                    <Text style={styles.panelTitle}>按国家或球队切换比赛</Text>
                    <Text style={styles.muted}>输入中文或英文国家名筛选；点击比赛后自动切换，并清空上一场尚未出票的玩法选择。</Text>
                    <TextInput value={orderMatchSearch} onChangeText={setOrderMatchSearch} placeholder="搜索国家或球队，例如：中国、阿根廷、France" placeholderTextColor="#8a9591" style={styles.shortInput} />
                    <View style={styles.quickRow}>
                      {(["全部", "今天", "明天", "近3天", "已结束"] as OrderDateFilter[]).map((value) => (
                        <Pressable key={value} onPress={() => setOrderDateFilter(value)} style={[styles.quickChip, orderDateFilter === value && styles.quickChipActive]}>
                          <Text style={[styles.quickChipText, orderDateFilter === value && styles.quickChipTextActive]}>{value}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.inputLabel}>2026 当前赔率比赛</Text>
                    <View style={styles.matchSwitcherGrid}>
                      {visibleOrderOdds.map((item) => (
                        <Pressable key={item.external_event_id} onPress={() => openOrderCenter(item)} style={[styles.matchSwitcherCard, orderMatch.eventId === item.external_event_id && styles.matchSwitcherCardActive]}>
                          <View style={styles.switchFlags}><Team name={item.home_team} flag={item.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={item.away_team} flag={item.away_team_flag_url} /></View>
                          <Text style={styles.switchDate}>{zhDate(item.kickoff_time)}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.inputLabel}>已结束比赛复盘</Text>
                    <View style={styles.matchSwitcherGrid}>
                      {visibleReplaySwitchMatches.map((item) => (
                        <Pressable key={item.external_match_id} onPress={() => openReplayOrderCenter(item)} style={[styles.matchSwitcherCard, orderMatch.eventId === item.external_match_id && styles.matchSwitcherCardActive]}>
                          <View style={styles.switchFlags}><Team name={item.home_team} flag={item.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={item.away_team} flag={item.away_team_flag_url} /></View>
                          <Text style={styles.switchScore}>{item.home_score} : {item.away_score}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {visibleOrderOdds.length === 0 && visibleReplaySwitchMatches.length === 0 ? <Text style={styles.dataMessage}>没有匹配该国家或球队的比赛。</Text> : null}
                  </View>
                ) : null}

                {orderWindow === "选择玩法" ? (
                  <>
                <View style={styles.marketWindowTabs}>
                  {(["胜平负", "让球", "猜比分", "总进球"] as OrderMarketWindow[]).map((value) => (
                    <Pressable key={value} onPress={() => setOrderMarketWindow(value)} style={[styles.marketWindowTab, orderMarketWindow === value && styles.marketWindowTabActive]}>
                      <Text style={[styles.marketWindowTabText, orderMarketWindow === value && styles.marketWindowTabTextActive]}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
                {orderMarketWindow === "胜平负" ? (
                <View style={styles.marketCard}>
                  <View style={styles.matchMeta}><Text style={styles.marketTitle}>胜平负</Text><Text style={styles.realOddsBadge}>{orderMatch.mode === "赛前模拟" ? "真实赔率" : "复盘练习赔率"}</Text></View>
                  <View style={styles.oddsRow}>
                    {orderMatch.selections.map((item) => {
                      const pick: OrderPick = { id: `h2h-${item.selection}`, market: "胜平负", label: selectionNames[item.selection], odds: item.odds, selection: item.selection, realOdds: orderMatch.mode === "赛前模拟" };
                      const selected = orderPicks.some((current) => current.id === pick.id);
                      return <Pressable key={pick.id} onPress={() => toggleOrderPick(pick)} style={[styles.oddsCell, selected && styles.oddsCellSelected]}><Text style={styles.oddsLabel}>{pick.label}</Text><Text style={styles.oddsValue}>{pick.odds.toFixed(2)}</Text><Text style={styles.oddsAction}>{selected ? "已选" : "选择"}</Text></Pressable>;
                    })}
                  </View>
                </View>
                ) : null}

                {orderMarketWindow === "让球" ? (
                <View style={styles.marketCard}>
                  <View style={styles.matchMeta}><Text style={styles.marketTitle}>让球胜平负</Text><Text style={styles.practiceOddsBadge}>虚拟练习赔率</Text></View>
                  <Text style={styles.muted}>主队分别让 1 球、让 2 球后，再判断主胜、平局或客胜。</Text>
                  {[-1, -2].map((handicap) => (
                    <View key={handicap} style={styles.handicapRow}>
                      <Text style={styles.handicapLabel}>主队让 {Math.abs(handicap)} 球</Text>
                      <View style={styles.oddsRow}>
                        {handicapPicks.filter((pick) => pick.handicap === handicap).map((pick) => {
                          const selected = orderPicks.some((current) => current.id === pick.id);
                          return <Pressable key={pick.id} onPress={() => toggleOrderPick(pick)} style={[styles.oddsCell, selected && styles.oddsCellSelected]}><Text style={styles.oddsLabel}>{selectionNames[pick.selection as Selection]}</Text><Text style={styles.oddsValue}>{pick.odds.toFixed(2)}</Text></Pressable>;
                        })}
                      </View>
                    </View>
                  ))}
                </View>
                ) : null}

                {orderMarketWindow === "猜比分" ? (
                <View style={styles.marketCard}>
                  <View style={styles.matchMeta}><Text style={styles.marketTitle}>猜比分</Text><Text style={styles.practiceOddsBadge}>虚拟练习赔率</Text></View>
                  <Text style={styles.muted}>选择最终常规比分；可多选多个比分，分别按注出票。</Text>
                  <View style={styles.scoreGrid}>
                    {scorePicks.map((pick) => {
                      const selected = orderPicks.some((current) => current.id === pick.id);
                      return <Pressable key={pick.id} onPress={() => toggleOrderPick(pick)} style={[styles.scoreCell, selected && styles.scoreCellSelected]}><Text style={styles.scoreLabel}>{pick.label}</Text><Text style={styles.scoreOdds}>{pick.odds.toFixed(2)}</Text></Pressable>;
                    })}
                  </View>
                </View>
                ) : null}

                {orderMarketWindow === "总进球" ? (
                <View style={styles.marketCard}>
                  <View style={styles.matchMeta}><Text style={styles.marketTitle}>总进球数</Text><Text style={styles.practiceOddsBadge}>虚拟练习赔率</Text></View>
                  <Text style={styles.muted}>按双方终场总进球数结算，7 球及以上统一归入“7+”。</Text>
                  <View style={styles.scoreGrid}>
                    {totalGoalPicks.map((pick) => {
                      const selected = orderPicks.some((current) => current.id === pick.id);
                      return <Pressable key={pick.id} onPress={() => toggleOrderPick(pick)} style={[styles.scoreCell, selected && styles.scoreCellSelected]}><Text style={styles.scoreLabel}>{pick.label}</Text><Text style={styles.scoreOdds}>{pick.odds.toFixed(2)}</Text></Pressable>;
                    })}
                  </View>
                </View>
                ) : null}

                <Pressable style={styles.primaryButton} onPress={() => setOrderWindow("下单汇总")}><Text style={styles.primaryButtonText}>已选 {orderPicks.length} 注 · 进入下单汇总</Text></Pressable>
                  </>
                ) : null}

                {orderWindow === "下单汇总" ? (
                <View style={styles.orderSummary}>
                  <Text style={styles.panelTitle}>下单汇总</Text>
                  <Text style={styles.slipLine}>已选 {orderPicks.length} 注 · 每注 2 币 · {orderMultiplier} 倍</Text>
                  <View style={styles.quickRow}>{[1, 5, 10, 20].map((value) => <Pressable key={value} onPress={() => setOrderMultiplier(value)} style={[styles.quickChip, orderMultiplier === value && styles.quickChipActive]}><Text style={[styles.quickChipText, orderMultiplier === value && styles.quickChipTextActive]}>{value} 倍</Text></Pressable>)}</View>
                  <Text style={styles.orderTotal}>总投入 {orderTotalStake.toLocaleString("zh-CN")} 练习币</Text>
                  {orderPicks.map((pick) => <View key={pick.id} style={styles.orderLine}><Text style={styles.orderLineText}>{pick.market} · {pick.label}</Text><Text style={styles.orderReturn}>预计返还 {(orderStakePerSelection * pick.odds).toFixed(2)}</Text></View>)}
                  <Text style={styles.inputLabel}>下单理由（可选）</Text>
                  <TextInput value={orderReason} onChangeText={setOrderReason} multiline placeholder="写下本场判断或使用会审建议。" placeholderTextColor="#8a9591" style={styles.input} />
                  <Pressable style={styles.secondaryButton} onPress={runOrderPanel} disabled={panelLoading}><Text style={styles.secondaryButtonText}>{panelLoading ? "多角色正在会审…" : "让多角色审查当前首选项"}</Text></Pressable>
                  {panel ? <View style={styles.inlineAdvice}><Text style={styles.agentName}>主教练建议：{panel.coordinator.decision}</Text><Text style={styles.muted}>{panel.coordinator.action_reason}</Text><Text style={styles.muted}>执行条件：{panel.coordinator.entry_condition}</Text></View> : null}
                  {panel ? <Pressable style={styles.secondaryButton} onPress={() => { setAgentWindow("待结算持仓"); setPage("Agent 实验室"); }}><Text style={styles.secondaryButtonText}>查看 Agent 自动购入持仓</Text></Pressable> : null}
                  <Pressable style={styles.primaryButton} onPress={submitIntegratedOrder}><Text style={styles.primaryButtonText}>确认出票 · 总投入 {orderTotalStake} 练习币</Text></Pressable>
                </View>
                ) : null}

                {orderWindow === "本场票据" ? (
                  <>
                <SectionTitle caption="你的票与 Agent 自动票统一展示，已结算票显示国旗和最终比分">本场人机票据历史</SectionTitle>
                <View style={styles.ticketStatsPanel}>
                  <View style={styles.matchMeta}><Text style={styles.panelTitle}>本场全部彩票总体统计</Text><Text style={styles.agentTicketBadge}>{currentMatchStats.total} 张</Text></View>
                  <View style={styles.ticketStatsGrid}>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>你的票 / Agent</Text><Text style={styles.ticketStatValue}>{currentMatchStats.user} / {currentMatchStats.agent}</Text></View>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>总投入</Text><Text style={styles.ticketStatValue}>{currentMatchStats.stake.toFixed(0)}</Text></View>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>待结算敞口</Text><Text style={styles.ticketStatValue}>{currentMatchStats.pendingStake.toFixed(0)}</Text></View>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>潜在返还</Text><Text style={styles.ticketStatValue}>{currentMatchStats.potentialReturn.toFixed(2)}</Text></View>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>已结算盈亏</Text><Text style={styles.ticketStatValue}>{currentMatchStats.realized >= 0 ? "+" : ""}{currentMatchStats.realized.toFixed(2)}</Text></View>
                    <View style={styles.ticketStatCard}><Text style={styles.ticketStatLabel}>命中率</Text><Text style={styles.ticketStatValue}>{currentMatchStats.hitRate.toFixed(1)}%</Text></View>
                  </View>
                  <Text style={styles.inputLabel}>玩法分布</Text>
                  <View style={styles.marketPillRow}>
                    {Object.entries(currentMatchStats.marketCounts).length === 0 ? <Text style={styles.muted}>暂无玩法记录</Text> : Object.entries(currentMatchStats.marketCounts).map(([label, count]) => <Text key={label} style={styles.marketPill}>{label} {count}</Text>)}
                  </View>
                  <Text style={styles.inputLabel}>状态分布</Text>
                  <View style={styles.marketPillRow}>
                    {Object.entries(currentMatchStats.statusCounts).length === 0 ? <Text style={styles.muted}>暂无状态记录</Text> : Object.entries(currentMatchStats.statusCounts).map(([label, count]) => <Text key={label} style={styles.marketPill}>{label} {count}</Text>)}
                  </View>
                </View>
                {currentMatchUserSlips.map((slip) => (
                  <View key={slip.id} style={styles.slipCard}>
                    <View style={styles.matchMeta}><Text style={styles.matchStage}>你的票 · {slip.status}</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                    <SlipTeams slip={slip} />
                    <Text style={styles.slipLine}>{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · {slip.odds.toFixed(2)}</Text>
                    <Text style={styles.muted}>投入 {slip.stake} · 潜在返还 {slip.potentialReturn}</Text>
                  </View>
                ))}
                {currentMatchAgentSlips.map((slip) => (
                  <View key={slip.id} style={styles.agentSlipCard}>
                    <View style={styles.matchMeta}><Text style={styles.agentTicketBadge}>Agent 自动票 · {slip.status}</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                    <SlipTeams slip={slip} />
                    <Text style={styles.slipLine}>{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · {slip.odds.toFixed(2)}</Text>
                    <Text style={styles.muted}>主教练裁决：{slip.agentDecision} · 执行：{slip.agentExecution || "按建议执行"} · {slip.agentBaseStake || slip.stake} × {slip.agentMultiplier || 1} 倍 · 投入 {slip.stake} · 潜在返还 {slip.potentialReturn}</Text>
                  </View>
                ))}
                {currentMatchTicketCount === 0 ? <Text style={styles.dataMessage}>本场尚未出票。</Text> : null}
                  </>
                ) : null}
              </>
            ) : <Text style={styles.dataMessage}>请先从真实数据页面进入一场比赛的下单中心。</Text>}
          </>
        ) : null}

        {page === "虚拟模拟" ? (
          <>
            <SectionTitle caption="1 练习币即可开始；快捷档位降低体验门槛；历史和经验永久保留">虚拟模拟单</SectionTitle>
            <WindowTabs value={simulationWindow} onChange={setSimulationWindow} items={[
              ["人机概览", "人机概览"],
              ["建立模拟", "建立模拟"],
              ["我的票据", `我的票据 ${slips.length}`],
              ["Agent 票据", `Agent 票据 ${agentSlips.length}`],
            ]} />
            {simulationWindow === "人机概览" ? (
            <>
            <View style={styles.walletRow}>
              <View><Text style={styles.smallLabel}>可用练习币</Text><Text style={styles.walletValue}>{balance.toLocaleString("zh-CN")}</Text><Text style={styles.walletMeta}>累计补充 {profile.totalGranted.toLocaleString("zh-CN")} · 补币不计盈亏</Text></View>
              <View style={styles.walletStats}>
                <Text style={styles.walletStat}>正式盈亏 {realizedProfitLoss >= 0 ? "+" : ""}{realizedProfitLoss.toFixed(2)}</Text>
                <Text style={styles.walletStat}>复盘盈亏 {replayProfitLoss >= 0 ? "+" : ""}{replayProfitLoss.toFixed(2)}</Text>
                <Text style={styles.walletStat}>待结算敞口 {pendingExposure.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.comparisonPanel}>
              <View style={styles.matchMeta}><Text style={styles.panelTitle}>你与 Agent 的正式模拟表现</Text><Text style={styles.agentTicketBadge}>独立账本</Text></View>
              <Text style={styles.muted}>Agent 在主教练建议执行时按建议仓位出票；建议观望时仍用 {AGENT_EXPLORATION_STAKE} 练习币最低探索仓出票，用真实赛果验证“观望”是否正确。Agent 不占用你的练习币。</Text>
              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>你的累计盈亏</Text><Text style={styles.comparisonValue}>{realizedProfitLoss >= 0 ? "+" : ""}{realizedProfitLoss.toFixed(2)}</Text><Text style={styles.muted}>命中率 {userHitRate.toFixed(1)}% · 已结算 {userSettledSlips.length}</Text></View>
                <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>Agent 累计盈亏</Text><Text style={styles.comparisonValue}>{agentRealizedProfitLoss >= 0 ? "+" : ""}{agentRealizedProfitLoss.toFixed(2)}</Text><Text style={styles.muted}>命中率 {agentHitRate.toFixed(1)}% · 已结算 {agentSettledSlips.length}</Text></View>
              </View>
              <Text style={styles.comparisonDifference}>你相对 Agent：{comparisonDifference >= 0 ? "领先" : "落后"} {Math.abs(comparisonDifference).toFixed(2)} 练习币</Text>
              <Text style={styles.muted}>待结算敞口：你 {pendingExposure.toFixed(2)} · Agent {agentPendingExposure.toFixed(2)}</Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>随意补充练习币</Text>
              <Text style={styles.muted}>补充额度只增加可用余额，永远不计入正式盈亏或复盘盈亏。</Text>
              <View style={styles.grantRow}>
                <TextInput value={grantAmount} onChangeText={setGrantAmount} keyboardType="numeric" style={styles.grantInput} />
                <Pressable style={styles.primaryButtonCompact} onPress={grantPracticeCoins}><Text style={styles.primaryButtonText}>补充练习币</Text></Pressable>
              </View>
              <View style={styles.quickRow}>{[100, 1000, 10000].map((amount) => (
                <Pressable key={amount} onPress={() => setGrantAmount(String(amount))} style={styles.quickChip}><Text style={styles.quickChipText}>+{amount}</Text></Pressable>
              ))}</View>
            </View>
            <Pressable style={styles.primaryButton} onPress={settleNow} disabled={liveDataLoading}>
              <Text style={styles.primaryButtonText}>{liveDataLoading ? "正在核对真实赛果…" : "立即结算所有已结束比赛"}</Text>
            </Pressable>
            </>
            ) : null}

            {simulationWindow === "建立模拟" ? (
            <>
            {replayMatch ? (
              <View style={styles.replayPanel}>
                <Text style={styles.replayBadge}>结果已知 · 模拟补购复盘票</Text>
                <View style={styles.teamsRow}><Team name={replayMatch.home_team} flag={replayMatch.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={replayMatch.away_team} flag={replayMatch.away_team_flag_url} /></View>
                <Text style={styles.matchScore}>{replayMatch.home_score} : {replayMatch.away_score}</Text>
                <Text style={styles.muted}>请选择胜平负结果。以下为固定复盘练习赔率，不冒充比赛开始前真实赔率；本票不计入正式盈亏。</Text>
                <View style={styles.oddsRow}>
                  {([
                    ["home", "主胜", 2.35],
                    ["draw", "平局", 3.2],
                    ["away", "客胜", 2.75],
                  ] as Array<[Selection, string, number]>).map(([value, label, price]) => (
                    <Pressable key={value} onPress={() => setReplaySelection(value)} style={[styles.oddsCell, replaySelection === value && styles.oddsCellSelected]}>
                      <Text style={styles.oddsLabel}>{label}</Text><Text style={styles.oddsValue}>{price.toFixed(2)}</Text><Text style={styles.oddsAction}>{replaySelection === value ? "已选择" : "选择"}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>单注练习币</Text>
                <View style={styles.quickRow}>{[2, 10, 50, 100].map((amount) => (
                  <Pressable key={amount} onPress={() => setReplayStake(String(amount))} style={[styles.quickChip, Number(replayStake) === amount && styles.quickChipActive]}><Text style={[styles.quickChipText, Number(replayStake) === amount && styles.quickChipTextActive]}>{amount} 币</Text></Pressable>
                ))}</View>
                <TextInput value={replayStake} onChangeText={setReplayStake} keyboardType="numeric" style={styles.shortInput} />
                <Text style={styles.muted}>预计返还 {(Number(replayStake || 0) * ({ home: 2.35, draw: 3.2, away: 2.75 }[replaySelection])).toFixed(2)} 练习币</Text>
                <Pressable style={styles.primaryButton} onPress={submitReplay}><Text style={styles.primaryButtonText}>确认模拟补购并立即结算</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setReplayMatch(null)}><Text style={styles.secondaryButtonText}>关闭补购票</Text></Pressable>
              </View>
            ) : null}
            {selectedBet ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{zhTeam(selectedBet.homeTeam)} 对阵 {zhTeam(selectedBet.awayTeam)}</Text>
                <Text style={styles.muted}>{zhDate(selectedBet.kickoffTime)}</Text>
                <View style={styles.selectionSummary}><Text style={styles.selectionTitle}>{selectionNames[selectedBet.selection]}</Text><Text style={styles.selectionOdds}>赔率 {selectedBet.odds.toFixed(2)}</Text></View>
                <Text style={styles.inputLabel}>虚拟投入练习币</Text>
                <View style={styles.quickRow}>
                  {[2, 10, 25, 50, 100].map((amount) => (
                    <Pressable key={amount} onPress={() => setStake(String(amount))} style={[styles.quickChip, stakeNumber === amount && styles.quickChipActive]}>
                      <Text style={[styles.quickChipText, stakeNumber === amount && styles.quickChipTextActive]}>{amount} 币</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={stake} onChangeText={setStake} keyboardType="numeric" style={styles.shortInput} />
                <Text style={styles.muted}>若模拟命中，潜在返还 {potentialReturn.toLocaleString("zh-CN")} 练习币；这不是收益承诺。</Text>
                <Text style={styles.inputLabel}>选择理由（可选，填写可多得 7 点经验）</Text>
                <View style={styles.quickReasonList}>
                  {quickReasons.map((item) => (
                    <Pressable key={item} onPress={() => setReason(item)} style={[styles.reasonChip, reason === item && styles.reasonChipActive]}>
                      <Text style={styles.reasonChipText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={reason} onChangeText={setReason} multiline placeholder="可直接建立模拟单，也可以写下判断依据以增加纪律分。" placeholderTextColor="#8a9591" style={styles.input} />
                <Pressable style={styles.primaryButton} onPress={submitSlip}><Text style={styles.primaryButtonText}>用 {stakeNumber || 0} 练习币立即出票</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setPage("多角色分析")}><Text style={styles.secondaryButtonText}>先让多角色会审</Text></Pressable>
              </View>
            ) : <Text style={styles.dataMessage}>请先到“真实数据”页面选择一个真实赔率。</Text>}
            </>
            ) : null}
            {simulationWindow === "我的票据" ? (
            <>
            <SectionTitle caption="保存在当前设备，可用于赛后复盘">模拟单历史</SectionTitle>
            {slips.length === 0 ? <Text style={styles.dataMessage}>尚未建立模拟单。</Text> : slips.map((slip) => (
              <View key={slip.id} style={styles.slipCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{slip.status}</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                <SlipTeams slip={slip} />
                <Text style={styles.slipLine}>选择：{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · 固定赔率：{slip.odds.toFixed(2)}</Text>
                <Text style={styles.slipLine}>投入：{slip.stake} · 潜在返还：{slip.potentialReturn}</Text>
                <Text style={styles.muted}>理由：{slip.reason}</Text>
                <Text style={styles.muted}>票种：{slip.mode || "赛前模拟"} · 票号：{slip.id}</Text>
                {slip.payout !== undefined ? <Text style={styles.slipLine}>实际返还：{slip.payout} · 获得经验：{slip.experienceEarned}</Text> : <Text style={styles.muted}>建单经验：{slip.experienceEarned || 0}</Text>}
              </View>
            ))}
            </>
            ) : null}
            {simulationWindow === "Agent 票据" ? (
            <>
            <SectionTitle caption={`主教练建议执行时按建议仓位出票；建议观望时用 ${AGENT_EXPLORATION_STAKE} 币最低探索仓出票`}>Agent 自动模拟单历史</SectionTitle>
            {agentSlips.length === 0 ? <Text style={styles.dataMessage}>尚无 Agent 自动票。启动一次真实多角色会审后，Agent 会按建议仓位或最低探索仓自动出票。</Text> : agentSlips.map((slip) => (
              <View key={slip.id} style={styles.agentSlipCard}>
                <View style={styles.matchMeta}><Text style={styles.agentTicketBadge}>Agent 自动票 · {slip.status}</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                <SlipTeams slip={slip} />
                <Text style={styles.slipLine}>{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · 赔率 {slip.odds.toFixed(2)}</Text>
                <Text style={styles.slipLine}>裁决：{slip.agentDecision} · 执行：{slip.agentExecution || "按建议执行"} · {slip.agentBaseStake || slip.stake} × {slip.agentMultiplier || 1} 倍 · 投入 {slip.stake} · 潜在返还 {slip.potentialReturn}</Text>
                <Text style={styles.muted}>理由：{slip.reason}</Text>
                {slip.payout !== undefined ? <Text style={styles.slipLine}>实际返还：{slip.payout} · 本票盈亏：{((slip.payout || 0) - slip.stake).toFixed(2)}</Text> : <Text style={styles.muted}>等待真实赛果结算</Text>}
              </View>
            ))}
            </>
            ) : null}
          </>
        ) : null}

        {page === "Agent 实验室" ? (
          <>
            <SectionTitle caption="Agent 的自动购入、持仓、结算与盈亏全部集中展示">Agent 自动模拟实验室</SectionTitle>
            <WindowTabs value={agentWindow} onChange={setAgentWindow} items={[
              ["总览", "Agent 总览"],
              ["待结算持仓", `待结算 ${agentSlips.filter((item) => item.status === "待结算").length}`],
              ["已结算记录", `已结算 ${agentSettledSlips.length}`],
            ]} />
            {agentWindow === "总览" ? (
              <>
                <View style={styles.agentLabHero}>
                  <View style={styles.matchMeta}><Text style={styles.agentLabTitle}>自动购入规则</Text><Text style={styles.agentTicketBadge}>独立虚拟账本</Text></View>
                  <Text style={styles.agentLabRule}>主教练建议“虚拟买入 / 小仓试验”：Agent 按建议仓位自动购入。</Text>
                  <Text style={styles.agentLabRule}>主教练建议“观望”：Agent 仍使用 {AGENT_EXPLORATION_STAKE} 练习币最低探索仓自动购入，用真实赛果验证观望判断。</Text>
                  <Text style={styles.muted}>Agent 票不会占用你的练习币，也不会混入你的盈亏。</Text>
                </View>
                <View style={styles.panel}>
                  <View style={styles.matchMeta}><Text style={styles.panelTitle}>Agent 自动购入设置</Text><Text style={agentSettings.autoBuyEnabled ? styles.readyText : styles.pendingText}>{agentSettings.autoBuyEnabled ? "自动购入已开启" : "自动购入已关闭"}</Text></View>
                  <Pressable style={agentSettings.autoBuyEnabled ? styles.secondaryButton : styles.primaryButton} onPress={() => void updateAgentSettings({ ...agentSettings, autoBuyEnabled: !agentSettings.autoBuyEnabled })}>
                    <Text style={agentSettings.autoBuyEnabled ? styles.secondaryButtonText : styles.primaryButtonText}>{agentSettings.autoBuyEnabled ? "关闭自动购入" : "开启自动购入"}</Text>
                  </Pressable>
                  <Text style={styles.inputLabel}>Agent 购入倍数</Text>
                  <View style={styles.quickRow}>{[1, 2, 5, 10].map((value) => (
                    <Pressable key={value} onPress={() => void updateAgentSettings({ ...agentSettings, multiplier: value })} style={[styles.quickChip, agentSettings.multiplier === value && styles.quickChipActive]}>
                      <Text style={[styles.quickChipText, agentSettings.multiplier === value && styles.quickChipTextActive]}>{value} 倍</Text>
                    </Pressable>
                  ))}</View>
                  <Text style={styles.inputLabel}>最大单票上限</Text>
                  <View style={styles.quickRow}>{[20, 50, 100, 200, 500].map((value) => (
                    <Pressable key={value} onPress={() => void updateAgentSettings({ ...agentSettings, maxStake: value })} style={[styles.quickChip, agentSettings.maxStake === value && styles.quickChipActive]}>
                      <Text style={[styles.quickChipText, agentSettings.maxStake === value && styles.quickChipTextActive]}>{value} 币</Text>
                    </Pressable>
                  ))}</View>
                  <Text style={styles.muted}>最终投入 = 主教练建议仓位 × {agentSettings.multiplier} 倍，且不超过 {agentSettings.maxStake} 币。观望探索基础仓为 {AGENT_EXPLORATION_STAKE} 币。</Text>
                </View>
                <View style={styles.switchPanel}>
                  <View style={styles.matchMeta}><Text style={styles.panelTitle}>直接为 Agent 选择比赛</Text><Text style={styles.realOddsBadge}>真实胜平负赔率</Text></View>
                  <Text style={styles.muted}>选择一个比赛结果后会直接进入会审；会审完成后按上方设置自动购入。</Text>
                  {odds.length === 0 ? <Pressable style={styles.primaryButton} onPress={loadLiveData}><Text style={styles.primaryButtonText}>加载 2026 真实比赛</Text></Pressable> : futureOdds.length === 0 ? <Text style={styles.dataMessage}>当前赔率列表没有尚未开赛的比赛，Agent 不会建立赛后正式票。</Text> : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchSwitcherRow}>
                      {futureOdds.map((event) => (
                        <View key={event.external_event_id} style={styles.agentSelectionCard}>
                          <View style={styles.switchFlags}><Team name={event.home_team} flag={event.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={event.away_team} flag={event.away_team_flag_url} /></View>
                          <Text style={styles.switchDate}>{zhDate(event.kickoff_time)}</Text>
                          <View style={styles.oddsRow}>{event.selections.map((selection) => (
                            <Pressable key={selection.selection} onPress={() => chooseAgentBet(event, selection)} style={styles.oddsCell}>
                              <Text style={styles.oddsLabel}>{selectionNames[selection.selection]}</Text><Text style={styles.oddsValue}>{selection.odds.toFixed(2)}</Text><Text style={styles.oddsAction}>选择后进入会审</Text>
                            </Pressable>
                          ))}</View>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
                <View style={styles.comparisonPanel}>
                  <Text style={styles.panelTitle}>Agent 当前表现</Text>
                  <View style={styles.comparisonGrid}>
                    <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>累计盈亏</Text><Text style={styles.comparisonValue}>{agentRealizedProfitLoss >= 0 ? "+" : ""}{agentRealizedProfitLoss.toFixed(2)}</Text><Text style={styles.muted}>命中率 {agentHitRate.toFixed(1)}%</Text></View>
                    <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>自动购入总数</Text><Text style={styles.comparisonValue}>{agentSlips.length}</Text><Text style={styles.muted}>待结算 {agentSlips.filter((item) => item.status === "待结算").length}</Text></View>
                  </View>
                  <Text style={styles.slipLine}>观望探索票：{agentSlips.filter((item) => item.agentExecution === "观望探索").length} · 按建议执行票：{agentSlips.filter((item) => item.agentExecution !== "观望探索").length}</Text>
                  <Text style={styles.comparisonDifference}>你相对 Agent：{comparisonDifference >= 0 ? "领先" : "落后"} {Math.abs(comparisonDifference).toFixed(2)} 练习币</Text>
                </View>
                <Pressable style={styles.secondaryButton} onPress={settleNow} disabled={liveDataLoading}><Text style={styles.secondaryButtonText}>{liveDataLoading ? "正在核对真实赛果…" : "立即结算 Agent 已结束比赛"}</Text></Pressable>
              </>
            ) : null}
            {agentWindow === "待结算持仓" ? (
              <>
                {agentSlips.filter((item) => item.status === "待结算").length === 0 ? <Text style={styles.dataMessage}>当前没有待结算 Agent 持仓。进入多角色分析完成会审后，Agent 会自动购入。</Text> : agentSlips.filter((item) => item.status === "待结算").map((slip) => (
                  <View key={slip.id} style={styles.agentSlipCard}>
                    <View style={styles.matchMeta}><Text style={styles.agentTicketBadge}>Agent 持仓 · 待结算</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                    <SlipTeams slip={slip} />
                    <Text style={styles.slipLine}>{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · 赔率 {slip.odds.toFixed(2)}</Text>
                    <Text style={styles.slipLine}>执行：{slip.agentExecution || "按建议执行"} · {slip.agentBaseStake || slip.stake} × {slip.agentMultiplier || 1} 倍 · 投入 {slip.stake} · 潜在返还 {slip.potentialReturn}</Text>
                    <Text style={styles.muted}>裁决：{slip.agentDecision} · {slip.reason}</Text>
                  </View>
                ))}
              </>
            ) : null}
            {agentWindow === "已结算记录" ? (
              <>
                {agentSettledSlips.length === 0 ? <Text style={styles.dataMessage}>尚无已结算 Agent 记录。</Text> : agentSettledSlips.map((slip) => (
                  <View key={slip.id} style={styles.agentSlipCard}>
                    <View style={styles.matchMeta}><Text style={styles.agentTicketBadge}>Agent 记录 · {slip.status}</Text><Text style={styles.muted}>{slip.settledAt ? zhDate(slip.settledAt) : zhDate(slip.createdAt)}</Text></View>
                    <SlipTeams slip={slip} />
                    <Text style={styles.slipLine}>{slip.market || "胜平负"} · {slip.pickLabel || selectionNames[slip.selection]} · 投入 {slip.stake}</Text>
                    <Text style={styles.slipLine}>实际返还 {slip.payout || 0} · 本票盈亏 {((slip.payout || 0) - slip.stake).toFixed(2)}</Text>
                    <Text style={styles.muted}>执行：{slip.agentExecution || "按建议执行"} · {slip.agentBaseStake || slip.stake} × {slip.agentMultiplier || 1} 倍 · 裁决：{slip.agentDecision}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : null}

        {page === "多角色分析" ? (
          <>
            <SectionTitle caption="五类 Agent 从赔率、战术、市场、反方和仓位角度独立会审，主教练输出可执行清单">多角色策略会审</SectionTitle>
            <WindowTabs value={analysisWindow} onChange={setAnalysisWindow} items={[
              ["当前会审", "当前会审"],
              ["人机对比", "人机对比"],
              ["会审历史", `会审历史 ${panelHistory.length}`],
            ]} />
            {analysisWindow === "当前会审" ? (
            <>
            {selectedBet ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{zhTeam(selectedBet.homeTeam)} 对阵 {zhTeam(selectedBet.awayTeam)}</Text>
                <Text style={styles.selectionTitle}>当前选择：{panelPick ? `${panelPick.market} · ${panelPick.label}` : selectionNames[selectedBet.selection]} · 赔率 {selectedBet.odds.toFixed(2)}</Text>
                {panelPick ? <Text style={styles.muted}>本次来自整合下单中心，会审聚焦当前首选项，同时评估替代票型与禁买点。</Text> : null}
                <Pressable style={styles.primaryButton} onPress={runPanel} disabled={panelLoading}><Text style={styles.primaryButtonText}>{panelLoading ? "五类 Agent 正在会审…" : "启动五类 Agent 会审"}</Text></Pressable>
              </View>
            ) : <Text style={styles.dataMessage}>请先到“真实数据”页面选择一个赔率，才能启动会审。</Text>}
            {panelLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {panel?.agents.map((agent) => (
              <View key={agent.agent_name} style={styles.agentCard}>
                <View style={styles.matchMeta}><Text style={styles.agentName}>{agent.agent_name}</Text><Text style={styles.confidence}>信心 {agent.confidence}%</Text></View>
                <Text style={styles.agentPersonality}>人格：{agent.personality}</Text>
                <Text style={styles.muted}>任务：{agent.task}</Text>
                <Text style={styles.agentConclusion}>{agent.conclusion}</Text>
                {agent.evidence.map((item) => <Text key={item} style={styles.agentEvidence}>• {item}</Text>)}
              </View>
            ))}
            {panel ? (
              <View style={styles.coordinatorCard}>
                <Text style={styles.learningLabel}>主教练·裁决官</Text>
                <Text style={styles.learningLabel}>最终虚拟行动建议</Text>
                <Text style={styles.coordinatorDecision}>{panel.coordinator.decision}</Text>
                {panel.coordinator.opportunity_tags?.length ? (
                  <View style={styles.coordinatorTagRow}>
                    {panel.coordinator.opportunity_tags.map((item) => <Text key={item} style={styles.coordinatorTag}>{item}</Text>)}
                  </View>
                ) : null}
                <Text style={styles.learningSummary}>{panel.coordinator.summary}</Text>
                <Text style={styles.learningLabel}>行动理由</Text><Text style={styles.learningSummary}>{panel.coordinator.action_reason}</Text>
                {panel.coordinator.preferred_ticket_structure ? (
                  <>
                    <Text style={styles.learningLabel}>建议票型结构</Text><Text style={styles.learningSummary}>{panel.coordinator.preferred_ticket_structure}</Text>
                  </>
                ) : null}
                {panel.coordinator.action_checklist?.length ? (
                  <>
                    <Text style={styles.learningLabel}>执行清单</Text>
                    {panel.coordinator.action_checklist.map((item) => <Text key={item} style={styles.coordinatorCheck}>• {item}</Text>)}
                  </>
                ) : null}
                <Text style={styles.learningLabel}>执行条件</Text><Text style={styles.learningSummary}>{panel.coordinator.entry_condition}</Text>
                {panel.coordinator.alternative_view ? (
                  <>
                    <Text style={styles.learningLabel}>反手或替代方案</Text><Text style={styles.learningSummary}>{panel.coordinator.alternative_view}</Text>
                  </>
                ) : null}
                {panel.coordinator.avoid_list?.length ? (
                  <>
                    <Text style={styles.learningLabel}>不要买的情形</Text>
                    {panel.coordinator.avoid_list.map((item) => <Text key={item} style={styles.coordinatorCheck}>• {item}</Text>)}
                  </>
                ) : null}
                <Text style={styles.learningLabel}>核心分歧</Text><Text style={styles.learningSummary}>{panel.coordinator.disagreements}</Text>
                <Text style={styles.learningLabel}>建议投入 / 仓位上限</Text><Text style={styles.coordinatorLimit}>{panel.coordinator.recommended_virtual_stake} / {panel.coordinator.virtual_stake_limit} 练习币</Text>
                <Text style={styles.exercise}>复盘问题：{panel.coordinator.review_question}</Text>
                <Text style={styles.exercise}>{panel.coordinator.decision === "建议观望" ? `Agent 执行结果：保留观望裁决，同时用 ${AGENT_EXPLORATION_STAKE} 练习币最低探索仓自动出票。` : "Agent 执行结果：会审完成后按建议仓位自动建立独立模拟票。"}</Text>
                <Text style={styles.exercise}>当前 Agent 设置：{agentSettings.autoBuyEnabled ? "自动购入开启" : "自动购入关闭"} · {agentSettings.multiplier} 倍 · 单票上限 {agentSettings.maxStake} 币</Text>
                <Pressable style={styles.lightButton} onPress={() => void executeCurrentPanelForAgent()}><Text style={styles.lightButtonText}>按当前设置手动执行 Agent 购入</Text></Pressable>
                <Pressable style={styles.lightButton} onPress={() => { setAgentWindow("待结算持仓"); setPage("Agent 实验室"); }}><Text style={styles.lightButtonText}>查看 Agent 待结算持仓</Text></Pressable>
                {panel.coordinator.recommended_virtual_stake > 0 ? (
                  <Pressable style={styles.lightButton} onPress={() => {
                    setStake(String(panel.coordinator.recommended_virtual_stake));
                    setReason(panel.coordinator.action_reason);
                    setPage("虚拟模拟");
                  }}><Text style={styles.lightButtonText}>按建议金额立即出票</Text></Pressable>
                ) : <Text style={styles.warning}>本次主教练明确建议观望，因此不会建议你出票；Agent 会独立使用最低探索仓验证该判断。</Text>}
              </View>
            ) : null}
            </>
            ) : null}
            {analysisWindow === "人机对比" ? (
            <View style={styles.comparisonPanel}>
              <Text style={styles.panelTitle}>人机模拟表现对比</Text>
              <Text style={styles.slipLine}>你：盈亏 {realizedProfitLoss >= 0 ? "+" : ""}{realizedProfitLoss.toFixed(2)} · 命中率 {userHitRate.toFixed(1)}% · 已结算 {userSettledSlips.length}</Text>
              <Text style={styles.slipLine}>Agent：盈亏 {agentRealizedProfitLoss >= 0 ? "+" : ""}{agentRealizedProfitLoss.toFixed(2)} · 命中率 {agentHitRate.toFixed(1)}% · 已结算 {agentSettledSlips.length}</Text>
              <Text style={styles.comparisonDifference}>你相对 Agent：{comparisonDifference >= 0 ? "领先" : "落后"} {Math.abs(comparisonDifference).toFixed(2)} 练习币</Text>
            </View>
            ) : null}
            {analysisWindow === "会审历史" ? (
            <>
            <SectionTitle caption="永久保存在当前设备，可重新查看角色观点和最终建议">会审历史</SectionTitle>
            {panelHistory.length === 0 ? <Text style={styles.dataMessage}>尚无会审历史。</Text> : panelHistory.map((item) => (
              <Pressable key={item.id} style={styles.historyCard} onPress={() => { setSelectedBet(item.bet); setPanel(item.panel); setPanelPick(null); setAnalysisWindow("当前会审"); }}>
                <View style={styles.matchMeta}><Text style={styles.panelTitle}>{zhTeam(item.bet.homeTeam)} 对阵 {zhTeam(item.bet.awayTeam)}</Text><Text style={styles.muted}>{zhDate(item.createdAt)}</Text></View>
                <Text style={styles.slipLine}>{selectionNames[item.bet.selection]} · 赔率 {item.bet.odds.toFixed(2)} · {item.panel.coordinator.decision}</Text>
                <Text numberOfLines={2} style={styles.muted}>{item.panel.coordinator.action_reason}</Text>
              </Pressable>
            ))}
            </>
            ) : null}
          </>
        ) : null}

        {page === "学习助手" ? (
          <>
            <SectionTitle caption="真实人工智能生成讲解、练习与参考答案">中文学习助手</SectionTitle>
            <WindowTabs value={learningWindow} onChange={setLearningWindow} items={[
              ["开始学习", "开始学习"],
              ["学习结果", "学习结果"],
              ["学习历史", `学习历史 ${learningHistory.length}`],
            ]} />
            {learningWindow === "开始学习" ? (
            <View style={styles.panel}>
              <Text style={styles.inputLabel}>你今天想学习什么？</Text>
              <View style={styles.topicList}>{topics.map((item) => (
                <Pressable key={item} onPress={() => setTopic(item)} style={[styles.topicChip, topic === item && styles.topicChipActive]}><Text style={[styles.topicText, topic === item && styles.topicTextActive]}>{item}</Text></Pressable>
              ))}</View>
              <TextInput value={topic} onChangeText={setTopic} multiline style={styles.input} />
              <Pressable style={styles.primaryButton} onPress={generateLearningGuide} disabled={aiLoading}><Text style={styles.primaryButtonText}>{aiLoading ? "正在生成…" : "生成学习讲解"}</Text></Pressable>
            </View>
            ) : null}
            {aiLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {learningWindow === "学习结果" ? (learning ? <LearningCard result={learning} /> : <Text style={styles.dataMessage}>尚无学习结果，请先在“开始学习”窗口生成讲解。</Text>) : null}
            {learningWindow === "学习历史" ? (
            <>
            <SectionTitle caption="保存在当前设备，最多 20 条">学习历史</SectionTitle>
            {learningHistory.length === 0 ? <Text style={styles.dataMessage}>尚无学习历史。</Text> : learningHistory.map((item, index) => (
              <Pressable key={`${item.topic}-${index}`} style={styles.historyCard} onPress={() => { setLearning(item); setLearningWindow("学习结果"); }}><Text style={styles.panelTitle}>{item.topic}</Text><Text numberOfLines={2} style={styles.muted}>{item.summary}</Text></Pressable>
            ))}
            </>
            ) : null}
          </>
        ) : null}

        {page === "系统状态" ? (
          <>
            <SectionTitle caption="只展示真实配置结果">系统状态</SectionTitle>
            <WindowTabs value={systemWindow} onChange={setSystemWindow} items={[["核心服务", "核心服务"], ["数据源状态", "数据源状态"]]} />
            {loading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {config && health ? <View style={styles.panel}>
              {systemWindow === "核心服务" ? (
              <>
              <StatusRow title="数据库服务" configured={health.database_connected} detail={`已记录 ${health.case_count} 条验证与人工智能调用数据`} />
              <StatusRow title="人工智能服务" configured={health.deepseek_configured} detail="用于学习助手与多角色策略会审" />
              </>
              ) : null}
              {systemWindow === "数据源状态" ? (
              <>
              <StatusRow title="真实赛程与赛果" configured={config.sports_data.configured} detail={config.sports_data.message} />
              <StatusRow title="真实胜平负赔率" configured={config.odds_data.configured} detail={config.odds_data.message} />
              </>
              ) : null}
            </View> : null}
          </>
        ) : null}

        {page === "使用说明" ? (
          <>
            <SectionTitle caption="当前版本已具备真实数据到虚拟复盘的完整路径">使用说明</SectionTitle>
            <WindowTabs value={guideWindow} onChange={setGuideWindow} items={[["操作步骤", "操作步骤"], ["数据与合规", "数据与合规"]]} />
            {guideWindow === "操作步骤" ? (
            <View style={styles.panel}>
              {[
                ["第一步", "打开真实数据，选择一场 2026 世界杯比赛的真实胜平负赔率。"],
                ["第二步", "建立虚拟模拟单，输入练习币与选择理由。"],
                ["第三步", "启动多角色会审，比较数据、反方与风险观点。"],
                ["第四步", "保存模拟单并在赛后根据真实赛果复盘。"],
                ["第五步", "使用学习助手完成练习，并对照参考答案。"],
              ].map(([step, text]) => <View key={step} style={styles.guideRow}><Text style={styles.guideStep}>{step}</Text><Text style={styles.guideText}>{text}</Text></View>)}
            </View>
            ) : null}
            {guideWindow === "数据与合规" ? (
            <View style={styles.notice}><Text style={styles.noticeTitle}>数据边界与合规边界</Text><Text style={styles.noticeText}>当前主赛事为 2026 世界杯，包含当前赔率、未来赛程与实时/近期比分。2022 完整赛果仅作为历史复盘档案。更早四届仍需新增具备相应权限的数据源。产品只使用虚拟练习币，不提供充值、提现、支付或真实投注。</Text></View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.footer}>2026 世界杯纸上竞猜 · 中文虚拟策略学习产品</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function LearningCard({ result }: { result: LearningResult }) {
  return (
    <View style={styles.learningCard}>
      <Text style={styles.learningLabel}>本次主题</Text><Text style={styles.learningTitle}>{result.topic}</Text><Text style={styles.learningSummary}>{result.summary}</Text>
      <Text style={styles.learningLabel}>关键要点</Text>{result.key_points.map((item) => <Text key={item} style={styles.learningPoint}>• {item}</Text>)}
      <Text style={styles.learningLabel}>练习任务</Text><Text style={styles.exercise}>{result.practical_exercise}</Text>
      <Text style={styles.learningLabel}>参考答案</Text><Text style={styles.answer}>{result.reference_answer}</Text>
      <Text style={styles.warning}>{result.risk_warning}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f0e9" },
  pageScroll: { flex: 1 },
  container: { width: "100%", maxWidth: 780, alignSelf: "center", padding: 20, gap: 17 },
  flex: { flex: 1, gap: 4 },
  brandBlock: { gap: 8, paddingTop: 18 },
  eyebrow: { color: "#0d685a", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  brandTitle: { color: "#102c28", fontSize: 32, lineHeight: 40, fontWeight: "900" },
  brandSubtitle: { color: "#53635f", fontSize: 15, lineHeight: 23, maxWidth: 660 },
  nav: { backgroundColor: "#e6e3da", borderRadius: 16, padding: 4, gap: 4 },
  navItem: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  navItemActive: { backgroundColor: "#ffffff" },
  navText: { color: "#62706c", fontWeight: "700" },
  navTextActive: { color: "#0d685a" },
  hero: { backgroundColor: "#173e37", borderRadius: 24, padding: 24, gap: 10 },
  heroLabel: { color: "#8dd1c3", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  heroBalance: { color: "#ffffff", fontSize: 34, fontWeight: "900" },
  heroText: { color: "#d8e7e3", fontSize: 14, lineHeight: 22 },
  progressTrack: { height: 7, backgroundColor: "#31564f", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 7, backgroundColor: "#8dd1c3", borderRadius: 99 },
  lightButton: { backgroundColor: "#ffffff", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 5 },
  lightButtonText: { color: "#0d685a", fontWeight: "900" },
  primaryButton: { backgroundColor: "#0d7565", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4 },
  primaryButtonCompact: { backgroundColor: "#0d7565", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderColor: "#9eb7b1", borderRadius: 13, padding: 12, alignItems: "center" },
  secondaryButtonText: { color: "#0d685a", fontWeight: "800" },
  sectionHeading: { gap: 3, marginTop: 4 },
  sectionTitle: { color: "#173e37", fontSize: 22, fontWeight: "900" },
  sectionCaption: { color: "#75817e", fontSize: 12 },
  featureCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 18, gap: 7 },
  featureNumber: { color: "#0d7565", fontWeight: "900", fontSize: 12, letterSpacing: 1.4 },
  featureTitle: { color: "#173e37", fontSize: 17, fontWeight: "800" },
  muted: { color: "#66736f", fontSize: 13, lineHeight: 20 },
  notice: { backgroundColor: "#fff0bd", borderRadius: 16, padding: 17, gap: 5 },
  noticeTitle: { color: "#563e08", fontWeight: "800", fontSize: 15 },
  noticeText: { color: "#6e571f", fontSize: 13, lineHeight: 20 },
  archiveNotice: { backgroundColor: "#edf1f0", borderWidth: 1, borderColor: "#c9d1ce", borderRadius: 16, padding: 16, gap: 5 },
  archiveNoticeTitle: { color: "#43534f", fontWeight: "900", fontSize: 14 },
  panel: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 20, padding: 18, gap: 14 },
  panelTitle: { color: "#173e37", fontSize: 16, fontWeight: "900" },
  inputLabel: { color: "#173e37", fontSize: 14, fontWeight: "800" },
  input: { minHeight: 82, borderWidth: 1, borderColor: "#d4d8d5", borderRadius: 14, padding: 13, color: "#173e37", fontSize: 15, textAlignVertical: "top" },
  shortInput: { borderWidth: 1, borderColor: "#d4d8d5", borderRadius: 14, padding: 13, color: "#173e37", fontSize: 18, fontWeight: "800" },
  topicList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: { borderWidth: 1, borderColor: "#cbd4d1", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  topicChipActive: { backgroundColor: "#d9eee8", borderColor: "#8dc9bd" },
  topicText: { color: "#66736f", fontSize: 12, fontWeight: "700" },
  topicTextActive: { color: "#0d685a" },
  dataMessage: { color: "#815b0c", backgroundColor: "#f7e8c8", borderRadius: 14, padding: 14, lineHeight: 20 },
  matchCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 17, gap: 12 },
  matchMeta: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  matchStage: { color: "#0d7565", fontWeight: "800", fontSize: 12 },
  teamsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  teamBlock: { flex: 1, alignItems: "center", gap: 7 },
  flag: { width: 42, height: 28, borderRadius: 4, resizeMode: "cover", backgroundColor: "#e6e3da" },
  flagPlaceholder: { width: 42, height: 28, borderRadius: 4, backgroundColor: "#e6e3da" },
  teamName: { color: "#173e37", fontSize: 14, fontWeight: "900", textAlign: "center" },
  versus: { color: "#87918e", fontSize: 12, fontWeight: "700" },
  matchScore: { color: "#0d685a", fontSize: 24, fontWeight: "900" },
  oddsRow: { flexDirection: "row", gap: 8 },
  oddsCell: { flex: 1, backgroundColor: "#e7f2ef", borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  oddsCellSelected: { backgroundColor: "#bce4da", borderWidth: 2, borderColor: "#0d7565" },
  oddsLabel: { color: "#56706a", fontSize: 11, fontWeight: "700" },
  oddsValue: { color: "#0d685a", fontSize: 17, fontWeight: "900" },
  oddsAction: { color: "#0d685a", fontSize: 10, fontWeight: "800", marginTop: 3 },
  walletRow: { backgroundColor: "#173e37", borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  smallLabel: { color: "#8dd1c3", fontSize: 11, fontWeight: "800" },
  walletValue: { color: "#ffffff", fontSize: 28, fontWeight: "900" },
  walletMeta: { color: "#b7d4cd", fontSize: 11, marginTop: 4 },
  walletStats: { alignItems: "flex-end", gap: 5 },
  walletStat: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  grantRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  grantInput: { flex: 1, borderWidth: 1, borderColor: "#d4d8d5", borderRadius: 12, padding: 12, color: "#173e37", fontSize: 16, fontWeight: "800" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: { borderWidth: 1, borderColor: "#b8c8c4", backgroundColor: "#ffffff", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipActive: { backgroundColor: "#0d7565", borderColor: "#0d7565" },
  quickChipText: { color: "#0d685a", fontSize: 12, fontWeight: "800" },
  quickChipTextActive: { color: "#ffffff" },
  quickReasonList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  reasonChip: { backgroundColor: "#eef4f2", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  reasonChipActive: { backgroundColor: "#d9eee8", borderWidth: 1, borderColor: "#0d7565" },
  reasonChipText: { color: "#45645d", fontSize: 11, fontWeight: "700" },
  replayPanel: { backgroundColor: "#fff8df", borderWidth: 2, borderColor: "#d4a632", borderRadius: 20, padding: 18, gap: 13 },
  replayBadge: { color: "#654800", backgroundColor: "#ffe49a", alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  orderHero: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 22, padding: 19, gap: 13 },
  windowTabs: { flexDirection: "row", flexWrap: "wrap", gap: 7, backgroundColor: "#e6e3da", borderRadius: 16, padding: 5 },
  windowTab: { flexGrow: 1, minWidth: 120, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, alignItems: "center" },
  windowTabActive: { backgroundColor: "#173e37" },
  windowTabText: { color: "#66736f", fontSize: 12, fontWeight: "900" },
  windowTabTextActive: { color: "#ffffff" },
  marketWindowTabs: { flexDirection: "row", gap: 6, backgroundColor: "#f0ede5", borderRadius: 14, padding: 5 },
  marketWindowTab: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  marketWindowTabActive: { backgroundColor: "#0d7565" },
  marketWindowTabText: { color: "#66736f", fontSize: 11, fontWeight: "900" },
  marketWindowTabTextActive: { color: "#ffffff" },
  switchPanel: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 16, gap: 12 },
  matchSwitcherRow: { gap: 9, paddingRight: 10 },
  matchSwitcherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  matchSwitcherCard: { width: 250, maxWidth: "100%", backgroundColor: "#eef4f2", borderWidth: 1, borderColor: "#d7e0dd", borderRadius: 14, padding: 12, gap: 8 },
  agentSelectionCard: { width: 330, backgroundColor: "#eef4f2", borderWidth: 1, borderColor: "#d7e0dd", borderRadius: 14, padding: 12, gap: 10 },
  matchSwitcherCardActive: { borderColor: "#0d7565", borderWidth: 3, backgroundColor: "#d9eee8" },
  switchFlags: { flexDirection: "row", alignItems: "center", gap: 5 },
  switchDate: { color: "#66736f", fontSize: 11, textAlign: "center" },
  switchScore: { color: "#0d685a", fontSize: 20, fontWeight: "900", textAlign: "center" },
  marketCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 16, gap: 12 },
  marketTitle: { color: "#173e37", fontSize: 17, fontWeight: "900" },
  realOddsBadge: { color: "#0d685a", backgroundColor: "#d9eee8", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  practiceOddsBadge: { color: "#815b0c", backgroundColor: "#f7e8c8", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  handicapRow: { gap: 7, borderTopWidth: 1, borderTopColor: "#ebe8df", paddingTop: 10 },
  handicapLabel: { color: "#173e37", fontWeight: "800", fontSize: 12 },
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  scoreCell: { minWidth: 67, flexGrow: 1, backgroundColor: "#eef4f2", borderWidth: 1, borderColor: "#d7e0dd", borderRadius: 10, padding: 9, alignItems: "center", gap: 2 },
  scoreCellSelected: { backgroundColor: "#bce4da", borderColor: "#0d7565", borderWidth: 2 },
  scoreLabel: { color: "#173e37", fontSize: 13, fontWeight: "900" },
  scoreOdds: { color: "#0d685a", fontSize: 11, fontWeight: "800" },
  orderSummary: { backgroundColor: "#f8f5e9", borderWidth: 2, borderColor: "#173e37", borderRadius: 20, padding: 18, gap: 12 },
  orderTotal: { color: "#173e37", fontSize: 22, fontWeight: "900" },
  orderLine: { flexDirection: "row", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: "#dedbd1", paddingTop: 8 },
  orderLineText: { color: "#173e37", flex: 1, fontSize: 12, fontWeight: "800" },
  orderReturn: { color: "#0d685a", fontSize: 12, fontWeight: "900" },
  ticketStatsPanel: { backgroundColor: "#fffdf8", borderWidth: 2, borderColor: "#0d7565", borderRadius: 20, padding: 16, gap: 12 },
  ticketStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  ticketStatCard: { flexGrow: 1, minWidth: 150, backgroundColor: "#e7f2ef", borderRadius: 13, padding: 12, gap: 4 },
  ticketStatLabel: { color: "#56706a", fontSize: 11, fontWeight: "900" },
  ticketStatValue: { color: "#173e37", fontSize: 20, fontWeight: "900" },
  marketPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  marketPill: { color: "#0d685a", backgroundColor: "#d9eee8", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  inlineAdvice: { backgroundColor: "#d9eee8", borderRadius: 12, padding: 12, gap: 4 },
  selectionSummary: { backgroundColor: "#d9eee8", padding: 13, borderRadius: 12, flexDirection: "row", justifyContent: "space-between" },
  selectionTitle: { color: "#173e37", fontWeight: "900" },
  selectionOdds: { color: "#0d685a", fontWeight: "900" },
  slipCard: { backgroundColor: "#fffdf8", borderLeftWidth: 5, borderLeftColor: "#0d7565", borderRadius: 14, padding: 16, gap: 7 },
  agentSlipCard: { backgroundColor: "#edf5ff", borderLeftWidth: 5, borderLeftColor: "#315f9b", borderRadius: 14, padding: 16, gap: 9 },
  agentTicketBadge: { color: "#244d83", backgroundColor: "#dceaff", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontWeight: "900", fontSize: 11 },
  agentLabHero: { backgroundColor: "#173e37", borderRadius: 22, padding: 20, gap: 10 },
  agentLabTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  agentLabRule: { color: "#d8e7e3", fontSize: 13, lineHeight: 21, fontWeight: "700" },
  slipLine: { color: "#173e37", fontWeight: "800" },
  comparisonPanel: { backgroundColor: "#fffdf8", borderWidth: 2, borderColor: "#315f9b", borderRadius: 20, padding: 18, gap: 12 },
  comparisonGrid: { flexDirection: "row", gap: 9 },
  comparisonCard: { flex: 1, backgroundColor: "#edf5ff", borderRadius: 14, padding: 13, gap: 5 },
  comparisonLabel: { color: "#36516e", fontSize: 11, fontWeight: "800" },
  comparisonValue: { color: "#173e37", fontSize: 22, fontWeight: "900" },
  comparisonDifference: { color: "#244d83", fontSize: 15, fontWeight: "900" },
  agentCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 17, gap: 9 },
  agentName: { color: "#0d685a", fontWeight: "900", fontSize: 16 },
  confidence: { color: "#815b0c", backgroundColor: "#f7e8c8", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontWeight: "800", fontSize: 11 },
  agentPersonality: { color: "#173e37", fontWeight: "800", fontSize: 13 },
  agentConclusion: { color: "#173e37", fontSize: 14, lineHeight: 22 },
  agentEvidence: { color: "#566762", fontSize: 13, lineHeight: 20 },
  coordinatorCard: { backgroundColor: "#173e37", borderRadius: 22, padding: 20, gap: 11 },
  coordinatorDecision: { color: "#ffffff", fontSize: 25, fontWeight: "900" },
  coordinatorLimit: { color: "#8dd1c3", fontSize: 22, fontWeight: "900" },
  coordinatorTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  coordinatorTag: { color: "#173e37", backgroundColor: "#bce4da", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  coordinatorCheck: { color: "#ffffff", backgroundColor: "#31564f", borderRadius: 12, padding: 11, lineHeight: 19, fontWeight: "700" },
  learningCard: { backgroundColor: "#173e37", borderRadius: 22, padding: 20, gap: 11 },
  learningLabel: { color: "#8dd1c3", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginTop: 4 },
  learningTitle: { color: "#ffffff", fontSize: 22, lineHeight: 29, fontWeight: "900" },
  learningSummary: { color: "#dcebe7", fontSize: 14, lineHeight: 22 },
  learningPoint: { color: "#ffffff", fontSize: 13, lineHeight: 21 },
  exercise: { color: "#173e37", backgroundColor: "#d9eee8", borderRadius: 12, padding: 13, lineHeight: 20 },
  answer: { color: "#173e37", backgroundColor: "#ffffff", borderRadius: 12, padding: 13, lineHeight: 20 },
  warning: { color: "#573f08", backgroundColor: "#fff0bd", borderRadius: 12, padding: 13, lineHeight: 20, fontWeight: "700" },
  historyCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 14, padding: 15, gap: 5 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#ebe8df", paddingBottom: 15 },
  statusTitle: { color: "#173e37", fontSize: 15, fontWeight: "800" },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  badgeReady: { backgroundColor: "#d9eee8" },
  badgePending: { backgroundColor: "#f7e8c8" },
  readyText: { color: "#0d685a", fontWeight: "800", fontSize: 12 },
  pendingText: { color: "#815b0c", fontWeight: "800", fontSize: 12 },
  guideRow: { gap: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ebe8df" },
  guideStep: { color: "#0d7565", fontSize: 12, fontWeight: "900" },
  guideText: { color: "#3f504c", fontSize: 14, lineHeight: 21 },
  error: { color: "#9a2d22", backgroundColor: "#fff1ef", borderRadius: 14, padding: 14, fontWeight: "700" },
  success: { color: "#0d685a", backgroundColor: "#d9eee8", borderRadius: 14, padding: 14, fontWeight: "800" },
  footer: { color: "#87918e", fontSize: 11, textAlign: "center", marginVertical: 12 },
});
