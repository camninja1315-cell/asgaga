export function computeRSI(closes: number[], length: number): number | null {
  if (closes.length < length + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = closes.length - length; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta; else losses -= delta;
  }

  const avgGain = gains / length;
  const avgLoss = losses / length;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number.isFinite(rsi) ? rsi : null;
}

export function rsiSlope(closes: number[], length: number, window: number): number | null {
  if (closes.length < length + window + 1) return null;
  const rsis: number[] = [];
  for (let i = closes.length - window; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const v = computeRSI(slice, length);
    if (v === null) return null;
    rsis.push(v);
  }
  const first = rsis[0];
  const last = rsis[rsis.length - 1];
  return last - first;
}
