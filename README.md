# Photon Autodash (Vercel)

This is a **safe-by-default** Next.js dashboard + API layer that:

- Pulls coin candidates from Photon memescope (`/api/memescope/search`)
- Applies your **healthy-to-monitor** filters (market cap + liquidity + audit + holder gates)
- Fetches candle bars (`/api/charts/tradingview_range`) to compute RSI + swing highs/lows
- Optionally asks one of **multiple LM Studio** endpoints for a buy/sell/hold JSON decision
- Optionally executes trades through Photon purchase endpoint (`/api/purchases`) in **paper** or **live** mode

## Deploy

1. Deploy to Vercel.
2. Visit `/settings` and set:
   - `photon.cookie` (Cookie header string) if Photon requires auth
   - `photon.wallets` and `photon.associatedAccs`
   - `photon.curBalanceSol` (required by Photon purchase payload)
   - `app.mode` = `paper` or `live`
   - `app.autoExecute` and `app.enableLiveTrading` (both must be true to live-trade)

## Optional persistence (recommended)

By default, settings/logs are in-memory (serverless resets).

To persist:
- Create **Vercel Postgres**, then run `db/schema.sql` in the query console.
- Vercel will inject `POSTGRES_URL`/`DATABASE_URL` and the app will auto-use it.

## API endpoints

- `GET /api/coins/discover?col=col1&limit=100`
- `GET /api/coins/candles?pool_id=...&interval=1m`
- `POST /api/trade/decide` `{ coin, poolId? }`
- `POST /api/trade/execute` (guarded; paper by default)
- `GET /api/cron/tick` (called by Vercel cron if enabled)

## LM Studio

Add endpoints in settings:

```json
{"llm":{"enabled":true,"endpoints":[{"key":"local1","baseUrl":"http://127.0.0.1:1234","model":"qwen2.5-14b-instruct","maxConcurrency":2,"maxChars":6000}]}}
```

> Vercel can't reach `127.0.0.1`. Use a reachable host (VPN/tunnel) or run the LLM in a hosted environment.
