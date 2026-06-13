create extension if not exists pgcrypto;

create table if not exists demo_cases (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  status text not null check (status in ('ready', 'blocked', 'verified')),
  agent_trace jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  request_id text,
  fallback boolean not null default false,
  response_json jsonb not null,
  created_at timestamptz not null default now()
);

insert into demo_cases (slug, title, status, agent_trace, evidence, result)
values (
  'configuration-readiness',
  'Data source configuration readiness',
  'ready',
  '[
    {"step": 1, "agent": "Config Inspector", "action": "Inspect server-side environment flags"},
    {"step": 2, "agent": "Compliance Guard", "action": "Block unconfigured providers from returning invented data"},
    {"step": 3, "agent": "DeepSeek Verifier", "action": "Run a real structured-output connectivity check"}
  ]'::jsonb,
  '[
    "Sports and odds providers expose explicit configured flags",
    "The backend never returns mock match, result, or odds data",
    "AI verification records fallback=false responses"
  ]'::jsonb,
  '{"outcome": "Configuration dashboard is ready for live-provider onboarding"}'::jsonb
)
on conflict (slug) do update set
  title = excluded.title,
  status = excluded.status,
  agent_trace = excluded.agent_trace,
  evidence = excluded.evidence,
  result = excluded.result,
  updated_at = now();

