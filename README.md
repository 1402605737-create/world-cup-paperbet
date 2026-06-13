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
- 真实数据源配置状态检查
- 独立 Supabase Schema 与最小权限应用角色
- 独立 Vercel 前端与后端项目
- 明确拒绝使用虚构赛程、赛果或赔率

API-Football 与 The Odds API 将在后续阶段接入。接入前，相关功能会明确显示“待配置”。

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
- `GET /health`：读取后端、数据库和人工智能健康状态

## 真实数据原则

当前版本只展示数据源是否真实配置：

- `API_FOOTBALL`：真实赛程与赛果服务，当前待配置
- `THE_ODDS_API`：真实赔率服务，当前待配置

没有真实密钥时，界面会明确提示数据源待配置，不会生成假赛程、假赛果、假赔率或假策略。

## 数据库隔离

部署复用现有 Supabase Free 项目，但不会触碰其他应用：

- 独立 Schema：`world_cup_paperbet`
- 独立登录角色：`world_cup_paperbet_app`
- Transaction Pooler 端口：`6543`
- 所有生产查询显式使用 `world_cup_paperbet.表名`
- 应用角色不能执行数据库结构操作，也不拥有业务表
- RLS 策略仅面向 `world_cup_paperbet_app`

生产启动时不会创建、修改、删除或迁移数据库对象。

## 独立部署

- 后端 Vercel 项目：`world-cup-paperbet-api`
- 前端 Vercel 项目：`world-cup-paperbet-web`
- 后端只允许正式前端域名进行跨域访问
- 前端通过环境变量连接后端

## 后续计划

1. 接入真实 API-Football 世界杯赛程与赛果。
2. 接入真实 The Odds API 胜平负赔率。
3. 开放虚拟练习币钱包与流水。
4. 开放基于真实比赛数据的多 Agent 虚拟策略实验。
5. 开放真实赛果结算与中文赛后复盘。
