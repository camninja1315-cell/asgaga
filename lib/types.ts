// --- Photon API types (as captured from your docs) ---

export type MemescopeItem = {
  id: string;
  type?: string;
  attributes: {
    volume: string;
    buys_count: number;
    sells_count: number;
    address: string; // pool address
    fdv: string; // market cap (USD)
    name: string;
    symbol: string;
    tokenAddress: string;
    created_timestamp: number;
    init_liq: { quote: string; usd: string; timestamp: number };
    cur_liq: { usd: string; quote: string };
    audit: {
      mint_authority: boolean;
      freeze_authority: boolean;
      lp_burned_perc?: number;
      top_holders_perc?: string;
    };
    socials?: Record<string, string | null>;
    holders_count?: number;
    dev_holding_perc?: string;
    insiders_holding_perc?: string | null;
    snipers_holding_perc?: string | null;
    fresh_holding_perc?: string;
    bundle_holding_perc?: string;
    fresh_holders_count?: number;
    bundle_holders_count?: number;
    imgUrl?: string;
    pump_pool_id?: string | number;
  };
};

export type MemescopeResponse = {
  columns: Record<string, { data: MemescopeItem[] }>;
  titles?: Record<string, string>;
};

export type TradingviewBar = {
  timestamp: number; // ms
  o: string;
  c: string;
  h: string;
  l: string;
  volume: number;
};

// --- Dashboard view models ---

export type CoinView = {
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
  ageSec: number;
  audit: { mintAuthority: boolean; freezeAuthority: boolean; lpBurnedPerc: number | null; topHoldersPerc: number | null };
  holders: {
    holdersCount: number | null;
    devHoldPerc: number | null;
    snipersHoldPerc: number | null;
    insidersHoldPerc: number | null;
    freshHoldPerc: number | null;
    bundleHoldPerc: number | null;
    freshHoldersCount: number | null;
    bundleHoldersCount: number | null;
  };
  score: number;
  tier: 'rejected' | 'watch' | 'monitor' | 'trade_candidate';
  reasons: string[];
  rsi14?: number;
  rsiSlope?: number;
  swingLow?: number;
  swingHigh?: number;
};
