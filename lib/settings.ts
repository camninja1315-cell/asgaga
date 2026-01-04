import { z } from 'zod';

export type Mode = 'paper' | 'live';

export const SettingsSchema = z.object({
  app: z.object({
    // Bump this whenever you change critical knobs; it's written into every event log.
    configVersion: z.number().int().positive().default(1),
    mode: z.enum(['paper', 'live']).default('paper'),
    autoExecute: z.boolean().default(false),
    enableLiveTrading: z.boolean().default(false),
    maxConcurrentPositions: z.number().int().positive().default(2),
    maxDailyLossUsd: z.number().nonnegative().default(25),
    cooldownAfterSellS: z.number().int().nonnegative().default(45),
    maxApiErrorsInWindow: z.number().int().positive().default(5),
    apiErrorWindowS: z.number().int().positive().default(120)
  }),

  photon: z.object({
    baseUrl: z.string().url().default('https://photon-sol.tinyastro.io'),
    // If Photon requires authentication, put your Cookie header string here (or set env PHOTON_COOKIE)
    cookie: z.string().default(''),
    // Wallets/associated accounts passed to purchase + balance endpoints
    wallets: z.string().default(''),
    associatedAccs: z.string().default(''),
    // Used by purchase endpoint payload (required by Photon)
    curBalanceSol: z.number().nonnegative().default(0)
  }),

  discovery: z.object({
    columnKey: z.enum(['col1','col2','col3']).default('col1'),
    refreshS: z.number().int().positive().default(10),
    maxItems: z.number().int().positive().default(100)
  }),

  healthy: z.object({
    minLiquidityUsd: z.number().nonnegative().default(7500),
    minMarketCapUsd: z.number().nonnegative().default(12000),
    maxMarketCapUsd: z.number().nonnegative().default(250000),
    minLiqRatio: z.number().nonnegative().default(0.02),
    warnLiqRatio: z.number().nonnegative().default(0.03),

    requireMintAuthorityFalse: z.boolean().default(true),
    requireFreezeAuthorityFalse: z.boolean().default(true),
    minLpBurnedPercIfPresent: z.number().min(0).max(100).default(80),
    warnLpBurnedPerc: z.number().min(0).max(100).default(90),

    warnDevHoldPerc: z.number().min(0).max(100).default(5),
    maxDevHoldPerc: z.number().min(0).max(100).default(8),
    warnSnipersHoldPerc: z.number().min(0).max(100).default(10),
    maxSnipersHoldPerc: z.number().min(0).max(100).default(20),
    warnInsidersHoldPerc: z.number().min(0).max(100).default(5),
    maxInsidersHoldPerc: z.number().min(0).max(100).default(10),

    bundleRatioWarn: z.number().min(0).max(1).default(0.25),
    bundleRatioFail: z.number().min(0).max(1).default(0.40),

    sellRatioWarn: z.number().nonnegative().default(1.15),
    sellRatioFail: z.number().nonnegative().default(1.35)
  }),

  scoring: z.object({
    watch: z.number().min(0).max(100).default(60),
    monitor: z.number().min(0).max(100).default(75),
    tradeCandidate: z.number().min(0).max(100).default(85)
  }),

  rsi: z.object({
    length: z.number().int().positive().default(14),
    entryRsiMin: z.number().min(0).max(100).default(25),
    entryRsiMax: z.number().min(0).max(100).default(40),
    avoidEntryRsiAbove: z.number().min(0).max(100).default(65),
    exitRsi: z.number().min(0).max(100).default(72),
    interval: z.string().default('5s'),
    barsLookback: z.number().int().positive().default(240) // 240*5s = 20 minutes
  }),

  tradePlan: z.object({
    entryMcapMin: z.number().nonnegative().default(18000),
    entryMcapMax: z.number().nonnegative().default(24000),
    targetMultiplier: z.number().positive().default(1.70),
    stopMultiplier: z.number().positive().default(0.75)
  }),

  execution: z.object({
    defaultBuySol: z.number().positive().default(0.01),
    buySlippage: z.number().min(0).max(100).default(5),
    sellSlippage: z.number().min(0).max(100).default(20),
    usePrivateNode: z.boolean().default(true),
    priority: z.number().nonnegative().default(0.0001),
    bribery: z.number().nonnegative().default(0.0001),
    strategy: z.string().default('default'),
    sellAmtsKind: z.enum(['perc', 'token']).default('perc'),
    sellPerc: z.number().min(0).max(100).default(100)
  }),

  llm: z.object({
    enabled: z.boolean().default(false),
    // A list of LM Studio servers (OpenAI-compatible). Router picks first free.
    endpoints: z.array(z.object({
      name: z.string(),
      baseUrl: z.string().url(),
      apiKey: z.string().default(''),
      model: z.string(),
      maxConcurrency: z.number().int().positive().default(1),
      timeoutMs: z.number().int().positive().default(20000)
    })).default([]),
    promptTemplate: z.string().default(
      'You are a trading risk assistant. Given the compact state JSON, respond ONLY as strict JSON: {"veto": boolean, "confidence": 0..1, "reasons": string[], "entry": {"ok": boolean, "notes": string}, "exit": {"notes": string}}.'
    )
  })
});

export type Settings = z.infer<typeof SettingsSchema>;

export function parseSettings(input: unknown): Settings {
  return SettingsSchema.parse(input);
}
