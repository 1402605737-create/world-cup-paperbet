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

type Page = "首页" | "真实数据" | "虚拟模拟" | "多角色分析" | "学习助手" | "系统状态" | "使用说明";
type Selection = "home" | "draw" | "away";

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
  status: "待结算";
  createdAt: string;
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
    decision: "支持该选择" | "建议观望";
    summary: string;
    disagreements: string;
    virtual_stake_limit: number;
    review_question: string;
  };
  fallback: false;
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
};

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

function SectionTitle({ children, caption }: { children: string; caption?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
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
  const [stake, setStake] = useState("100");
  const [reason, setReason] = useState("");
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [slips, setSlips] = useState<PracticeSlip[]>([]);
  const [topic, setTopic] = useState(topics[0]);
  const [learning, setLearning] = useState<LearningResult | null>(null);
  const [learningHistory, setLearningHistory] = useState<LearningResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [panel, setPanel] = useState<StrategyPanel | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  const stakeNumber = Number(stake) || 0;
  const potentialReturn = selectedBet ? Math.round(stakeNumber * selectedBet.odds * 100) / 100 : 0;

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
      const [savedBalance, savedSlips, savedLearning] = await Promise.all([
        AsyncStorage.getItem(storageKeys.balance),
        AsyncStorage.getItem(storageKeys.slips),
        AsyncStorage.getItem(storageKeys.learning),
      ]);
      if (savedBalance) setBalance(Number(savedBalance));
      if (savedSlips) setSlips(JSON.parse(savedSlips));
      if (savedLearning) setLearningHistory(JSON.parse(savedLearning));
    })();
  }, [loadStatus]);

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
      else setOddsMessage(oddsPayload.error || "本届真实赔率暂不可用");
      if (scoresResponse.ok) setCurrentScores(scoresPayload.scores || []);
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
    setReason("");
    setStake("100");
    setPage("虚拟模拟");
    setSuccess("");
  };

  const submitSlip = async () => {
    if (!selectedBet) return setError("请先从真实赔率中选择一个结果。");
    if (stakeNumber <= 0 || stakeNumber > MAX_STAKE) return setError(`单次模拟投入必须为 1 至 ${MAX_STAKE} 练习币。`);
    if (stakeNumber > balance) return setError("练习币余额不足。");
    if (!reason.trim()) return setError("请先写下选择理由，便于赛后复盘。");
    const slip: PracticeSlip = {
      ...selectedBet,
      id: `${selectedBet.eventId}-${Date.now()}`,
      stake: stakeNumber,
      potentialReturn,
      reason: reason.trim(),
      status: "待结算",
      createdAt: new Date().toISOString(),
    };
    const nextSlips = [slip, ...slips].slice(0, 50);
    const nextBalance = balance - stakeNumber;
    setSlips(nextSlips);
    setBalance(nextBalance);
    setError("");
    setSuccess("虚拟模拟单已建立，并已保存到当前设备。");
    await Promise.all([
      AsyncStorage.setItem(storageKeys.slips, JSON.stringify(nextSlips)),
      AsyncStorage.setItem(storageKeys.balance, String(nextBalance)),
    ]);
  };

  const resetPractice = async () => {
    setBalance(INITIAL_BALANCE);
    setSlips([]);
    setSelectedBet(null);
    setSuccess("练习账户已重置。");
    await Promise.all([
      AsyncStorage.setItem(storageKeys.balance, String(INITIAL_BALANCE)),
      AsyncStorage.setItem(storageKeys.slips, "[]"),
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
      setLearningHistory(nextHistory);
      await AsyncStorage.setItem(storageKeys.learning, JSON.stringify(nextHistory));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "学习内容生成失败");
    } finally {
      setAiLoading(false);
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "多角色分析失败");
    } finally {
      setPanelLoading(false);
    }
  };

  const pendingExposure = useMemo(() => slips.reduce((sum, item) => sum + item.stake, 0), [slips]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>世界杯纸上竞猜</Text>
          <Text style={styles.brandTitle}>真实赔率驱动的虚拟策略实验室</Text>
          <Text style={styles.brandSubtitle}>选择真实比赛赔率，用练习币建立模拟单，再让不同人格的人工智能角色共同审查。全程不涉及真实资金。</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {(["首页", "真实数据", "虚拟模拟", "多角色分析", "学习助手", "系统状态", "使用说明"] as Page[]).map((item) => (
            <Pressable key={item} onPress={() => openPage(item)} style={[styles.navItem, page === item && styles.navItemActive]}>
              <Text style={[styles.navText, page === item && styles.navTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {page === "首页" ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>今日账户</Text>
              <Text style={styles.heroBalance}>{balance.toLocaleString("zh-CN")} 练习币</Text>
              <Text style={styles.heroText}>已建立 {slips.length} 张模拟单，待结算虚拟投入 {pendingExposure.toLocaleString("zh-CN")} 练习币。</Text>
              <Pressable style={styles.lightButton} onPress={() => openPage("真实数据")}><Text style={styles.lightButtonText}>从真实赔率开始模拟</Text></Pressable>
            </View>
            <SectionTitle caption="从选择、质疑到复盘，形成完整学习闭环">核心流程</SectionTitle>
            {[
              ["01", "选择真实赔率", "查看本届真实赛程赔率与球队国旗，选择主胜、平局或客胜。", "真实数据"],
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

        {page === "真实数据" ? (
          <>
            <SectionTitle caption="赛事供应商每日同步历史赛果；赔率供应商提供本届当前赔率">真实世界杯数据</SectionTitle>
            <Pressable style={styles.primaryButton} onPress={loadLiveData} disabled={liveDataLoading}><Text style={styles.primaryButtonText}>{liveDataLoading ? "正在刷新…" : "刷新真实数据"}</Text></Pressable>
            {liveDataLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>真实覆盖范围</Text>
              <Text style={styles.noticeText}>当前已验证：2022 年世界杯完整赛果 64 场，本届世界杯当前真实赔率、未来赛程，以及本届实时/近三天比分接口。赛事供应商免费套餐不提供更早四届，因此系统不会伪造“近五届”。</Text>
            </View>
            {matchesMessage ? <Text style={styles.dataMessage}>{matchesMessage}</Text> : null}
            {oddsMessage ? <Text style={styles.dataMessage}>{oddsMessage}</Text> : null}
            <SectionTitle caption={`${odds.length} 场可用于虚拟模拟`}>本届当前真实赔率</SectionTitle>
            {odds.map((item) => (
              <View key={item.external_event_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>胜平负赔率</Text><Text style={styles.muted}>{zhDate(item.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={item.home_team} flag={item.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={item.away_team} flag={item.away_team_flag_url} /></View>
                <View style={styles.oddsRow}>
                  {item.selections.map((selection) => (
                    <Pressable key={selection.selection} style={styles.oddsCell} onPress={() => chooseBet(item, selection)}>
                      <Text style={styles.oddsLabel}>{selectionNames[selection.selection]}</Text>
                      <Text style={styles.oddsValue}>{selection.odds.toFixed(2)}</Text>
                      <Text style={styles.oddsAction}>选择并模拟</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <SectionTitle caption={`${currentScores.length} 场本届赛事；比分由数据源实时返回，近三天赛果可查询`}>本届实时与近期比分</SectionTitle>
            {currentScores.length === 0 ? <Text style={styles.dataMessage}>当前比分接口暂未返回比赛；开赛后刷新即可查看实时与近三天赛果。</Text> : currentScores.map((match) => (
              <View key={match.external_event_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{match.completed ? "已完赛" : "未完赛或进行中"}</Text><Text style={styles.muted}>{zhDate(match.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={match.home_team} flag={match.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={match.away_team} flag={match.away_team_flag_url} /></View>
                {match.home_score !== null && match.away_score !== null ? <Text style={styles.matchScore}>{match.home_score} : {match.away_score}</Text> : <Text style={styles.muted}>尚无比分</Text>}
                {match.last_update ? <Text style={styles.muted}>数据更新时间：{zhDate(match.last_update)}</Text> : null}
              </View>
            ))}
            <SectionTitle caption={`${matches.length} 场真实已完赛记录`}>2022 年世界杯历史赛果</SectionTitle>
            {matches.map((match) => (
              <View key={match.external_match_id} style={styles.matchCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{zhStage(match.stage)}</Text><Text style={styles.muted}>{zhDate(match.kickoff_time)}</Text></View>
                <View style={styles.teamsRow}><Team name={match.home_team} flag={match.home_team_flag_url} /><Text style={styles.versus}>对阵</Text><Team name={match.away_team} flag={match.away_team_flag_url} /></View>
                <Text style={styles.matchScore}>{match.home_score} : {match.away_score}</Text>
              </View>
            ))}
          </>
        ) : null}

        {page === "虚拟模拟" ? (
          <>
            <SectionTitle caption="初始 10,000 练习币；单次最多 500；仅用于学习">虚拟模拟单</SectionTitle>
            <View style={styles.walletRow}>
              <View><Text style={styles.smallLabel}>可用余额</Text><Text style={styles.walletValue}>{balance.toLocaleString("zh-CN")}</Text></View>
              <Pressable style={styles.secondaryButton} onPress={resetPractice}><Text style={styles.secondaryButtonText}>重置练习账户</Text></Pressable>
            </View>
            {selectedBet ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{zhTeam(selectedBet.homeTeam)} 对阵 {zhTeam(selectedBet.awayTeam)}</Text>
                <Text style={styles.muted}>{zhDate(selectedBet.kickoffTime)}</Text>
                <View style={styles.selectionSummary}><Text style={styles.selectionTitle}>{selectionNames[selectedBet.selection]}</Text><Text style={styles.selectionOdds}>赔率 {selectedBet.odds.toFixed(2)}</Text></View>
                <Text style={styles.inputLabel}>虚拟投入练习币</Text>
                <TextInput value={stake} onChangeText={setStake} keyboardType="numeric" style={styles.shortInput} />
                <Text style={styles.muted}>若模拟命中，潜在返还 {potentialReturn.toLocaleString("zh-CN")} 练习币；这不是收益承诺。</Text>
                <Text style={styles.inputLabel}>选择理由</Text>
                <TextInput value={reason} onChangeText={setReason} multiline placeholder="写下判断依据，赛后才能复盘偏差。" placeholderTextColor="#8a9591" style={styles.input} />
                <Pressable style={styles.primaryButton} onPress={submitSlip}><Text style={styles.primaryButtonText}>确认建立虚拟模拟单</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setPage("多角色分析")}><Text style={styles.secondaryButtonText}>先让多角色会审</Text></Pressable>
              </View>
            ) : <Text style={styles.dataMessage}>请先到“真实数据”页面选择一个真实赔率。</Text>}
            <SectionTitle caption="保存在当前设备，可用于赛后复盘">模拟单历史</SectionTitle>
            {slips.length === 0 ? <Text style={styles.dataMessage}>尚未建立模拟单。</Text> : slips.map((slip) => (
              <View key={slip.id} style={styles.slipCard}>
                <View style={styles.matchMeta}><Text style={styles.matchStage}>{slip.status}</Text><Text style={styles.muted}>{zhDate(slip.createdAt)}</Text></View>
                <Text style={styles.panelTitle}>{zhTeam(slip.homeTeam)} 对阵 {zhTeam(slip.awayTeam)}</Text>
                <Text style={styles.slipLine}>选择：{selectionNames[slip.selection]} · 固定赔率：{slip.odds.toFixed(2)}</Text>
                <Text style={styles.slipLine}>投入：{slip.stake} · 潜在返还：{slip.potentialReturn}</Text>
                <Text style={styles.muted}>理由：{slip.reason}</Text>
              </View>
            ))}
          </>
        ) : null}

        {page === "多角色分析" ? (
          <>
            <SectionTitle caption="三个不同人格独立调用人工智能模型，最后由主教练汇总">多角色策略会审</SectionTitle>
            {selectedBet ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{zhTeam(selectedBet.homeTeam)} 对阵 {zhTeam(selectedBet.awayTeam)}</Text>
                <Text style={styles.selectionTitle}>当前选择：{selectionNames[selectedBet.selection]} · 赔率 {selectedBet.odds.toFixed(2)}</Text>
                <Pressable style={styles.primaryButton} onPress={runPanel} disabled={panelLoading}><Text style={styles.primaryButtonText}>{panelLoading ? "四位角色正在协作…" : "启动真实多角色会审"}</Text></Pressable>
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
                <Text style={styles.coordinatorDecision}>{panel.coordinator.decision}</Text>
                <Text style={styles.learningSummary}>{panel.coordinator.summary}</Text>
                <Text style={styles.learningLabel}>核心分歧</Text><Text style={styles.learningSummary}>{panel.coordinator.disagreements}</Text>
                <Text style={styles.learningLabel}>虚拟仓位上限</Text><Text style={styles.coordinatorLimit}>{panel.coordinator.virtual_stake_limit} 练习币</Text>
                <Text style={styles.exercise}>复盘问题：{panel.coordinator.review_question}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {page === "学习助手" ? (
          <>
            <SectionTitle caption="真实人工智能生成讲解、练习与参考答案">中文学习助手</SectionTitle>
            <View style={styles.panel}>
              <Text style={styles.inputLabel}>你今天想学习什么？</Text>
              <View style={styles.topicList}>{topics.map((item) => (
                <Pressable key={item} onPress={() => setTopic(item)} style={[styles.topicChip, topic === item && styles.topicChipActive]}><Text style={[styles.topicText, topic === item && styles.topicTextActive]}>{item}</Text></Pressable>
              ))}</View>
              <TextInput value={topic} onChangeText={setTopic} multiline style={styles.input} />
              <Pressable style={styles.primaryButton} onPress={generateLearningGuide} disabled={aiLoading}><Text style={styles.primaryButtonText}>{aiLoading ? "正在生成…" : "生成学习讲解"}</Text></Pressable>
            </View>
            {aiLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {learning ? <LearningCard result={learning} /> : null}
            <SectionTitle caption="保存在当前设备，最多 20 条">学习历史</SectionTitle>
            {learningHistory.length === 0 ? <Text style={styles.dataMessage}>尚无学习历史。</Text> : learningHistory.map((item, index) => (
              <Pressable key={`${item.topic}-${index}`} style={styles.historyCard} onPress={() => setLearning(item)}><Text style={styles.panelTitle}>{item.topic}</Text><Text numberOfLines={2} style={styles.muted}>{item.summary}</Text></Pressable>
            ))}
          </>
        ) : null}

        {page === "系统状态" ? (
          <>
            <SectionTitle caption="只展示真实配置结果">系统状态</SectionTitle>
            {loading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {config && health ? <View style={styles.panel}>
              <StatusRow title="数据库服务" configured={health.database_connected} detail={`已记录 ${health.case_count} 条验证与人工智能调用数据`} />
              <StatusRow title="人工智能服务" configured={health.deepseek_configured} detail="用于学习助手与多角色策略会审" />
              <StatusRow title="真实赛程与赛果" configured={config.sports_data.configured} detail={config.sports_data.message} />
              <StatusRow title="真实胜平负赔率" configured={config.odds_data.configured} detail={config.odds_data.message} />
            </View> : null}
          </>
        ) : null}

        {page === "使用说明" ? (
          <>
            <SectionTitle caption="当前版本已具备真实数据到虚拟复盘的完整路径">使用说明</SectionTitle>
            <View style={styles.panel}>
              {[
                ["第一步", "打开真实数据，选择一场本届比赛的真实胜平负赔率。"],
                ["第二步", "建立虚拟模拟单，输入练习币与选择理由。"],
                ["第三步", "启动多角色会审，比较数据、反方与风险观点。"],
                ["第四步", "保存模拟单并在赛后根据真实赛果复盘。"],
                ["第五步", "使用学习助手完成练习，并对照参考答案。"],
              ].map(([step, text]) => <View key={step} style={styles.guideRow}><Text style={styles.guideStep}>{step}</Text><Text style={styles.guideText}>{text}</Text></View>)}
            </View>
            <View style={styles.notice}><Text style={styles.noticeTitle}>数据边界与合规边界</Text><Text style={styles.noticeText}>当前真实数据包括 2022 完整赛果和本届当前赔率。更早四届与本届实时赛果需新增具备相应权限的数据源。产品只使用虚拟练习币，不提供充值、提现、支付或真实投注。</Text></View>
          </>
        ) : null}

        <Text style={styles.footer}>世界杯纸上竞猜 · 中文虚拟策略学习产品</Text>
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
  lightButton: { backgroundColor: "#ffffff", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 5 },
  lightButtonText: { color: "#0d685a", fontWeight: "900" },
  primaryButton: { backgroundColor: "#0d7565", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4 },
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
  oddsLabel: { color: "#56706a", fontSize: 11, fontWeight: "700" },
  oddsValue: { color: "#0d685a", fontSize: 17, fontWeight: "900" },
  oddsAction: { color: "#0d685a", fontSize: 10, fontWeight: "800", marginTop: 3 },
  walletRow: { backgroundColor: "#173e37", borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  smallLabel: { color: "#8dd1c3", fontSize: 11, fontWeight: "800" },
  walletValue: { color: "#ffffff", fontSize: 28, fontWeight: "900" },
  selectionSummary: { backgroundColor: "#d9eee8", padding: 13, borderRadius: 12, flexDirection: "row", justifyContent: "space-between" },
  selectionTitle: { color: "#173e37", fontWeight: "900" },
  selectionOdds: { color: "#0d685a", fontWeight: "900" },
  slipCard: { backgroundColor: "#fffdf8", borderLeftWidth: 5, borderLeftColor: "#0d7565", borderRadius: 14, padding: 16, gap: 7 },
  slipLine: { color: "#173e37", fontWeight: "800" },
  agentCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 17, gap: 9 },
  agentName: { color: "#0d685a", fontWeight: "900", fontSize: 16 },
  confidence: { color: "#815b0c", backgroundColor: "#f7e8c8", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontWeight: "800", fontSize: 11 },
  agentPersonality: { color: "#173e37", fontWeight: "800", fontSize: 13 },
  agentConclusion: { color: "#173e37", fontSize: 14, lineHeight: 22 },
  agentEvidence: { color: "#566762", fontSize: 13, lineHeight: 20 },
  coordinatorCard: { backgroundColor: "#173e37", borderRadius: 22, padding: 20, gap: 11 },
  coordinatorDecision: { color: "#ffffff", fontSize: 25, fontWeight: "900" },
  coordinatorLimit: { color: "#8dd1c3", fontSize: 22, fontWeight: "900" },
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
