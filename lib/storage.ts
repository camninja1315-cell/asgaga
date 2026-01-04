import { sql } from '@vercel/postgres';
import { DEFAULT_SETTINGS } from './defaultSettings';
import type { Settings } from './settings';

const MEMORY: { settings?: Settings } = {};

function hasPostgres() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

export async function getSettings(): Promise<Settings> {
  if (!hasPostgres()) return MEMORY.settings ?? DEFAULT_SETTINGS;
  await ensureSchema();
  const res = await sql`SELECT value_json FROM app_settings WHERE key = 'global' LIMIT 1`;
  if (res.rowCount && res.rows[0]?.value_json) {
    return res.rows[0].value_json as Settings;
  }
  // seed
  await sql`INSERT INTO app_settings (key, value_json) VALUES ('global', ${DEFAULT_SETTINGS}) ON CONFLICT (key) DO NOTHING`;
  return DEFAULT_SETTINGS;
}

export async function setSettings(next: Settings): Promise<void> {
  if (!hasPostgres()) {
    MEMORY.settings = next;
    return;
  }
  await ensureSchema();
  await sql`INSERT INTO app_settings (key, value_json) VALUES ('global', ${next}) ON CONFLICT (key) DO UPDATE SET value_json = ${next}, updated_at = now()`;
}

export async function logEvent(kind: string, payload: unknown): Promise<void> {
  // Always emit to logs (Vercel observability)
  console.log(`[${kind}]`, JSON.stringify(payload));
  if (!hasPostgres()) return;
  await ensureSchema();
  await sql`INSERT INTO event_log (kind, payload_json) VALUES (${kind}, ${payload})`;
}

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  // Create tables if missing
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS event_log (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind TEXT NOT NULL,
      payload_json JSONB NOT NULL
    );
  `;
  schemaReady = true;
}
