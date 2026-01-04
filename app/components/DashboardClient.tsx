'use client';

import { useEffect, useMemo, useState } from 'react';

type Coin = {
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
  holders: { holdersCount: number | null; devHoldPerc: number | null; snipersHoldPerc: number | null; insidersHoldPerc: number | null; freshHoldPerc: number | null; bundleHoldPerc: number | null };
  score: number;
  tier: 'rejected' | 'watch' | 'monitor' | 'trade_candidate';
  reasons: string[];
  rsi14?: number;
};

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function DashboardClient() {
  const [col, setCol] = useState<'col1' | 'col2' | 'col3'>('col1');
  const [auto, setAuto] = useState(true);
  const [data, setData] = useState<{ title: string; coins: Coin[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/coins/discover?col=${col}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`discover failed: ${r.status}`);
      const j = await r.json();
      setData(j);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, col]);

  const stats = useMemo(() => {
    const coins = data?.coins ?? [];
    const tiers = coins.reduce(
      (acc, c) => {
        acc[c.tier] = (acc[c.tier] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return { total: coins.length, tiers };
  }, [data]);

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Memescope: {data?.title ?? '—'}</div>
          <div className="muted small">Auto-scored using settings-driven gates + market-cap based trade plan</div>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <select className="select" value={col} onChange={(e) => setCol(e.target.value as any)} style={{ width: 150 }}>
            <option value="col1">New</option>
            <option value="col2">Graduating</option>
            <option value="col3">Graduated</option>
          </select>
          <label className="badge" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ marginRight: 8 }} />
            Auto-refresh
          </label>
          <button className="button" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <span className="badge">Total: {stats.total}</span>
        <span className="badge">TradeCandidate: {stats.tiers.trade_candidate ?? 0}</span>
        <span className="badge">Monitor: {stats.tiers.monitor ?? 0}</span>
        <span className="badge">Watch: {stats.tiers.watch ?? 0}</span>
        <span className="badge">Rejected: {stats.tiers.rejected ?? 0}</span>
      </div>

      {error && (
        <div style={{ marginTop: 12 }} className="muted">
          Error: {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th">Tier</th>
              <th className="th">Score</th>
              <th className="th">Token</th>
              <th className="th">MCAP</th>
              <th className="th">Liq</th>
              <th className="th">Vol</th>
              <th className="th">B/S</th>
              <th className="th">Age</th>
              <th className="th">Dev%</th>
              <th className="th">TopHolders%</th>
              <th className="th">RSI(14)</th>
              <th className="th">Why</th>
            </tr>
          </thead>
          <tbody>
            {(data?.coins ?? []).map((c) => (
              <tr key={c.id}>
                <td className="td"><span className="badge">{c.tier}</span></td>
                <td className="td">{c.score}</td>
                <td className="td">
                  <div style={{ fontWeight: 700 }}>{c.symbol}</div>
                  <div className="muted small">{c.name}</div>
                </td>
                <td className="td">${fmt(c.mcap, 0)}</td>
                <td className="td">${fmt(c.liquidityUsd, 0)}</td>
                <td className="td">${fmt(c.volume, 0)}</td>
                <td className="td">{c.buys}/{c.sells}</td>
                <td className="td">{Math.max(0, Math.floor(c.ageSec / 60))}m</td>
                <td className="td">{fmt(c.holders.devHoldPerc, 2)}</td>
                <td className="td">{fmt(c.audit.topHoldersPerc, 2)}</td>
                <td className="td">{c.rsi14 === undefined ? '-' : fmt(c.rsi14, 1)}</td>
                <td className="td" title={c.reasons.join('\n')}>{c.reasons.slice(0, 2).join('; ')}{c.reasons.length > 2 ? '…' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted small" style={{ marginTop: 12 }}>
        Tip: trade execution is disabled by default. Enable it in Settings only after you confirm your Photon auth/cookies and guardrails.
      </div>
    </div>
  );
}
