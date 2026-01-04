import type { Settings } from './settings';

// Safe-by-default. Change in /settings.
export const DEFAULT_SETTINGS: Settings = {
  app: {
    configVersion: 1,
    mode: 'paper',
    autoExecute: false,
    enableLiveTrading: false,
    maxConcurrentPositions: 2,
    maxDailyLossUsd: 25,
    cooldownAfterSellS: 45,
    maxApiErrorsInWindow: 5,
    apiErrorWindowS: 120,
  },

  photon: {
    baseUrl: 'https://photon-sol.tinyastro.io',
    cookie: '',
    wallets: '',
    associatedAccs: '',
    curBalanceSol: 0,
  },

  discovery: {
    columnKey: 'col1',
    refreshS: 10,
    maxItems: 100,
  },

  healthy: {
    minLiquidityUsd: 7500,
    minMarketCapUsd: 12000,
    maxMarketCapUsd: 250000,
    minLiqRatio: 0.02,
    warnLiqRatio: 0.03,
    audit: {
      requireMintAuthorityFalse: true,
      requireFreezeAuthorityFalse: true,
      minLpBurnedPercIfPresent: 80,
      warnLpBurnedPerc: 90,
    },
    holders: {
      maxDevHoldPerc: 8,
      warnDevHoldPerc: 5,
      maxSnipersHoldPerc: 20,
      warnSnipersHoldPerc: 10,
      maxInsidersHoldPerc: 10,
      warnInsidersHoldPerc: 5,
      bundleRatioWarn: 0.25,
      bundleRatioFail: 0.40,
    },
    flow: {
      sellRatioWarn: 1.15,
      sellRatioFail: 1.35,
    },
  },

  scoring: {
    watch: 60,
    monitor: 75,
    tradeCandidate: 85,
  },

  rsi: {
    length: 14,
    entryRsiMin: 25,
    entryRsiMax: 40,
    avoidEntryRsiAbove: 65,
    exitRsi: 72,
    interval: '1m',
    barsLookback: 120,
  },

  tradePlan: {
    entryMcapMin: 18000,
    entryMcapMax: 24000,
    targetMultiplier: 1.7,
    stopMultiplier: 0.75,
  },

  execution: {
    defaultBuySol: 0.01,
    buySlippage: 5,
    sellSlippage: 20,
    usePrivateNode: true,
    priority: 0.0001,
    bribery: 0.0001,
    strategy: 'default',
    sellAmtsKind: 'perc',
    sellPerc: 100,
  },

  llm: {
    enabled: false,
    endpoints: [],
    prompts: {
      decisionSystem: 'You are a cautious trading copilot. You must output strict JSON only.',
      decisionUserTemplate:
        'Given this compact pack, decide intent (buy/sell/hold) and return JSON with rationale, risks, invalidations, confidence.\nPACK:\n{{pack}}',
    },
  },
};
