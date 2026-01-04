import type { Settings } from './settings';

export type LlmDecision = {
  intent: 'buy' | 'sell' | 'hold';
  confidence: number;
  rationale: string[];
  risks: string[];
  invalidations: string[];
};

type Worker = {
  key: string;
  baseUrl: string;
  model: string;
  maxConcurrency: number;
  inflight: number;
};

const workers: Map<string, Worker> = new Map();

function loadWorkers(settings: Settings): Worker[] {
  const list: Worker[] = settings.llm.endpoints.map((e) => {
    const key = `${e.baseUrl}||${e.model}`;
    const existing = workers.get(key);
    const w: Worker = existing ?? { key, baseUrl: e.baseUrl.replace(/\/$/, ''), model: e.model, maxConcurrency: e.maxConcurrency, inflight: 0 };
    w.maxConcurrency = e.maxConcurrency;
    workers.set(key, w);
    return w;
  });
  return list;
}

function pickWorker(ws: Worker[]): Worker | null {
  const candidates = ws.filter((w) => w.inflight < w.maxConcurrency);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.inflight - b.inflight);
  return candidates[0] ?? null;
}

export async function callDecisionLLM(settings: Settings, pack: unknown): Promise<{ worker: string; decision: LlmDecision } | null> {
  if (!settings.llm.enabled) return null;
  const ws = loadWorkers(settings);
  const w = pickWorker(ws);
  if (!w) return null;

  w.inflight++;
  try {
    const sys = settings.llm.prompts.decisionSystem;
    const user = settings.llm.prompts.decisionUserTemplate.replace('{{pack}}', JSON.stringify(pack));

    // LM Studio exposes an OpenAI-compatible chat completions route by default.
    const res = await fetch(`${w.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: w.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const intent = parsed.intent;
    const decision: LlmDecision = {
      intent: intent === 'buy' || intent === 'sell' ? intent : 'hold',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      invalidations: Array.isArray(parsed.invalidations) ? parsed.invalidations.map(String) : [],
    };

    return { worker: w.key, decision };
  } finally {
    w.inflight = Math.max(0, w.inflight - 1);
  }
}
