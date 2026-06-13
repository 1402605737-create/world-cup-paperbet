# 世界杯纸上竞猜

**GitHub 仓库：** https://github.com/1402605737-create/world-cup-paperbet
**在线演示：** https://world-cup-paperbet-web.vercel.app
**后端健康检查：** https://world-cup-paperbet-api.vercel.app/health

世界杯纸上竞猜是一个移动端优先的虚拟策略学习实验室。当前版本提供可真实使用的中文人工智能学习助手、真实数据源配置状态检查和合规说明。未配置真实赛事或赔率服务时，系统不会展示任何虚构赛程、赛果或赔率。

> 合规边界：本产品只使用虚拟练习币进行模拟学习，不提供真实投注、资金充值、资金提取、支付或外部平台跳转。正式发布前仍需完成法律、年龄、地区与应用商店政策审查。

## 当前可用功能

- 中文首页与清晰的产品使用路径
- 中文人工智能学习助手
- 真实调用 DeepSeek 并返回结构化中文学习内容
- 赔率、数学期望、虚拟仓位和赛后复盘概念学习
- API-Football 真实世界杯赛程与赛果接入层
- The Odds API 真实胜平负赔率接入层
- 中文真实赛程与赔率页面
- 每日自动同步 2022 世界杯历史赛果与国家旗帜
- 独立 Supabase Schema 与最小权限应用角色
- 独立 Vercel 前端与后端项目
- 明确拒绝使用虚构赛程、赛果或赔率

真实 Provider 已完成，领取供应商免费密钥并配置后即可显示数据。密钥未配置或供应商尚未提供世界杯数据时，页面会明确说明原因。

## 本地运行

```bash
npm install
npm run build
npm run test
npm run dev:backend
npm run dev:frontend
```

本地运行时，可将 `.env.example` 复制为本地 `.env`。不得提交任何凭据。前端只读取 `EXPO_PUBLIC_API_BASE_URL`，所有数据源与人工智能密钥仅保存在后端。

## 人工智能服务

后端通过 OpenAI 兼容接口调用 DeepSeek。所有自然语言输出均要求使用简体中文，输出必须通过结构校验。非法 JSON 或违反内容安全要求的结果会重试一次；仍失败时会明确返回错误，不使用虚构替代结果。

主要接口：

- `POST /api/ai/learn`：生成中文学习讲解
- `POST /api/ai/verify`：验证真实人工智能调用
- `GET /api/system/config-status`：读取真实数据源配置状态
- `GET /api/matches`：从 API-Football 读取真实世界杯赛程与赛果
- `GET /api/odds`：从 The Odds API 读取真实世界杯胜平负赔率
- `GET /health`：读取后端、数据库和人工智能健康状态

## 真实数据原则

当前版本已实现真实供应商调用：

- `API_FOOTBALL`：通过 `https://v3.football.api-sports.io/fixtures` 获取真实赛程与赛果
- `THE_ODDS_API`：通过 `soccer_fifa_world_cup` 获取真实世界杯胜平负赔率

没有真实密钥时，界面会明确提示数据源待配置，不会生成假赛程、假赛果、假赔率或假策略。

所需后端环境变量：

```text
SPORTS_API_KEY=
SPORTS_API_BASE_URL=https://v3.football.api-sports.io
SPORTS_LEAGUE_ID=1
SPORTS_SEASON=2022
CRON_SECRET=
ODDS_API_KEY=
ODDS_API_BASE_URL=https://api.the-odds-api.com
ODDS_SPORT_KEY=soccer_fifa_world_cup
ODDS_REGION=eu
ODDS_MARKET=h2h
ODDS_FORMAT=decimal
```

## 数据库隔离

部署复用现有 Supabase Free 项目，但不会触碰其他应用：

- 独立 Schema：`world_cup_paperbet`
- 独立登录角色：`world_cup_paperbet_app`
- Transaction Pooler 端口：`6543`
- 所有生产查询显式使用 `world_cup_paperbet.表名`
- 应用角色不能执行数据库结构操作，也不拥有业务表
- RLS 策略仅面向 `world_cup_paperbet_app`

生产启动时不会创建、修改、删除或迁移数据库对象。

Vercel Cron 每天调用一次受 `CRON_SECRET` 保护的 `/api/cron/sync-results`，将 API-Football 返回的 2022 世界杯历史赛果和国家旗帜更新到当前项目独立 Schema。API-Football 免费套餐当前不允许访问 2026 赛季，因此 2026 当前赛事由 The Odds API 单独展示。

## 独立部署

- 后端 Vercel 项目：`world-cup-paperbet-api`
- 前端 Vercel 项目：`world-cup-paperbet-web`
- 后端只允许正式前端域名进行跨域访问
- 前端通过环境变量连接后端

## 后续计划

1. 配置供应商免费密钥并完成真实数据线上验收。
2. 开放虚拟练习币钱包与流水。
3. 开放基于真实比赛数据的多 Agent 虚拟策略实验。
4. 开放真实赛果结算与中文赛后复盘。
