import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

type ProviderStatus = {
  configured: boolean;
  provider?: string;
  model?: string;
  message?: string;
};

type ConfigStatus = {
  deepseek: ProviderStatus;
  sports_data: ProviderStatus;
  odds_data: ProviderStatus;
  database: { configured: boolean; engine: string };
};

type Health = {
  status: string;
  database: string;
  database_connected: boolean;
  deepseek_configured: boolean;
  case_count: number;
};

type DemoCase = {
  slug: string;
  title: string;
  status: string;
  agent_trace: Array<{ step: number; agent: string; action: string }>;
  evidence: string[];
  result: { outcome: string };
};

function StatusCard({
  title,
  status,
  detail,
}: {
  title: string;
  status: boolean;
  detail: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.badge, status ? styles.badgeReady : styles.badgePending]}>
          <Text style={[styles.badgeText, status ? styles.readyText : styles.pendingText]}>
            {status ? "已配置" : "未配置"}
          </Text>
        </View>
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

export default function App() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [demoCase, setDemoCase] = useState<DemoCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [configResponse, healthResponse, casesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/system/config-status`),
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/api/demo/cases`),
      ]);
      if (!configResponse.ok || !healthResponse.ok || !casesResponse.ok) {
        throw new Error("后端状态接口暂不可用");
      }
      const cases = await casesResponse.json();
      setConfig(await configResponse.json());
      setHealth(await healthResponse.json());
      setDemoCase(cases.cases?.[0] || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verifyAi = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const response = await fetch(`${API_BASE}/api/ai/verify`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI 验证失败");
      setAiResult(`${payload.result} · fallback=${String(payload.fallback)}`);
    } catch (requestError) {
      setAiResult(requestError instanceof Error ? requestError.message : "AI 验证失败");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>WORLD CUP PAPERBET</Text>
        <Text style={styles.title}>数据源配置状态</Text>
        <Text style={styles.subtitle}>
          虚拟策略实验室，仅用于模拟学习，不提供真实投注、充值、提现或平台跳转。
        </Text>

        {loading ? <ActivityIndicator color="#0d685a" size="large" /> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.detail}>API: {API_BASE}</Text>
          </View>
        ) : null}

        {config && health ? (
          <>
            <StatusCard
              title="Supabase Postgres"
              status={health.database_connected}
              detail={`${health.database} · demo cases ${health.case_count}`}
            />
            <StatusCard
              title="DeepSeek"
              status={config.deepseek.configured}
              detail={`模型：${config.deepseek.model || "未配置"}`}
            />
            <StatusCard
              title="真实世界杯赛程 / 赛果"
              status={config.sports_data.configured}
              detail={config.sports_data.message || ""}
            />
            <StatusCard
              title="真实 1X2 赔率"
              status={config.odds_data.configured}
              detail={config.odds_data.message || ""}
            />
          </>
        ) : null}

        <Pressable style={styles.button} onPress={verifyAi} disabled={aiLoading}>
          <Text style={styles.buttonText}>{aiLoading ? "正在验证…" : "真实调用 DeepSeek"}</Text>
        </Pressable>
        {aiResult ? <Text style={styles.aiResult}>{aiResult}</Text> : null}

        {demoCase ? (
          <View style={styles.traceCard}>
            <Text style={styles.sectionLabel}>CORE AGENT TRACE</Text>
            <Text style={styles.traceTitle}>{demoCase.title}</Text>
            {demoCase.agent_trace.map((trace) => (
              <View key={trace.step} style={styles.traceRow}>
                <Text style={styles.traceStep}>{trace.step}</Text>
                <View style={styles.traceBody}>
                  <Text style={styles.traceAgent}>{trace.agent}</Text>
                  <Text style={styles.detail}>{trace.action}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.sectionLabel}>EVIDENCE</Text>
            {demoCase.evidence.map((item) => (
              <Text key={item} style={styles.evidence}>• {item}</Text>
            ))}
            <Text style={styles.result}>{demoCase.result.outcome}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>Backend: {API_BASE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f0e9" },
  container: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 22, gap: 14 },
  eyebrow: { color: "#0d685a", fontSize: 12, fontWeight: "800", letterSpacing: 2.2, marginTop: 16 },
  title: { color: "#102c28", fontSize: 32, lineHeight: 38, fontWeight: "800" },
  subtitle: { color: "#53635f", fontSize: 15, lineHeight: 23, marginBottom: 8 },
  card: { backgroundColor: "#fffdf8", borderColor: "#dedbd1", borderWidth: 1, borderRadius: 18, padding: 17, gap: 9 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  cardTitle: { color: "#163832", fontSize: 16, fontWeight: "700", flex: 1 },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  badgeReady: { backgroundColor: "#d9eee8" },
  badgePending: { backgroundColor: "#f7e8c8" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  readyText: { color: "#0d685a" },
  pendingText: { color: "#815b0c" },
  detail: { color: "#66736f", fontSize: 13, lineHeight: 19 },
  errorCard: { backgroundColor: "#fff1ef", borderRadius: 16, padding: 16, gap: 5 },
  errorText: { color: "#9a2d22", fontWeight: "700" },
  button: { backgroundColor: "#0d685a", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  aiResult: { color: "#0d685a", backgroundColor: "#d9eee8", padding: 13, borderRadius: 14, lineHeight: 20 },
  traceCard: { backgroundColor: "#173e37", borderRadius: 22, padding: 19, gap: 13, marginTop: 6 },
  sectionLabel: { color: "#8dd1c3", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 4 },
  traceTitle: { color: "#ffffff", fontSize: 20, fontWeight: "800", lineHeight: 27 },
  traceRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  traceStep: { color: "#173e37", backgroundColor: "#8dd1c3", borderRadius: 99, width: 24, height: 24, textAlign: "center", lineHeight: 24, fontWeight: "800" },
  traceBody: { flex: 1, gap: 2 },
  traceAgent: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  evidence: { color: "#dcebe7", fontSize: 13, lineHeight: 19 },
  result: { color: "#173e37", backgroundColor: "#fff0bd", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  footer: { color: "#87918e", fontSize: 11, textAlign: "center", marginVertical: 10 },
});

