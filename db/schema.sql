-- Optional: Vercel Postgres schema for persistence.
-- In Vercel: Storage → Postgres → Query → run this.

create table if not exists app_settings (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists event_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  kind text not null, -- api_call | thought | proposal | trade_execute | etc
  payload_json jsonb not null
);

create index if not exists event_log_kind_ts_idx on event_log (kind, ts desc);
