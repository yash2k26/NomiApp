/*
 * Nomi push worker.
 *
 * Endpoints:
 *   POST /register   { push_token, wallet, pet_name?, owner_name? }
 *   POST /heartbeat  { push_token, wallet, hunger?, happiness?, energy?, level?, streak_days? }
 *
 * Cron (every hour): finds devices with last_active_at between 18-25 hours ago
 * AND last_push_at > 22 hours ago, sends a personality-aware push via Expo
 * Push API, marks last_push_at.
 *
 * Deploy:
 *   1. wrangler login
 *   2. wrangler d1 create nomi-push        → paste database_id into wrangler.toml
 *   3. wrangler d1 migrations apply nomi-push --remote
 *   4. wrangler deploy
 *   5. Set EXPO_PUBLIC_PUSH_API_URL in app .env to deployed URL, rebuild
 *
 * Cost: D1 free tier covers ~5M reads/day. Expo Push API is free. Worker cron
 * is free up to 100K invocations/day.
 */

interface Env {
  DB: D1Database;
  // Shared-secret header gate. Optional; if unset all requests pass through.
  APP_TOKEN?: string;
}

interface DeviceRow {
  push_token: string;
  wallet: string;
  pet_name: string | null;
  owner_name: string | null;
  hunger: number | null;
  happiness: number | null;
  energy: number | null;
  level: number | null;
  streak_days: number | null;
  last_active_at: number;
  last_push_at: number;
}

const HOUR_MS = 60 * 60 * 1000;
const RETURN_PUSH_MIN_HOURS = 18;
const RETURN_PUSH_MAX_HOURS = 25;
const MIN_PUSH_INTERVAL_MS = 22 * HOUR_MS;
const BATCH_SIZE = 100;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);

    if (env.APP_TOKEN) {
      const provided = request.headers.get('x-app-token') ?? '';
      if (provided !== env.APP_TOKEN) {
        return cors(json({ error: 'unauthorized' }, 401), origin);
      }
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/register') {
      return cors(await handleRegister(request, env), origin);
    }
    if (request.method === 'POST' && url.pathname === '/heartbeat') {
      return cors(await handleHeartbeat(request, env), origin);
    }
    if (request.method === 'POST' && url.pathname === '/unregister') {
      return cors(await handleUnregister(request, env), origin);
    }
    return cors(json({ error: 'not_found' }, 404), origin);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendReturnPushes(env));
  },
};

async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { push_token, wallet, pet_name, owner_name } = body ?? {};
  if (!push_token || !wallet) return json({ error: 'missing_fields' }, 400);
  if (!isExpoToken(push_token)) return json({ error: 'invalid_token' }, 400);

  const now = Date.now();
  await env.DB
    .prepare(
      `INSERT INTO devices (push_token, wallet, pet_name, owner_name, last_active_at, last_push_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(push_token) DO UPDATE SET
         wallet = excluded.wallet,
         pet_name = COALESCE(excluded.pet_name, devices.pet_name),
         owner_name = COALESCE(excluded.owner_name, devices.owner_name),
         last_active_at = excluded.last_active_at`,
    )
    .bind(push_token, wallet, pet_name ?? null, owner_name ?? null, now, now)
    .run();

  return json({ ok: true });
}

async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { push_token, wallet, hunger, happiness, energy, level, streak_days } = body ?? {};
  if (!push_token || !wallet) return json({ error: 'missing_fields' }, 400);

  await env.DB
    .prepare(
      `UPDATE devices SET
         last_active_at = ?,
         hunger = COALESCE(?, hunger),
         happiness = COALESCE(?, happiness),
         energy = COALESCE(?, energy),
         level = COALESCE(?, level),
         streak_days = COALESCE(?, streak_days)
       WHERE push_token = ?`,
    )
    .bind(Date.now(), hunger ?? null, happiness ?? null, energy ?? null, level ?? null, streak_days ?? null, push_token)
    .run();

  return json({ ok: true });
}

async function handleUnregister(request: Request, env: Env): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { push_token } = body ?? {};
  if (!push_token) return json({ error: 'missing_fields' }, 400);

  await env.DB.prepare(`DELETE FROM devices WHERE push_token = ?`).bind(push_token).run();
  return json({ ok: true });
}

async function sendReturnPushes(env: Env): Promise<void> {
  const now = Date.now();
  const minActiveAt = now - RETURN_PUSH_MAX_HOURS * HOUR_MS;
  const maxActiveAt = now - RETURN_PUSH_MIN_HOURS * HOUR_MS;
  const minSinceLastPush = now - MIN_PUSH_INTERVAL_MS;

  const { results } = await env.DB
    .prepare(
      `SELECT push_token, wallet, pet_name, owner_name, hunger, happiness, energy, level, streak_days,
              last_active_at, last_push_at
         FROM devices
        WHERE last_active_at BETWEEN ? AND ?
          AND last_push_at < ?
        LIMIT ?`,
    )
    .bind(minActiveAt, maxActiveAt, minSinceLastPush, BATCH_SIZE)
    .all<DeviceRow>();

  if (!results || results.length === 0) return;

  const messages = results.map(buildMessage);
  const expoResponses = await sendBatch(messages);
  const succeededTokens: string[] = [];
  expoResponses.forEach((res, i) => {
    if (res?.status === 'ok') succeededTokens.push(results[i].push_token);
    else if (res?.details?.error === 'DeviceNotRegistered') {
      // Drop dead tokens so we don't keep retrying them.
      env.DB.prepare(`DELETE FROM devices WHERE push_token = ?`).bind(results[i].push_token).run();
    }
  });

  if (succeededTokens.length > 0) {
    const placeholders = succeededTokens.map(() => '?').join(',');
    await env.DB
      .prepare(`UPDATE devices SET last_push_at = ? WHERE push_token IN (${placeholders})`)
      .bind(now, ...succeededTokens)
      .run();
  }
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data?: Record<string, unknown>;
}

function buildMessage(d: DeviceRow): ExpoMessage {
  const name = d.pet_name ?? 'Nomi';
  const owner = d.owner_name;
  const hunger = d.hunger ?? 50;
  const happiness = d.happiness ?? 50;
  const streak = d.streak_days ?? 0;

  let title = `${name} misses you`;
  let body = owner ? `${owner}, your pet is waiting.` : `Your pet is waiting.`;

  if (hunger < 30) {
    title = `${name} is hungry`;
    body = owner ? `${owner}, ${name} hasn't eaten in a while.` : `${name} hasn't eaten in a while.`;
  } else if (happiness < 30) {
    title = `${name} feels lonely`;
    body = owner ? `Come back and play, ${owner}.` : `Come back and play.`;
  } else if (streak >= 7) {
    title = `Don't break the ${streak}-day streak`;
    body = owner ? `Tap in for today, ${owner}.` : `Tap in for today.`;
  }

  return {
    to: d.push_token,
    title,
    body,
    sound: 'default',
    data: { kind: 'return' },
  };
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.warn('expo push api', res.status, await res.text());
      return messages.map(() => ({ status: 'error' as const }));
    }
    const data = (await res.json()) as { data?: ExpoTicket[] };
    return data.data ?? messages.map(() => ({ status: 'error' as const }));
  } catch (err: any) {
    console.warn('expo push api error', err?.message ?? err);
    return messages.map(() => ({ status: 'error' as const }));
  }
}

function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PUSH_ALLOWED_ORIGINS = new Set<string>([
  // Add admin/dashboard origins here when needed.
]);

function cors(res: Response, requestOrigin?: string | null): Response {
  // No Origin → native app; allow. Listed browser origin → allow.
  // Anything else → 'null' so browsers refuse cross-origin reads.
  const allowed =
    requestOrigin == null || requestOrigin === ''
      ? ''
      : PUSH_ALLOWED_ORIGINS.has(requestOrigin)
        ? requestOrigin
        : 'null';
  if (allowed) res.headers.set('Access-Control-Allow-Origin', allowed);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-App-Token, X-Wallet, X-Wallet-Bytes, X-Session-Msg, X-Session-Sig');
  return res;
}
