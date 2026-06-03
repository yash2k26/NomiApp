/*
 * Nomi state-backup worker.
 *
 * Stores per-wallet game state (XP, streak, freezes, in-app coins, login
 * progress, evolution shards) in D1, keyed by wallet address. The mobile app
 * pushes on foreground/background transitions and pulls on wallet connect.
 *
 * Conflict resolution: client increments `version` on each push. Server
 * accepts only if incoming version > stored version. On conflict (409), the
 * client should pull and re-resolve. Multi-device users get last-write-wins
 * by version.
 *
 * What is NOT stored here (owned by chain): pet mint address, owned shop
 * items, premium tier. Those restore from on-chain memos / NFT holdings.
 *
 * Endpoints:
 *   POST /sync         { wallet, state, version } → { ok, version } | 409
 *   GET  /state?wallet=...                         → { state, version, updated_at } | 404
 *   POST /unregister   { wallet }                  → { ok } (wipe row)
 *
 * Deploy:
 *   1. cd workers/state && npm install
 *   2. wrangler login
 *   3. wrangler d1 create nomi-state          → paste database_id into wrangler.toml
 *   4. wrangler d1 migrations apply nomi-state --remote
 *   5. wrangler deploy
 *   6. Set EXPO_PUBLIC_STATE_API_URL in app .env to deployed URL, rebuild
 *
 * Cost: D1 free tier = 5M reads + 100K writes/day. ~10 sync writes per active
 * user/day → free tier covers ~10K active users.
 */

interface Env {
  DB: D1Database;
  // Shared-secret header gate. Set via `wrangler secret put APP_TOKEN`.
  // If unset on a deployment, requests pass through (back-compat). Once set,
  // requests must include `X-App-Token: <value>` or they get 401.
  // NOTE: this is NOT real auth — the value lives in the APK and can be
  // extracted by anyone willing to unzip it. It just stops drive-by probing
  // and casual scraping. Real auth (signed challenge with the wallet's
  // keypair) is the v1.2 follow-up.
  APP_TOKEN?: string;
}

interface UserStateRow {
  wallet: string;
  state_json: string;
  version: number;
  updated_at: number;
}

const MAX_STATE_BYTES = 32 * 1024; // 32 KiB cap to keep DB rows tidy

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    // App-token gate. Skip the check if APP_TOKEN isn't configured (back-compat
    // with deployments that haven't run `wrangler secret put APP_TOKEN` yet).
    if (env.APP_TOKEN) {
      const provided = request.headers.get('x-app-token') ?? '';
      if (provided !== env.APP_TOKEN) {
        return cors(json({ error: 'unauthorized' }, 401));
      }
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/sync') {
      return cors(await handleSync(request, env));
    }
    if (request.method === 'GET' && url.pathname === '/state') {
      const wallet = url.searchParams.get('wallet');
      return cors(await handleGet(wallet, env));
    }
    if (request.method === 'POST' && url.pathname === '/unregister') {
      return cors(await handleUnregister(request, env));
    }
    if (request.method === 'POST' && url.pathname === '/purchases/confirm') {
      return cors(await handlePurchaseConfirm(request, env));
    }
    if (request.method === 'GET' && url.pathname === '/purchases/list') {
      const wallet = url.searchParams.get('wallet');
      return cors(await handlePurchaseList(wallet, env));
    }
    return cors(json({ error: 'not_found' }, 404));
  },
};

interface PurchaseConfirmBody {
  wallet: string;
  kind: 'premium' | 'shop' | 'mint';
  payload: string;
  signature: string;
  currency: 'SOL' | 'SKR' | 'coins';
  amount: number;
}

/**
 * Record a confirmed purchase. Idempotent — repeated POSTs with the same
 * signature collapse to a single row.
 *
 * The client calls this RIGHT AFTER the on-chain tx confirms, while the
 * user is still in the app. If the call fails (network, server down), the
 * chain memo is still there — the auto-restore path picks it up on next
 * connect as the slow fallback. Server = fast path, chain = audit log.
 */
async function handlePurchaseConfirm(request: Request, env: Env): Promise<Response> {
  let body: PurchaseConfirmBody;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { wallet, kind, payload, signature, currency, amount } = body ?? ({} as PurchaseConfirmBody);
  if (!wallet || typeof wallet !== 'string') return json({ error: 'missing_wallet' }, 400);
  if (!['premium', 'shop', 'mint'].includes(kind)) return json({ error: 'bad_kind' }, 400);
  if (!payload || typeof payload !== 'string') return json({ error: 'missing_payload' }, 400);
  if (!signature || typeof signature !== 'string') return json({ error: 'missing_signature' }, 400);
  if (!['SOL', 'SKR', 'coins'].includes(currency)) return json({ error: 'bad_currency' }, 400);
  if (typeof amount !== 'number' || amount < 0) return json({ error: 'bad_amount' }, 400);

  try {
    await env.DB
      .prepare(
        `INSERT INTO purchases (wallet, kind, payload, signature, currency, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(signature) DO NOTHING`,
      )
      .bind(wallet, kind, payload, signature, currency, amount, Date.now())
      .run();
    return json({ ok: true });
  } catch (err: any) {
    console.warn('purchase confirm failed', err?.message ?? err);
    return json({ error: 'db_error' }, 500);
  }
}

/**
 * Return all recorded purchases for a wallet. Used on app launch as the
 * fast path before falling back to a chain scan.
 */
async function handlePurchaseList(wallet: string | null, env: Env): Promise<Response> {
  if (!wallet) return json({ error: 'missing_wallet' }, 400);

  try {
    const result = await env.DB
      .prepare(
        `SELECT kind, payload, signature, currency, amount, created_at
         FROM purchases WHERE wallet = ? ORDER BY created_at ASC`,
      )
      .bind(wallet)
      .all<{ kind: string; payload: string; signature: string; currency: string; amount: number; created_at: number }>();
    return json({ purchases: result.results ?? [] });
  } catch (err: any) {
    console.warn('purchase list failed', err?.message ?? err);
    return json({ error: 'db_error' }, 500);
  }
}

async function handleSync(request: Request, env: Env): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { wallet, state, version } = body ?? {};
  if (!wallet || typeof wallet !== 'string') return json({ error: 'missing_wallet' }, 400);
  if (state == null) return json({ error: 'missing_state' }, 400);
  if (typeof version !== 'number' || version < 0) return json({ error: 'bad_version' }, 400);

  const stateJson = JSON.stringify(state);
  if (stateJson.length > MAX_STATE_BYTES) return json({ error: 'state_too_large', max_bytes: MAX_STATE_BYTES }, 413);

  const now = Date.now();

  // Read current version first to enforce monotonic versioning. If incoming
  // version is not strictly greater, return 409 + the server's current row so
  // the client can resolve.
  const existing = await env.DB
    .prepare(`SELECT version, updated_at FROM user_state WHERE wallet = ?`)
    .bind(wallet)
    .first<{ version: number; updated_at: number }>();

  if (existing && version <= existing.version) {
    return json({ error: 'stale_version', currentVersion: existing.version, currentUpdatedAt: existing.updated_at }, 409);
  }

  await env.DB
    .prepare(
      `INSERT INTO user_state (wallet, state_json, version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET
         state_json = excluded.state_json,
         version = excluded.version,
         updated_at = excluded.updated_at`,
    )
    .bind(wallet, stateJson, version, now)
    .run();

  return json({ ok: true, version, updated_at: now });
}

async function handleGet(wallet: string | null, env: Env): Promise<Response> {
  if (!wallet) return json({ error: 'missing_wallet' }, 400);

  const row = await env.DB
    .prepare(`SELECT state_json, version, updated_at FROM user_state WHERE wallet = ?`)
    .bind(wallet)
    .first<{ state_json: string; version: number; updated_at: number }>();

  if (!row) return json({ error: 'not_found' }, 404);

  let state: unknown;
  try { state = JSON.parse(row.state_json); } catch { state = null; }

  return json({ state, version: row.version, updated_at: row.updated_at });
}

async function handleUnregister(request: Request, env: Env): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { wallet } = body ?? {};
  if (!wallet) return json({ error: 'missing_wallet' }, 400);

  await env.DB.prepare(`DELETE FROM user_state WHERE wallet = ?`).bind(wallet).run();
  return json({ ok: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}
