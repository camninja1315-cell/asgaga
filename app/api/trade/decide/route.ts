import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSettings, logEvent } from '@/lib/storage';
import { scoreCoin } from '@/lib/scoring';
import { computeRSI } from '@/lib/rsi';
import { photonFetch } from '@/lib/photon';
import { callDecisionLLM } from '@/lib/llmRouter';

function intervalToSeconds(interval: string): number {
  const m = interval.match(/^(\d+)(s|m)$/);
  if (!m) return 60;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === 's' ? n : n * 60;
}

const BodySchema = z.object({
  coin: z.any(),
  poolId: z.number().int().optional(),
  pumpPoolId: z.number().int().optional(),
  candle: z.object({ from: z.number(), to: z.number(), interval: z.string() }).optional()
});

export async function POST(req: Request) {
  const settings = await getSettings();
  const body = BodySchema.parse(await req.json());

  // Re-score with current settings (ensures UI stale data doesn't matter)
  const scored = scoreCoin(settings, body.coin);

  const now = Math.floor(Date.now() / 1000);
  const interval = body.candle?.interval ?? settings.rsi.interval;
  const from = body.candle?.from ?? (now - settings.rsi.barsLookback * intervalToSeconds(interval));
  const to = body.candle?.to ?? now;

  let rsi14: number | null = null;
  let rsiSlope = 0;
  let swingLow: number | null = null;
  let swingHigh: number | null = null;

  // Only fetch candles when coin is eligible and near any action window.
  if (scored.eligible) {
    const poolId = Number(body.poolId ?? body.coin.poolId ?? body.coin.id);
    const q = new URLSearchParams({
      pool_id: String(poolId),
      from: String(from),
      to: String(to),
      interval,
      amount_index: '0',
      r_from: String(from),
      r_to: '0',
      cb: '0',
      currency: 'usd',
    });
    if (body.pumpPoolId) q.set('pump_pool_id', String(body.pumpPoolId));

    try {
      const candles = await photonFetch<any[]>(settings, `/api/charts/tradingview_range?${q.toString()}`);
      const closes = candles.map((c) => Number(c.c)).filter((n) => Number.isFinite(n));
      const rsi = computeRSI(closes, settings.rsi.length);
      rsi14 = rsi;
      if (closes.length >= 4) rsiSlope = closes[closes.length - 1] - closes[closes.length - 4];
      const lows = candles.map((c) => Number(c.l)).filter((n) => Number.isFinite(n));
      const highs = candles.map((c) => Number(c.h)).filter((n) => Number.isFinite(n));
      const swingBars = Math.min(30, Math.max(5, Math.floor(settings.rsi.barsLookback / 4)));
      if (lows.length) swingLow = Math.min(...lows.slice(-swingBars));
      if (highs.length) swingHigh = Math.max(...highs.slice(-swingBars));
    } catch (e) {
      await logEvent('api_error', { where: 'candles', error: String(e) });
    }
  }

  const mcap = body.coin.mcap ?? Number(body.coin.fdv ?? 0);

  // Determine intent
  let intent: 'buy' | 'sell' | 'hold' = 'hold';
  const reasons: string[] = [];

  const entryMin = settings.tradePlan.entryMcapMin;
  const entryMax = settings.tradePlan.entryMcapMax;
  const target = mcap * settings.tradePlan.targetMultiplier;
  const stop = mcap * settings.tradePlan.stopMultiplier;

  const rsiOk = rsi14 == null ? false : (rsi14 <= settings.rsi.entryRsiMax && rsi14 >= settings.rsi.entryRsiMin);
  const rsiRising = rsiSlope > 0;

  if (scored.eligible && scored.tier === 'trade_candidate') {
    if (mcap >= entryMin && mcap <= entryMax && rsiOk && rsiRising) {
      intent = 'buy';
      reasons.push('Eligible + trade_candidate', `mcap in entry window ${entryMin}-${entryMax}`, `RSI ok (${rsi14?.toFixed(1)}) and rising`);
    } else {
      reasons.push('Trade candidate but waiting for entry conditions');
    }
  } else {
    reasons.push('Not a trade candidate');
  }

  // Optional LLM veto/adjust
  let llm: any = null;
  if (settings.llm.enabled && settings.llm.endpoints.length) {
    const pack = {
      symbol: body.coin.symbol,
      name: body.coin.name,
      tokenAddress: body.coin.tokenAddress,
      poolAddress: body.coin.poolAddress,
      mcap,
      liquidityUsd: body.coin.liquidityUsd,
      liqRatio: scored.computed.liqRatio,
      volume: body.coin.volume,
      buys: body.coin.buys,
      sells: body.coin.sells,
      sellRatio: scored.computed.sellRatio,
      audit: body.coin.audit,
      healthScore: scored.score,
      tier: scored.tier,
      rsi14,
      swingLow,
      swingHigh,
      plan: { entryMin, entryMax, targetMultiplier: settings.tradePlan.targetMultiplier, stopMultiplier: settings.tradePlan.stopMultiplier }
    };

    try {
      llm = await callDecisionLLM(settings, pack);
      const d = llm?.decision;
      if (d?.intent === 'hold') intent = 'hold';
      if (d?.intent === 'buy' && intent !== 'buy') {
        // LLM cannot force a buy if hard conditions don't pass
        (llm as any).note = 'LLM suggested buy, but hard entry conditions did not pass. Holding.';
      }
      if (d?.intent === 'sell') {
        // Sell decisions are supported, but require an open position in the position ledger.
        intent = 'sell';
      }
    } catch (e) {
      await logEvent('llm_error', { error: String(e) });
    }
  }

  const thought = {
    thoughtId: crypto.randomUUID(),
    ts: Date.now(),
    intent,
    health: scored,
    signals: { mcap, rsi14, rsiSlope, swingLow, swingHigh },
    plan: { entryMin, entryMax, targetMcap: target, stopMcap: stop },
    reasons,
    llm,
    configVersion: settings.app.configVersion,
  };

  await logEvent('thought', thought);

  // Proposal skeleton (execution builds the final payload)
  const proposal = {
    proposalId: crypto.randomUUID(),
    thoughtId: thought.thoughtId,
    action: intent,
    mode: settings.app.mode,
    canExecute: settings.app.autoExecute && (settings.app.mode === 'paper' || settings.app.enableLiveTrading),
  };

  return NextResponse.json({ success: true, thought, proposal });
}
