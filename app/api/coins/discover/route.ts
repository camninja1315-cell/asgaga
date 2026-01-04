import { NextResponse } from 'next/server';
import { getSettings, logEvent } from '@/lib/storage';
import { photonFetch } from '@/lib/photon';
import type { MemescopeResponse } from '@/lib/types';
import { normalizeFromMemescope, scoreCoin } from '@/lib/scoring';

export async function GET(req: Request) {
  const settings = await getSettings();
  const { searchParams } = new URL(req.url);
  const column = searchParams.get('col') ?? 'col1';
  const limit = Math.max(1, Math.min(250, Number(searchParams.get('limit') ?? '100')));

  const json = await photonFetch<MemescopeResponse>(settings, '/api/memescope/search', {
    method: 'GET',
    cache: 'no-store',
  });

  const data = json.columns?.[column]?.data ?? [];
  const coins = data.slice(0, limit).map((item) => {
    const c = normalizeFromMemescope(item);
    const scored = scoreCoin(settings, c);
    return {
      ...c,
      ...scored,
      ageSec: scored.computed.ageSec,
      liqRatio: scored.computed.liqRatio,
      sellRatio: scored.computed.sellRatio,
    };
  });

  await logEvent('api_call', { endpoint: '/api/memescope/search', column, limit, returned: coins.length });

  return NextResponse.json({ success: true, column, coins });
}
