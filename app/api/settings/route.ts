import { NextResponse } from 'next/server';
import { getSettings, setSettings, logEvent } from '@/lib/storage';
import { parseSettings } from '@/lib/settings';

export async function GET() {
  const settings = await getSettings();
  // Return the raw settings object so the /settings editor can round-trip cleanly.
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json();
  const prev = await getSettings();
  // Accept either a raw settings object or { settings: ... }
  const candidate = (body && typeof body === 'object' && 'settings' in body) ? (body as any).settings : body;
  const settings = parseSettings(candidate);
  // auto-bump config version for reproducible event logs
  settings.app.configVersion = (prev.app?.configVersion ?? 1) + 1;
  await setSettings(settings);
  await logEvent('settings_updated', { config_version: settings.app.configVersion });
  return NextResponse.json(settings);
}
