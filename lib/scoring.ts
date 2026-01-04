import type { Settings } from './settings';
import type { MemescopeItem } from './types';

export type NormalizedCoin = {
  id: string;
  symbol: string;
  name: string;
  tokenAddress: string;
  poolAddress: string;
  mcap: number;
  liquidityUsd: number;
  volume: number;
  buys: number;
  sells: number;
  createdTimestamp: number;
  audit: {
    mintAuthority: boolean;
    freezeAuthority: boolean;
    lpBurnedPerc: number | null;
    topHoldersPerc: number | null;
  };
  holders: {
    holdersCount: number | null;
    devHoldPerc: number | null;
    insidersHoldPerc: number | null;
    snipersHoldPerc: number | null;
    freshHoldPerc: number | null;
    bundleHoldPerc: number | null;
    bundleHoldersCount: number | null;
  };
};

export type ScoreResult = {
  eligible: boolean;
  hardFails: string[];
  score: number;
  tier: 'rejected' | 'watch' | 'monitor' | 'trade_candidate';
  reasons: string[];
  computed: {
    ageSec: number;
    liqRatio: number;
    sellRatio: number;
  };
};

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : null;
}

/**
 * Normalizes a Photon memescope/search row into the canonical coin shape we score on.
 * This uses *market cap* (fdv) rather than spot price.
 */
export function normalizeFromMemescope(item: MemescopeItem): NormalizedCoin {
  const a = item.attributes;

  const lpBurned = typeof a.audit?.lp_burned_perc === 'number' ? a.audit.lp_burned_perc : null;
  const topHolders = a.audit?.top_holders_perc ? n(a.audit.top_holders_perc) : null;

  return {
    id: item.id,
    symbol: a.symbol,
    name: a.name,
    tokenAddress: a.tokenAddress,
    poolAddress: a.address,
    mcap: n(a.fdv) ?? 0,
    liquidityUsd: n(a.cur_liq?.usd) ?? 0,
    volume: n(a.volume) ?? 0,
    buys: n(a.buys_count) ?? 0,
    sells: n(a.sells_count) ?? 0,
    createdTimestamp: n(a.created_timestamp) ?? 0,
    audit: {
      mintAuthority: Boolean(a.audit?.mint_authority),
      freezeAuthority: Boolean(a.audit?.freeze_authority),
      lpBurnedPerc: lpBurned,
      topHoldersPerc: topHolders,
    },
    holders: {
      holdersCount: a.holders_count ?? null,
      devHoldPerc: a.dev_holding_perc != null ? n(a.dev_holding_perc) : null,
      insidersHoldPerc: a.insiders_holding_perc != null ? n(a.insiders_holding_perc) : null,
      snipersHoldPerc: a.snipers_holding_perc != null ? n(a.snipers_holding_perc) : null,
      freshHoldPerc: a.fresh_holding_perc != null ? n(a.fresh_holding_perc) : null,
      bundleHoldPerc: a.bundle_holding_perc != null ? n(a.bundle_holding_perc) : null,
      bundleHoldersCount: a.bundle_holders_count ?? null,
    },
  };
}

export function scoreCoin(settings: Settings, coin: NormalizedCoin, nowSec = Math.floor(Date.now() / 1000)): ScoreResult {
  const { healthy, scoring } = settings;
  const hardFails: string[] = [];
  const reasons: string[] = [];

  const ageSec = Math.max(0, nowSec - coin.createdTimestamp);
  const liqRatio = coin.mcap > 0 ? coin.liquidityUsd / coin.mcap : 0;
  const sellRatio = coin.buys > 0 ? coin.sells / coin.buys : coin.sells;

  // Hard gates
  if (healthy.audit.requireMintAuthorityFalse && coin.audit.mintAuthority) hardFails.push('mint_authority_true');
  if (healthy.audit.requireFreezeAuthorityFalse && coin.audit.freezeAuthority) hardFails.push('freeze_authority_true');
  if (coin.audit.lpBurnedPerc !== null && coin.audit.lpBurnedPerc < healthy.audit.minLpBurnedPercIfPresent) {
    hardFails.push('lp_burned_below_min');
  }

  if (coin.liquidityUsd < healthy.minLiquidityUsd) hardFails.push('liquidity_below_min');
  if (coin.mcap < healthy.minMarketCapUsd) hardFails.push('mcap_below_min');
  if (healthy.maxMarketCapUsd !== null && coin.mcap > healthy.maxMarketCapUsd) {
    // Not a hard fail; keep monitorable but score penalty.
    reasons.push('mcap_above_preferred_range');
  }

  if (liqRatio < healthy.minLiqRatio) hardFails.push('liq_ratio_below_min');

  const dev = coin.holders.devHoldPerc;
  if (dev !== null && dev > healthy.holders.maxDevHoldPerc) hardFails.push('dev_hold_above_max');
  const sn = coin.holders.snipersHoldPerc;
  if (sn !== null && sn > healthy.holders.maxSnipersHoldPerc) hardFails.push('snipers_hold_above_max');
  const ins = coin.holders.insidersHoldPerc;
  if (ins !== null && ins > healthy.holders.maxInsidersHoldPerc) hardFails.push('insiders_hold_above_max');

  const eligible = hardFails.length === 0;

  // Score
  let score = 100;

  // Audit penalties
  if (coin.audit.lpBurnedPerc !== null) {
    if (coin.audit.lpBurnedPerc < healthy.audit.warnLpBurnedPerc) score -= 10;
  }

  // Liquidity / ratio penalties
  if (coin.liquidityUsd < Math.max(healthy.minLiquidityUsd, 10000)) score -= 10;
  if (liqRatio < healthy.warnLiqRatio) score -= 12;
  else if (liqRatio < 0.05) score -= 6;

  if (coin.mcap >= healthy.minMarketCapUsd && coin.mcap <= healthy.minMarketCapUsd * 1.5) score -= 4;
  if (healthy.maxMarketCapUsd !== null && coin.mcap > healthy.maxMarketCapUsd) score -= 6;

  // Flow
  if (sellRatio > healthy.flow.sellRatioWarn) score -= 6;
  if (sellRatio > healthy.flow.sellRatioFail) score -= 12;

  // Holder penalties
  if (dev !== null && dev >= healthy.holders.warnDevHoldPerc) score -= 8;
  if (sn !== null && sn >= healthy.holders.warnSnipersHoldPerc) score -= 6;
  if (ins !== null && ins >= healthy.holders.warnInsidersHoldPerc) score -= 6;

  const holdersCount = n(coin.holders.holdersCount) ?? null;
  const bundleCount = n(coin.holders.bundleHoldersCount) ?? null;
  if (holdersCount && bundleCount) {
    const bundleRatio = bundleCount / Math.max(holdersCount, 1);
    if (bundleRatio > healthy.holders.bundleRatioFail) score -= 12;
    else if (bundleRatio > healthy.holders.bundleRatioWarn) score -= 6;
  }

  score = Math.max(0, Math.min(100, score));

  // Reasons
  if (!eligible) reasons.push(...hardFails);
  if (liqRatio < 0.03) reasons.push('thin_liquidity_ratio');
  if (sellRatio > 1.15) reasons.push('sell_pressure');
  if (coin.audit.topHoldersPerc !== null && coin.audit.topHoldersPerc > 35) reasons.push('top_holders_concentration');

  // Tier
  let tier: ScoreResult['tier'] = 'rejected';
  if (eligible) {
    if (score >= scoring.tradeCandidate) tier = 'trade_candidate';
    else if (score >= scoring.monitor) tier = 'monitor';
    else if (score >= scoring.watch) tier = 'watch';
    else tier = 'watch';
  }

  return { eligible, hardFails, score, tier, reasons, computed: { ageSec, liqRatio, sellRatio } };
}
