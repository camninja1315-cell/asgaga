import { NextResponse } from 'next/server';
import { getSettings, logEvent } from '@/lib/storage';
import { photonFetch } from '@/lib/photon';
import type { MemescopeResponse } from '@/lib/types';
import { normalizeFromMemescope, scoreCoin } from '@/lib/scoring';
import { computeRSI } from '@/lib/rsi';

function intervalToSeconds(interval: string): number {
  const m = interval.match(/^(\d+)(s|m)$/);
  if (!m) return 60;
  const n = Number(m[1]);
  return m[2] === 's' ? n : n * 60;
}

export const runtime = 'nodejs';

export async function GET() {
  const settings = await getSettings();
  const start = Date.now();

  const ms = await photonFetch<MemescopeResponse>(settings, '/api/memescope/search');
  const col = settings.discovery.columnKey;
  const items = (ms.columns as any)[col]?.data ?? [];
  const normalized = items.map((it: any) => normalizeFromMemescope(it));
  const scored = normalized.map((c) => ({ coin: c, scored: scoreCoin(settings, c) }))
    .filter((x) => x.scored.eligible)
    .sort((a, b) => b.scored.score - a.scored.score)
    .slice(0, Math.min(25, settings.discovery.maxItems));

  // Lightweight RSI refresh for top candidates (no LLM here)
  const nowS = Math.floor(Date.now() / 1000);
  const interval = settings.rsi.interval;
  const fromS = nowS - settings.rsi.barsLookback * intervalToSeconds(interval);

  const out = [] as any[];
  for (const item of scored) {
    const pool_id = Number(item.coin.id);
    let rsi: number | null = null;
    try {
      const candles = await photonFetch<any[]>(
        settings,
        `/api/charts/tradingview_range?pool_id=${pool_id}&from=${fromS}&to=${nowS}&interval=${encodeURIComponent(interval)}&amount_index=0&r_from=${fromS}&r_to=0&cb=1&currency=usd`
      );
      const closes = candles.map((c: any) => Number(c.c)).filter((n: number) => Number.isFinite(n));
      rsi = computeRSI(closes, settings.rsi.length);
    } catch {
      // ignore
    }

    out.push({ ...item.coin, score: item.scored.score, tier: item.scored.tier, rsi });
  }

  await logEvent('cron_tick', { ms: Date.now() - start, processed: out.length, col });
  return NextResponse.json({ success: true, processed: out.length, col, items: out });
}
