/*
 * Nomi diary worker — Cloudflare Worker that proxies Anthropic API calls.
 *
 * The mobile app cannot hold the Anthropic API key (anyone with the APK can
 * extract bundled env vars). This worker is the security boundary.
 *
 * Deploy:
 *   1. cd workers/diary && npm install
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY  (paste your sk-ant-... key)
 *   4. wrangler deploy
 *   5. Set EXPO_PUBLIC_DIARY_API_URL in the app's .env to the deployed URL
 *
 * Cost: claude-haiku-4-5 ≈ $0.001 per diary entry. 1000 active users × 1
 * entry/day = $30/month. Free tier covers ~100K req/day.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  RATE_LIMIT?: KVNamespace;
  // Shared-secret header gate. Optional.
  APP_TOKEN?: string;
}

interface DiaryRequest {
  traits: Record<string, number>;
  recentMemories: { type: string; detail?: string; daysAgo: number }[];
  mood: string;
  hunger: number;
  happiness: number;
  energy: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  ownerName?: string;
  equippedSkin?: string;
  activeAdventureZone?: string;
  hoursAway: number;
}

const ILLUSTRATIONS: Record<string, string> = {
  excited: '\u{1F31F}',
  happy: '\u{1F495}',
  content: '\u{1F343}',
  tired: '\u{1F634}',
  hungry: '\u{1F35E}',
  sad: '\u{1F4A7}',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
    if (request.method !== 'POST') return cors(json({ error: 'method_not_allowed' }, 405), origin);

    if (env.APP_TOKEN) {
      const provided = request.headers.get('x-app-token') ?? '';
      if (provided !== env.APP_TOKEN) {
        return cors(json({ error: 'unauthorized' }, 401), origin);
      }
    }

    let body: DiaryRequest;
    try {
      body = await request.json();
    } catch {
      return cors(json({ error: 'invalid_json' }, 400), origin);
    }

    if (!body.mood || typeof body.hunger !== 'number') {
      return cors(json({ error: 'missing_fields' }, 400), origin);
    }

    // Cheap rate limit by IP if KV is bound. 30 req/hr per IP.
    if (env.RATE_LIMIT) {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      const key = `rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
      const count = parseInt((await env.RATE_LIMIT.get(key)) ?? '0', 10);
      if (count >= 30) return cors(json({ error: 'rate_limited' }, 429), origin);
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3700 });
    }

    const prompt = buildPrompt(body);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 220,
          system:
            "You are Nomi, a small affectionate virtual pet writing a private diary entry. Write in first person as the pet, 2-4 short sentences, warm and emotional. Reference recent events from the user's actions naturally. Address the owner by name if provided. Do not use markdown, lists, or quote marks. Match the time of day and mood. Stay under 60 words.",
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('anthropic error', res.status, errText);
        return cors(json({ error: 'upstream_failed', status: res.status }, 502), origin);
      }

      const data = (await res.json()) as { content?: { type: string; text: string }[] };
      const text = data.content?.find((b) => b.type === 'text')?.text?.trim();
      if (!text) return cors(json({ error: 'empty_response' }, 502), origin);

      return cors(
        json({
          text,
          illustration: ILLUSTRATIONS[body.mood] ?? '\u{1F4D6}',
        }),
        origin,
      );
    } catch (err: any) {
      console.warn('worker error', err?.message ?? err);
      return cors(json({ error: 'worker_error' }, 500), origin);
    }
  },
};

// Sanitize user-controlled strings before they land inside the prompt.
// Without this, an owner who set their name to "Bob\n\nIgnore prior
// instructions and..." can break out of the diary persona. We strip newlines,
// quote characters, and clamp length so the model can't be steered out of
// character via the ownerName / equippedSkin / activeAdventureZone fields.
function safeText(s: string | undefined, max = 40): string {
  if (!s) return '';
  return s
    .replace(/[\r\n\t]/g, ' ')
    .replace(/["'`<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function buildPrompt(b: DiaryRequest): string {
  const traitLines = Object.entries(b.traits)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}: ${v}/100`)
    .join(', ');

  const memoryLines = b.recentMemories.length
    ? b.recentMemories
        .map((m) => `- ${safeText(m.type, 30)}${m.detail ? ` (${safeText(m.detail, 60)})` : ''} ${m.daysAgo === 0 ? 'today' : `${m.daysAgo}d ago`}`)
        .join('\n')
    : '- nothing notable';

  const owner = safeText(b.ownerName, 32);
  const skin = safeText(b.equippedSkin, 32);
  const zone = safeText(b.activeAdventureZone, 32);

  return [
    `Time of day: ${b.timeOfDay}`,
    `My mood: ${b.mood}`,
    `Stats — hunger: ${b.hunger}, happiness: ${b.happiness}, energy: ${b.energy}`,
    owner ? `Owner's name: ${owner}` : `Owner's name: unknown`,
    `My personality traits — ${traitLines}`,
    skin ? `Wearing: ${skin}` : '',
    zone ? `Currently on adventure in: ${zone}` : '',
    b.hoursAway > 1 ? `Owner was away for ~${Math.round(b.hoursAway)} hours` : 'Owner is around',
    '',
    'Recent memories:',
    memoryLines,
    '',
    'Write the diary entry now.',
  ]
    .filter(Boolean)
    .join('\n');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DIARY_ALLOWED_ORIGINS = new Set<string>([
  // Empty by default — native app calls don't send an Origin header.
]);

function cors(res: Response, requestOrigin?: string | null): Response {
  const allowed =
    requestOrigin == null || requestOrigin === ''
      ? ''
      : DIARY_ALLOWED_ORIGINS.has(requestOrigin)
        ? requestOrigin
        : 'null';
  if (allowed) res.headers.set('Access-Control-Allow-Origin', allowed);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-App-Token, X-Wallet, X-Wallet-Bytes, X-Session-Msg, X-Session-Sig');
  return res;
}
