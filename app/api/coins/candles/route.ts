import { NextResponse } from 'next/server';
import { getSettings, logEvent } from '@/lib/storage';
import { photonFetch } from '@/lib/photon';
import { computeRSI } from '@/lib/rsi';

function intervalToSeconds(interval: string): number {
  const m = interval.match(/^(\d+)(s|m)$/);
  if (!m) return 60;
  const n = Number(m[1]);
  return m[2] === 's' ? n : n * 60;
}

type Candle = { timestamp: number; o: string; c: string; h: string; l: string; volume: number };

export async function GET(req: Request) {
  const settings = await getSettings();
  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get('pool_id');
  if (!poolId) return NextResponse.json({ success: false, error: 'pool_id required' }, { status: 400 });

  const interval = searchParams.get('interval') ?? settings.rsi.interval;
  const currency = searchParams.get('currency') ?? 'usd';
  const nowSec = Math.floor(Date.now() / 1000);
  const to = Number(searchParams.get('to') ?? nowSec);
  const defaultLookbackS = settings.rsi.barsLookback * intervalToSeconds(interval);
  const from = Number(searchParams.get('from') ?? (to - defaultLookbackS));
  const pumpPoolId = searchParams.get('pump_pool_id');

  const qs = new URLSearchParams({
    pool_id: poolId,
    from: String(from),
    to: String(to),
    interval,
    amount_index: '0',
    r_from: String(from),
    r_to: '0',
    cb: '0',
    currency,
  });
  if (pumpPoolId) qs.set('pump_pool_id', pumpPoolId);

  const path = `/api/charts/tradingview_range?${qs.toString()}`;

  const t0 = Date.now();
  const candles = await photonFetch<Candle[]>(settings, path, { method: 'GET' });
  await logEvent('api_call', { endpoint: path, method: 'GET', latency_ms: Date.now() - t0, ok: true, poolId });

  const closes = candles.map(c => Number(c.c));
  const rsi = computeRSI(closes, settings.rsi.length);
  const swingBars = Math.min(30, Math.max(5, Math.floor(settings.rsi.barsLookback / 4)));
  const recent = candles.slice(Math.max(0, candles.length - swingBars));
  const swingLow = recent.reduce((m, x) => Math.min(m, Number(x.l)), Number.POSITIVE_INFINITY);
  const swingHigh = recent.reduce((m, x) => Math.max(m, Number(x.h)), Number.NEGATIVE_INFINITY);

  return NextResponse.json({ success: true, meta: { poolId, from, to, interval, currency }, rsi, swingLow, swingHigh, candles });
}
