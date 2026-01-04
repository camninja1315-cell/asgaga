import type { Settings } from './settings';

export class PhotonError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

export async function photonFetch<T>(settings: Settings, path: string, init?: RequestInit): Promise<T> {
  const base = settings.photon.baseUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers: Record<string, string> = {
    'user-agent': 'photon-autodash/0.1',
    ...(init?.headers as Record<string, string> | undefined),
  };

  // Photon endpoints often require an authenticated session cookie from your logged-in browser.
  // Prefer settings, but allow env override for safer secret management.
  const cookie = settings.photon.cookie || process.env.PHOTON_COOKIE || '';
  if (cookie && !headers.cookie && !headers.Cookie) headers.cookie = cookie;

  const resp = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await resp.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!resp.ok) {
    throw new PhotonError(`Photon request failed: ${resp.status} ${resp.statusText}`, resp.status, body);
  }

  return body as T;
}
