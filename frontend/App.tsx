import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

type Page = "首页" | "真实赛程" | "学习助手" | "系统状态" | "使用说明";

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
};

type Odds = {
  external_event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  bookmaker: string;
  selections: Array<{ selection: "home" | "draw" | "away"; odds: number }>;
};

const topics = ["赔率是什么意思", "如何理解数学期望", "如何控制虚拟仓位", "如何做好赛后复盘"];

function SectionTitle({ children, caption }: { children: string; caption?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

function StatusRow({
  title,
  configured,
  detail,
}: {
  title: string;
  configured: boolean;
  detail: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <View style={[styles.badge, configured ? styles.badgeReady : styles.badgePending]}>
        <Text style={configured ? styles.readyText : styles.pendingText}>
          {configured ? "已就绪" : "待配置"}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("首页");
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(topics[0]);
  const [learning, setLearning] = useState<LearningResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [odds, setOdds] = useState<Odds[]>([]);
  const [liveDataLoading, setLiveDataLoading] = useState(false);
  const [matchesMessage, setMatchesMessage] = useState("");
  const [oddsMessage, setOddsMessage] = useState("");

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
  }, [loadStatus]);

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
      setLearning(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "学习内容生成失败");
    } finally {
      setAiLoading(false);
    }
  };

  const loadLiveData = async () => {
    setLiveDataLoading(true);
    setMatchesMessage("");
    setOddsMessage("");
    try {
      const [matchesResponse, oddsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/matches`),
        fetch(`${API_BASE}/api/odds`),
      ]);
      const matchesPayload = await matchesResponse.json();
      const oddsPayload = await oddsResponse.json();
      if (matchesResponse.ok) setMatches(matchesPayload.matches || []);
      else setMatchesMessage(matchesPayload.error || "真实赛程暂不可用");
      if (oddsResponse.ok) setOdds(oddsPayload.odds || []);
      else setOddsMessage(oddsPayload.error || "真实赔率暂不可用");
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
    if (item === "真实赛程") void loadLiveData();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>世界杯纸上竞猜</Text>
          <Text style={styles.brandTitle}>虚拟策略学习实验室</Text>
          <Text style={styles.brandSubtitle}>
            用真实人工智能学习赔率、数学期望与风险控制。仅使用虚拟练习币，不涉及任何真实资金。
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {(["首页", "真实赛程", "学习助手", "系统状态", "使用说明"] as Page[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => openPage(item)}
              style={[styles.navItem, page === item && styles.navItemActive]}
            >
              <Text style={[styles.navText, page === item && styles.navTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {page === "首页" ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>今日学习任务</Text>
              <Text style={styles.heroTitle}>先理解规则，再判断策略</Text>
              <Text style={styles.heroText}>
                当前版本已开放人工智能学习助手。真实世界杯赛程与赔率将在数据源配置完成后开放，系统不会用假数据冒充真实数据。
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => setPage("学习助手")}>
                <Text style={styles.primaryButtonText}>开始今天的学习</Text>
              </Pressable>
            </View>

            <SectionTitle caption="当前真正可用的能力">功能入口</SectionTitle>
            <View style={styles.grid}>
              <Pressable style={styles.featureCard} onPress={() => openPage("真实赛程")}>
                <Text style={styles.featureNumber}>01</Text>
                <Text style={styles.featureTitle}>真实世界杯赛程</Text>
                <Text style={styles.muted}>从 API-Football 加载真实赛程，并从 The Odds API 加载真实胜平负赔率。</Text>
              </Pressable>
              <Pressable style={styles.featureCard} onPress={() => setPage("学习助手")}>
                <Text style={styles.featureNumber}>02</Text>
                <Text style={styles.featureTitle}>人工智能学习助手</Text>
                <Text style={styles.muted}>输入一个概念，获得中文解释、关键要点与练习任务。</Text>
              </Pressable>
              <Pressable style={styles.featureCard} onPress={() => setPage("系统状态")}>
                <Text style={styles.featureNumber}>03</Text>
                <Text style={styles.featureTitle}>真实数据源状态</Text>
                <Text style={styles.muted}>清楚区分已配置能力与待配置能力，绝不展示假赛程或假赔率。</Text>
              </Pressable>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>使用边界</Text>
              <Text style={styles.noticeText}>
                本产品仅用于虚拟策略学习，不提供真实投注、资金充值、资金提取或外部平台跳转。
              </Text>
            </View>
          </>
        ) : null}

        {page === "真实赛程" ? (
          <>
            <SectionTitle caption="只展示供应商返回的真实数据">真实世界杯赛程与赔率</SectionTitle>
            <Pressable style={styles.primaryButton} onPress={loadLiveData} disabled={liveDataLoading}>
              <Text style={styles.primaryButtonText}>
                {liveDataLoading ? "正在读取真实数据…" : "刷新真实数据"}
              </Text>
            </Pressable>
            {liveDataLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {matchesMessage ? <Text style={styles.dataMessage}>{matchesMessage}</Text> : null}
            {oddsMessage ? <Text style={styles.dataMessage}>{oddsMessage}</Text> : null}
            {matches.map((match) => {
              const matchOdds = odds.find(
                (item) => item.home_team === match.home_team && item.away_team === match.away_team,
              );
              return (
                <View key={match.external_match_id} style={styles.matchCard}>
                  <View style={styles.matchMeta}>
                    <Text style={styles.matchStage}>{match.stage}</Text>
                    <Text style={styles.muted}>
                      {new Date(match.kickoff_time).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={styles.matchTeams}>{match.home_team}  对阵  {match.away_team}</Text>
                  {match.status === "finished" ? (
                    <Text style={styles.matchScore}>{match.home_score} : {match.away_score}</Text>
                  ) : null}
                  {matchOdds ? (
                    <View style={styles.oddsRow}>
                      {matchOdds.selections.map((item) => (
                        <View key={item.selection} style={styles.oddsCell}>
                          <Text style={styles.oddsLabel}>
                            {item.selection === "home" ? "主胜" : item.selection === "draw" ? "平局" : "客胜"}
                          </Text>
                          <Text style={styles.oddsValue}>{item.odds.toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.muted}>当前赔率供应商尚未提供该场比赛的胜平负赔率。</Text>
                  )}
                </View>
              );
            })}
            {!liveDataLoading && matches.length === 0 && !matchesMessage ? (
              <Text style={styles.dataMessage}>真实赛事供应商当前尚未返回比赛数据。</Text>
            ) : null}
          </>
        ) : null}

        {page === "学习助手" ? (
          <>
            <SectionTitle caption="由后端安全调用真实 DeepSeek 模型">中文学习助手</SectionTitle>
            <View style={styles.panel}>
              <Text style={styles.inputLabel}>你今天想学习什么？</Text>
              <View style={styles.topicList}>
                {topics.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setTopic(item)}
                    style={[styles.topicChip, topic === item && styles.topicChipActive]}
                  >
                    <Text style={[styles.topicText, topic === item && styles.topicTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="例如：为什么高赔率不等于更值得选择？"
                placeholderTextColor="#8a9591"
                multiline
                style={styles.input}
              />
              <Pressable style={styles.primaryButton} onPress={generateLearningGuide} disabled={aiLoading}>
                <Text style={styles.primaryButtonText}>
                  {aiLoading ? "正在生成中文学习内容…" : "生成学习讲解"}
                </Text>
              </Pressable>
            </View>

            {aiLoading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {learning ? (
              <View style={styles.learningCard}>
                <Text style={styles.learningLabel}>本次主题</Text>
                <Text style={styles.learningTitle}>{learning.topic}</Text>
                <Text style={styles.learningSummary}>{learning.summary}</Text>
                <Text style={styles.learningLabel}>关键要点</Text>
                {learning.key_points.map((item) => (
                  <Text key={item} style={styles.learningPoint}>• {item}</Text>
                ))}
                <Text style={styles.learningLabel}>练习任务</Text>
                <Text style={styles.exercise}>{learning.practical_exercise}</Text>
                <Text style={styles.warning}>{learning.risk_warning}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {page === "系统状态" ? (
          <>
            <SectionTitle caption="只展示真实配置结果">系统状态</SectionTitle>
            {loading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
            {config && health ? (
              <View style={styles.panel}>
                <StatusRow
                  title="数据库服务"
                  configured={health.database_connected}
                  detail={`已记录 ${health.case_count} 条本项目验证数据`}
                />
                <StatusRow
                  title="人工智能服务"
                  configured={health.deepseek_configured}
                  detail="用于中文学习讲解与结构化策略解释"
                />
                <StatusRow
                  title="真实世界杯赛程与赛果"
                  configured={config.sports_data.configured}
                  detail={config.sports_data.message}
                />
                <StatusRow
                  title="真实胜平负赔率"
                  configured={config.odds_data.configured}
                  detail={config.odds_data.message}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {page === "使用说明" ? (
          <>
            <SectionTitle caption="当前版本使用路径">使用说明</SectionTitle>
            <View style={styles.panel}>
              {[
                ["第一步", "打开学习助手，选择或输入一个策略学习主题。"],
                ["第二步", "阅读人工智能生成的中文解释、关键要点与练习任务。"],
                ["第三步", "在系统状态中确认真实赛事与赔率数据源是否可用。"],
                ["第四步", "数据源开放后，再进入真实赛程上的虚拟策略实验。"],
              ].map(([step, text]) => (
                <View key={step} style={styles.guideRow}>
                  <Text style={styles.guideStep}>{step}</Text>
                  <Text style={styles.guideText}>{text}</Text>
                </View>
              ))}
            </View>
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>为什么现在没有比赛列表？</Text>
              <Text style={styles.noticeText}>
                因为真实赛事与赔率服务尚未配置。产品坚持不使用虚构赛程、赛果或赔率冒充真实数据。
              </Text>
            </View>
          </>
        ) : null}

        <Text style={styles.footer}>世界杯纸上竞猜 · 中文虚拟策略学习产品</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f0e9" },
  container: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 22, gap: 18 },
  brandBlock: { gap: 8, paddingTop: 18 },
  eyebrow: { color: "#0d685a", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  brandTitle: { color: "#102c28", fontSize: 34, lineHeight: 42, fontWeight: "900" },
  brandSubtitle: { color: "#53635f", fontSize: 15, lineHeight: 23, maxWidth: 620 },
  nav: { backgroundColor: "#e6e3da", borderRadius: 16, padding: 4, gap: 4 },
  navItem: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 12 },
  navItemActive: { backgroundColor: "#ffffff" },
  navText: { color: "#62706c", fontWeight: "700" },
  navTextActive: { color: "#0d685a" },
  hero: { backgroundColor: "#173e37", borderRadius: 24, padding: 24, gap: 12 },
  heroLabel: { color: "#8dd1c3", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#ffffff", fontSize: 27, lineHeight: 34, fontWeight: "900" },
  heroText: { color: "#d8e7e3", fontSize: 14, lineHeight: 22 },
  primaryButton: { backgroundColor: "#0d7565", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4 },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  sectionHeading: { gap: 3, marginTop: 4 },
  sectionTitle: { color: "#173e37", fontSize: 22, fontWeight: "900" },
  sectionCaption: { color: "#75817e", fontSize: 12 },
  grid: { gap: 12 },
  featureCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 18, gap: 7 },
  featureNumber: { color: "#0d7565", fontWeight: "900", fontSize: 12, letterSpacing: 1.4 },
  featureTitle: { color: "#173e37", fontSize: 17, fontWeight: "800" },
  muted: { color: "#66736f", fontSize: 13, lineHeight: 20 },
  notice: { backgroundColor: "#fff0bd", borderRadius: 16, padding: 17, gap: 5 },
  noticeTitle: { color: "#563e08", fontWeight: "800", fontSize: 15 },
  noticeText: { color: "#6e571f", fontSize: 13, lineHeight: 20 },
  panel: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 20, padding: 18, gap: 15 },
  inputLabel: { color: "#173e37", fontSize: 16, fontWeight: "800" },
  topicList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: { borderWidth: 1, borderColor: "#cbd4d1", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  topicChipActive: { backgroundColor: "#d9eee8", borderColor: "#8dc9bd" },
  topicText: { color: "#66736f", fontSize: 12, fontWeight: "700" },
  topicTextActive: { color: "#0d685a" },
  input: { minHeight: 90, borderWidth: 1, borderColor: "#d4d8d5", borderRadius: 14, padding: 13, color: "#173e37", fontSize: 15, textAlignVertical: "top" },
  learningCard: { backgroundColor: "#173e37", borderRadius: 22, padding: 20, gap: 12 },
  learningLabel: { color: "#8dd1c3", fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginTop: 4 },
  learningTitle: { color: "#ffffff", fontSize: 22, lineHeight: 29, fontWeight: "900" },
  learningSummary: { color: "#dcebe7", fontSize: 14, lineHeight: 22 },
  learningPoint: { color: "#ffffff", fontSize: 13, lineHeight: 21 },
  exercise: { color: "#173e37", backgroundColor: "#d9eee8", borderRadius: 12, padding: 13, lineHeight: 20 },
  warning: { color: "#573f08", backgroundColor: "#fff0bd", borderRadius: 12, padding: 13, lineHeight: 20, fontWeight: "700" },
  dataMessage: { color: "#815b0c", backgroundColor: "#f7e8c8", borderRadius: 14, padding: 14, lineHeight: 20 },
  matchCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dedbd1", borderRadius: 18, padding: 18, gap: 12 },
  matchMeta: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  matchStage: { color: "#0d7565", fontWeight: "800", fontSize: 12 },
  matchTeams: { color: "#173e37", fontSize: 18, fontWeight: "900", lineHeight: 25 },
  matchScore: { color: "#0d685a", fontSize: 24, fontWeight: "900" },
  oddsRow: { flexDirection: "row", gap: 8 },
  oddsCell: { flex: 1, backgroundColor: "#e7f2ef", borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  oddsLabel: { color: "#56706a", fontSize: 11, fontWeight: "700" },
  oddsValue: { color: "#0d685a", fontSize: 16, fontWeight: "900" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#ebe8df", paddingBottom: 15 },
  statusCopy: { flex: 1, gap: 4 },
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
  footer: { color: "#87918e", fontSize: 11, textAlign: "center", marginVertical: 12 },
});
