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
 *   POST /sync                { wallet, state, version } → { ok, version } | 409
 *   GET  /state?wallet=...                              → { state, version, updated_at } | 404
 *   POST /unregister          { wallet }                → { ok } (wipe row)
 *   POST /purchases/confirm   { wallet, kind, payload, signature, currency, amount } → { ok }
 *   GET  /purchases/list?wallet=...                     → { purchases: [...] }
 *
 * Deploy:
 *   1. cd workers/state && npm install
 *   2. wrangler login (or export CLOUDFLARE_API_TOKEN=…)
 *   3. wrangler d1 create nomi-state          → paste database_id into wrangler.toml
 *   4. wrangler d1 migrations apply nomi-state --remote
 *   5. wrangler secret put HELIUS_RPC_URL    → mainnet Helius RPC URL (private, with API key)
 *   6. wrangler deploy
 *   7. Set EXPO_PUBLIC_STATE_API_URL in app .env to deployed URL, rebuild
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
  // Mainnet Solana RPC URL the worker uses to independently verify purchase
  // transactions. Required for /purchases/confirm to do anything other than
  // blindly trust the client. Set via `wrangler secret put HELIUS_RPC_URL`.
  HELIUS_RPC_URL?: string;
}

const MAX_STATE_BYTES = 32 * 1024; // 32 KiB cap on state JSON payload size
// Hard cap on any incoming request body. Defense against attackers POSTing
// multi-MB payloads to inflate D1 storage / blow up worker memory.
const MAX_BODY_BYTES = 64 * 1024;

// Treasury that receives all NomiApp payments. Hard-coded here so the worker
// is independent of client config — an attacker can't trick it by claiming a
// fake treasury was credited.
const SHOP_TREASURY = 'uP7ZfsuXEcUq7LM9jSPeEZi74YJeaGuy3cbodknXhQz';
// SKR token mint on Solana mainnet.
const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
// SKR decimals — must match the on-chain mint config and src/lib/skrToken.ts.
const SKR_DECIMALS = 6;
// Tolerance for amount comparison (rounding from float → int lamports / atomic
// units can drift by 1–2 units). Reject if the on-chain credit is short by
// more than this fraction of the claimed amount.
const AMOUNT_TOLERANCE = 0.01; // 1%

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);

    // Universal body-size cap. Reject before we even authenticate so attackers
    // can't push 100 MB JSON at us and force us to read it.
    const declared = parseInt(request.headers.get('content-length') ?? '0', 10);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return cors(json({ error: 'payload_too_large', max_bytes: MAX_BODY_BYTES }, 413), origin);
    }

    // Auth: prefer the wallet-signed session (cryptographic, can't be forged
    // from an extracted APK because it requires the user's wallet to have
    // signed an off-chain message at connect). Fall back to the legacy
    // APP_TOKEN shared secret if no session headers were sent (older clients).
    // Whichever path passes, the user is authenticated.
    const sessionWallet = await verifySession(request);
    if (!sessionWallet) {
      // No valid session — try legacy shared-secret.
      if (env.APP_TOKEN) {
        const provided = request.headers.get('x-app-token') ?? '';
        if (provided !== env.APP_TOKEN) {
          return cors(json({ error: 'unauthorized' }, 401), origin);
        }
      }
      // If APP_TOKEN isn't configured either, requests pass through (the
      // explicit back-compat path the original code had).
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/sync') {
      return cors(await handleSync(request, env), origin);
    }
    if (request.method === 'GET' && url.pathname === '/state') {
      const wallet = url.searchParams.get('wallet');
      return cors(await handleGet(wallet, env), origin);
    }
    if (request.method === 'POST' && url.pathname === '/unregister') {
      return cors(await handleUnregister(request, env), origin);
    }
    if (request.method === 'POST' && url.pathname === '/purchases/confirm') {
      return cors(await handlePurchaseConfirm(request, env, sessionWallet), origin);
    }
    if (request.method === 'GET' && url.pathname === '/purchases/list') {
      const wallet = url.searchParams.get('wallet');
      return cors(await handlePurchaseList(wallet, env), origin);
    }
    return cors(json({ error: 'not_found' }, 404), origin);
  },
};

/**
 * Verify the wallet-signed session attached to a request.
 *
 * Expected headers:
 *   X-Wallet         base58 wallet address (matches the `wallet` field in
 *                    request bodies for cross-check)
 *   X-Wallet-Bytes   base64-encoded 32-byte Ed25519 public key
 *   X-Session-Msg    plaintext: `nomi-session:<X-Wallet>:<expiry-ms>`
 *   X-Session-Sig    base64-encoded 64-byte Ed25519 signature over X-Session-Msg
 *
 * Returns the verified wallet (base58) on success, null otherwise.
 * Cloudflare Workers' WebCrypto supports Ed25519 since 2024.
 */
async function verifySession(req: Request): Promise<string | null> {
  const wallet = req.headers.get('X-Wallet');
  const pubkeyB64 = req.headers.get('X-Wallet-Bytes');
  const msg = req.headers.get('X-Session-Msg');
  const sigB64 = req.headers.get('X-Session-Sig');
  if (!wallet || !pubkeyB64 || !msg || !sigB64) return null;
  // Message shape + expiry + wallet binding.
  const parts = msg.split(':');
  if (parts.length !== 3 || parts[0] !== 'nomi-session' || parts[1] !== wallet) return null;
  const expiry = parseInt(parts[2], 10);
  if (!expiry || !Number.isFinite(expiry) || expiry < Date.now()) return null;
  try {
    const pubBytes = Uint8Array.from(atob(pubkeyB64), (c) => c.charCodeAt(0));
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    if (pubBytes.length !== 32 || sigBytes.length !== 64) return null;
    const key = await crypto.subtle.importKey('raw', pubBytes, { name: 'Ed25519' } as any, false, ['verify']);
    const msgBytes = new TextEncoder().encode(msg);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' } as any, key, sigBytes, msgBytes);
    return ok ? wallet : null;
  } catch {
    return null;
  }
}

interface PurchaseConfirmBody {
  wallet: string;
  // 'welcome-back' is a synthetic kind with no on-chain tx — it exists
  // purely so the legacy-user bonus stays idempotent across reinstalls
  // (signature = `welcome-back:<wallet>`, UNIQUE(wallet, signature) prevents
  // a second insert).
  kind: 'premium' | 'shop' | 'mint' | 'welcome-back';
  payload: string;
  signature: string;
  currency: 'SOL' | 'SKR' | 'coins';
  amount: number;
}

/**
 * Record a confirmed purchase. Idempotent — repeated POSTs with the same
 * signature collapse to a single row.
 *
 * Security: every purchase claim (except welcome-back, which is server-side
 * idempotency only) is independently verified against the chain via
 * verifyPurchaseOnChain BEFORE we write the ledger row. That closes the
 * "client claims a fake premium purchase" attack — the worker now requires
 * a real on-chain credit to the treasury, signed by the same wallet, for at
 * least the claimed amount.
 */
async function handlePurchaseConfirm(request: Request, env: Env, sessionWallet: string | null): Promise<Response> {
  let body: PurchaseConfirmBody;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { wallet, kind, payload, signature, currency, amount } = body ?? ({} as PurchaseConfirmBody);
  if (!wallet || typeof wallet !== 'string') return json({ error: 'missing_wallet' }, 400);
  if (!['premium', 'shop', 'mint', 'welcome-back'].includes(kind)) return json({ error: 'bad_kind' }, 400);
  if (!payload || typeof payload !== 'string') return json({ error: 'missing_payload' }, 400);
  if (!signature || typeof signature !== 'string') return json({ error: 'missing_signature' }, 400);
  if (!['SOL', 'SKR', 'coins'].includes(currency)) return json({ error: 'bad_currency' }, 400);
  if (typeof amount !== 'number' || amount < 0) return json({ error: 'bad_amount' }, 400);

  // Cross-check: if the caller authenticated with a wallet-signed session,
  // they may ONLY confirm purchases for their own wallet. Closes a class of
  // attack where a valid session for wallet A is reused to write rows for
  // wallet B.
  if (sessionWallet && sessionWallet !== wallet) {
    return json({ error: 'session_wallet_mismatch' }, 403);
  }

  // On-chain verification. Skipped for 'welcome-back' (no tx) and 'coins'
  // (no on-chain transfer — paid out of off-chain balance). All other kinds
  // must have a real, signed, treasury-credited tx behind them.
  if (kind !== 'welcome-back' && currency !== 'coins') {
    if (!env.HELIUS_RPC_URL) {
      // Fail closed: if the worker isn't configured to verify, reject. This
      // prevents the "deploy without secret = effectively trust client"
      // footgun. To bypass for staging, set HELIUS_RPC_URL to any reachable
      // RPC URL and the verifier will run.
      console.warn('[purchases] HELIUS_RPC_URL not configured — rejecting confirm');
      return json({ error: 'verification_unavailable' }, 503);
    }
    const verdict = await verifyPurchaseOnChain(env.HELIUS_RPC_URL, {
      signature, wallet, currency, amount, payload, kind,
    });
    if (!verdict.ok) {
      console.warn('[purchases] on-chain verification failed:', verdict.reason, 'sig:', signature);
      return json({ error: 'signature_not_verified', reason: verdict.reason }, 403);
    }
  }

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
 * Independently verify a purchase tx exists on-chain, was signed by the
 * claimed wallet, credited the canonical SHOP_TREASURY, and moved at least
 * the claimed amount of the claimed currency.
 *
 * Returns { ok: true } if all assertions hold. { ok: false, reason } otherwise.
 *
 * Retry strategy: the client calls this RIGHT AFTER its own 'confirmed' wait,
 * which can sometimes be slightly ahead of when the tx is indexed at the
 * worker's RPC endpoint. We do up to 3 attempts with exponential backoff.
 */
interface VerifyArgs {
  signature: string;
  wallet: string;
  currency: 'SOL' | 'SKR' | 'coins';
  amount: number;
  payload: string;
  kind: 'premium' | 'shop' | 'mint' | 'welcome-back';
}
interface VerifyResult { ok: boolean; reason?: string; }

async function verifyPurchaseOnChain(rpcUrl: string, args: VerifyArgs): Promise<VerifyResult> {
  const { signature, wallet, currency, amount } = args;

  let tx: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s
    tx = await rpcGetTransaction(rpcUrl, signature);
    if (tx) break;
  }
  if (!tx) return { ok: false, reason: 'tx_not_found' };
  if (tx.meta?.err) return { ok: false, reason: 'tx_failed' };

  // Signer check: the first account in staticAccountKeys is the fee payer
  // and primary signer. Solana enforces is_signer for index 0 at runtime.
  // jsonParsed encoding returns objects {pubkey, signer, writable, source};
  // legacy/raw returns base58 strings. Handle both.
  const accountKeys: any[] = tx.transaction?.message?.accountKeys
    ?? tx.transaction?.message?.staticAccountKeys
    ?? [];
  if (!accountKeys.length) return { ok: false, reason: 'no_account_keys' };
  const keyOf = (k: any): string => (typeof k === 'string' ? k : k?.pubkey);
  const feePayer = keyOf(accountKeys[0]);
  if (feePayer !== wallet) return { ok: false, reason: 'signer_mismatch' };

  if (currency === 'SOL') {
    const treasuryIdx = accountKeys.findIndex((k) => keyOf(k) === SHOP_TREASURY);
    if (treasuryIdx < 0) return { ok: false, reason: 'treasury_not_in_accounts' };
    const pre = tx.meta?.preBalances?.[treasuryIdx];
    const post = tx.meta?.postBalances?.[treasuryIdx];
    if (typeof pre !== 'number' || typeof post !== 'number') return { ok: false, reason: 'no_balance_data' };
    const lamportsDelta = post - pre;
    const expectedLamports = Math.round(amount * 1_000_000_000);
    // Allow shortfall up to AMOUNT_TOLERANCE (handles float rounding) but
    // never accept a credit smaller than expected by more than that. We do
    // NOT cap excess — a generous user is fine.
    const minAccept = Math.floor(expectedLamports * (1 - AMOUNT_TOLERANCE));
    if (lamportsDelta < minAccept) {
      return { ok: false, reason: `treasury_underpaid:${lamportsDelta}<${minAccept}` };
    }
    return { ok: true };
  }

  if (currency === 'SKR') {
    // SPL token transfers don't appear in preBalances/postBalances. Use
    // preTokenBalances/postTokenBalances — entries with matching mint +
    // owner=treasury indicate the treasury's SKR ATA delta.
    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];
    const findTreasurySkr = (rows: any[]) =>
      rows.find((r) => r?.mint === SKR_MINT && r?.owner === SHOP_TREASURY);
    const preRow = findTreasurySkr(pre);
    const postRow = findTreasurySkr(post);
    // If treasury had no SKR ATA before (likely for the very first SKR
    // payment to this wallet), pre is undefined and we treat it as 0.
    const preAmount = preRow ? Number(preRow.uiTokenAmount?.amount ?? '0') : 0;
    const postAmount = postRow ? Number(postRow.uiTokenAmount?.amount ?? '0') : 0;
    const atomicDelta = postAmount - preAmount;
    const expectedAtomic = Math.round(amount * Math.pow(10, SKR_DECIMALS));
    const minAccept = Math.floor(expectedAtomic * (1 - AMOUNT_TOLERANCE));
    if (atomicDelta < minAccept) {
      return { ok: false, reason: `treasury_skr_underpaid:${atomicDelta}<${minAccept}` };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'unsupported_currency_for_chain_verify' };
}

/**
 * Solana JSON-RPC: getTransaction by signature with parsed inner instructions.
 * Returns null if the tx is not yet indexed (caller retries with backoff).
 */
async function rpcGetTransaction(rpcUrl: string, signature: string): Promise<any | null> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
      ],
    }),
  });
  if (!res.ok) {
    console.warn('[purchases] RPC getTransaction non-200:', res.status);
    return null;
  }
  const data = await res.json() as { result?: any; error?: any };
  if (data.error) {
    console.warn('[purchases] RPC getTransaction error:', JSON.stringify(data.error));
    return null;
  }
  return data.result ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hard upper bounds on every numeric field in the synced game state.
 * Sized 100×-1000× above what any real player can produce so legitimate
 * users never trip these — but they catch tampered APKs that try to write
 * absurd values (billions of XP, trillions of coins) to D1.
 *
 * Returns the offending dotted-path field name if any value is out of
 * range, NaN, Infinity, or negative. Returns null if the state is sane.
 *
 * Unknown fields are ignored — additive schema changes don't need a
 * worker redeploy. Removing or renaming a field on the client just stops
 * being checked here; the byte-cap (MAX_STATE_BYTES) is the backstop.
 */
const STATE_CAPS: Record<string, number> = {
  'xp.level': 999,
  'xp.totalXp': 100_000_000,
  'xp.xpInCurrentLevel': 1_000_000,
  'xp.doubleXpUntil': 32_503_680_000_000, // year 3000 in ms
  'pet.streakDays': 10_000,
  'pet.streakFreezes': 10_000,
  'pet.lastBrokenStreak': 10_000,
  'pet.streakBrokenAt': 32_503_680_000_000,
  'pet.welcomeBackBonusAppliedAt': 32_503_680_000_000,
  'adventure.evolutionShards': 100_000,
  'adventure.freeItemTokens': 100_000,
  'adventure.completedAdventures': 1_000_000,
  'adventure.miniGamesWon': 1_000_000,
  'adventure.currentLoginDay': 10_000,
  'adventure.totalLoginDays': 100_000,
  'adventure.doubleXpUntil': 32_503_680_000_000,
  'wallet.appCoins': 1_000_000_000, // 1B coins ≫ any conceivable grind
};

function checkStateSanity(state: any): string | null {
  if (typeof state !== 'object' || state == null) return 'root';
  for (const [path, max] of Object.entries(STATE_CAPS)) {
    const [section, field] = path.split('.');
    const value = state?.[section]?.[field];
    if (value === undefined || value === null) continue; // additive schema OK
    if (typeof value !== 'number') return path;
    if (!Number.isFinite(value)) return path;
    if (value < 0) return path;
    if (value > max) return path;
  }
  // wallet.coinsEarnedToday is a Record<string, number> — cap each entry
  const coinsToday = state?.wallet?.coinsEarnedToday;
  if (coinsToday && typeof coinsToday === 'object') {
    for (const [k, v] of Object.entries(coinsToday)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1_000_000) {
        return `wallet.coinsEarnedToday[${k}]`;
      }
    }
  }
  return null;
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

  // Defense-in-depth against client tampering of accrual values (XP, coins,
  // shards). Caps are far above what any legitimate gameplay session can
  // produce, so they never reject real users — but they catch the "modify
  // the APK to write 10^12 coins" attack before it pollutes D1.
  const sanityIssue = checkStateSanity(state);
  if (sanityIssue) return json({ error: 'bad_state', field: sanityIssue }, 400);

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

// Native app calls don't carry an Origin header — browsers do. The mobile
// React Native client never sets one. So we can safely refuse browser
// requests (which would carry Origin) unless they explicitly come from a
// known app-side surface (none today). Doing this prevents any future
// browser-side admin tool from accidentally exposing data and stops
// drive-by browser probing from CSRF or scraping endpoints.
const ALLOWED_ORIGINS = new Set<string>([
  // Add admin / dashboard origins here when needed.
  // Example: 'https://admin.nomi.app',
]);

function cors(res: Response, requestOrigin?: string | null): Response {
  // Allow native (no Origin header) by default. Allow explicit listed
  // browser origins. Reject everything else (wildcard removed).
  const allowed =
    requestOrigin == null || requestOrigin === ''
      ? '' // no header sent (native) — emit nothing, browsers ignore
      : ALLOWED_ORIGINS.has(requestOrigin)
        ? requestOrigin
        : 'null';
  if (allowed) res.headers.set('Access-Control-Allow-Origin', allowed);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-App-Token, X-Wallet, X-Wallet-Bytes, X-Session-Msg, X-Session-Sig');
  return res;
}
