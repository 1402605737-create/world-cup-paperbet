# World Cup PaperBet

**GitHub:** https://github.com/1402605737-create/world-cup-paperbet
**Live Demo:** https://world-cup-paperbet-web.vercel.app
**Backend Health:** https://world-cup-paperbet-api.vercel.app/health

World Cup PaperBet is a mobile-first, practice-only strategy laboratory. This first deployment milestone contains the Expo app skeleton, a secure DeepSeek backend connection, Supabase Postgres readiness, and a truthful data-source configuration dashboard. It never invents match, result, or odds data when real providers are not configured.

> Compliance boundary: this is a gambling-related / betting-companion risk product using virtual practice coins only. It provides no real-money betting, deposits, withdrawals, payments, or betting-platform redirects. Legal, age, regional, and app-store policy review is required before distribution.

## Current Scope

- Expo React Native app with a Vercel-compatible static web export
- TypeScript Express API with a Vercel Serverless entry
- `GET /health` with database, DeepSeek, and demo-case status
- `GET /api/system/config-status` with honest provider configuration flags
- `POST /api/ai/verify` for a real DeepSeek structured-output call
- Isolated Supabase Schema and least-privilege application role
- Demo agent trace, evidence, result, and AI call log
- API-Football and The Odds API intentionally deferred to the next milestone

## Local Run

```bash
npm install
npm run build
npm run test
npm run dev:backend
npm run dev:frontend
```

Copy `.env.example` to a local `.env` only when running locally. Never commit credentials. The frontend reads `EXPO_PUBLIC_API_BASE_URL`; all provider and DeepSeek secrets stay on the backend.

## DeepSeek

The backend calls the OpenAI-compatible `POST {DEEPSEEK_BASE_URL}/chat/completions` endpoint with JSON output enabled. Configure `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`. Invalid JSON or prohibited content is retried once; failure is returned explicitly with `fallback=false`.

## Real Data Providers

`API_FOOTBALL` and `THE_ODDS_API` are represented only as configuration status in this milestone. Without their real credentials, the UI explicitly reports that the real data source is unconfigured. No mock schedule, result, odds, or strategy is shown.

## Database

The deployment reuses a Supabase Free project without touching existing applications:

- Schema: `world_cup_paperbet`
- Login role: `world_cup_paperbet_app`
- Transaction Pooler port: `6543`
- Every production query uses an explicit `world_cup_paperbet.table_name`
- The application role cannot run DDL and owns no tables
- RLS policies apply only to `world_cup_paperbet_app`

Schema creation is a one-time administrator action using a local ignored copy of `backend/sql/supabase-isolated-bootstrap.template.txt`. Production startup never creates, alters, drops, or migrates database objects.

Verify the dedicated application connection without running DDL:

```bash
DATABASE_URL="postgresql://..." npm run db:verify --workspace backend
```

## Deployment

The repository contains independent `backend/vercel.json` and `frontend/vercel.json` files. The dedicated Vercel projects are `world-cup-paperbet-api` and `world-cup-paperbet-web`. Deploy the backend first, configure its production environment, then deploy the frontend with `EXPO_PUBLIC_API_BASE_URL`, and finally set the backend `FRONTEND_ORIGIN` to the stable frontend domain.
