/*
 * Server-side purchase ledger client.
 *
 * Architectural note: we used to rely solely on on-chain memos as the source
 * of truth for premium tier and shop ownership. That was technically correct
 * but practically fragile — RPC rate-limits, memo parsing edge cases, and
 * pagination quirks meant that legitimate purchases sometimes returned
 * "user owns nothing" on restore. Users got charged but the local app kept
 * showing them as non-premium. Multiple Telegram bug reports trace to this.
 *
 * v1.2 introduces a server ledger (workers/state) as the FAST PATH:
 *   - On a successful chain tx, the client POSTs to /purchases/confirm.
 *   - The worker writes to D1, keyed by (wallet, signature) for idempotency.
 *   - On wallet connect, the client pulls from /purchases/list (one fast
 *     call) and rehydrates premium/shop/mint state from that.
 *   - The chain memo scan still runs as a fallback if the server is
 *     unreachable, so we never lose the audit trail.
 *
 * Endpoint: EXPO_PUBLIC_STATE_API_URL (the same worker as state sync).
 * Auth: shared X-App-Token header (same as state sync).
 */

const REQUEST_TIMEOUT_MS = 12_000;

function getBase(): string | null {
  const base = process.env.EXPO_PUBLIC_STATE_API_URL?.replace(/\/+$/, '');
  return base || null;
}

function buildHeaders(): Record<string, string> {
  // Prefer wallet-signed session headers from getApiAuthHeaders (cryptographic,
  // can't be forged by an APK-extracted secret). Falls back internally to the
  // legacy X-App-Token shared-secret when no session is present.
  const { getApiAuthHeaders } = require('../store/walletStore');
  return { 'Content-Type': 'application/json', ...getApiAuthHeaders() };
}

function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

// 'welcome-back' rows have no on-chain tx — they're a server-side
// idempotency marker so the legacy-user bonus can't be re-applied on every
// reinstall when the post-bonus state push had failed. signature is a
// synthetic `welcome-back:<wallet>` so a duplicate POST is rejected by the
// UNIQUE(wallet, signature) constraint.
export type PurchaseKind = 'premium' | 'shop' | 'mint' | 'welcome-back';
export type PurchaseCurrency = 'SOL' | 'SKR' | 'coins';

export interface PurchaseRecord {
  kind: PurchaseKind;
  payload: string;
  signature: string;
  currency: PurchaseCurrency;
  amount: number;
  created_at: number;
}

/**
 * Record a successful purchase with the ledger. Best-effort — failures are
 * silently swallowed because the chain memo is still authoritative. Returns
 * true on success so callers can decide whether to retry.
 */
export async function confirmPurchase(args: {
  wallet: string;
  kind: PurchaseKind;
  payload: string;
  signature: string;
  currency: PurchaseCurrency;
  amount: number;
}): Promise<boolean> {
  const base = getBase();
  if (!base || !args.wallet || !args.signature) return false;
  try {
    const res = await fetchWithTimeout(`${base}/purchases/confirm`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      console.warn('[purchases] confirm failed:', res.status);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(
      '[purchases] confirm error:',
      err?.name === 'AbortError' ? 'timeout' : err?.message ?? err,
    );
    return false;
  }
}

/**
 * List all recorded purchases for a wallet. Returns null on failure so the
 * caller can fall back to a chain scan.
 */
export async function listPurchases(wallet: string | null | undefined): Promise<PurchaseRecord[] | null> {
  const base = getBase();
  if (!base || !wallet) return null;
  try {
    const res = await fetchWithTimeout(`${base}/purchases/list?wallet=${encodeURIComponent(wallet)}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    if (!res.ok) {
      console.warn('[purchases] list failed:', res.status);
      return null;
    }
    const data = (await res.json()) as { purchases?: PurchaseRecord[] };
    return Array.isArray(data.purchases) ? data.purchases : [];
  } catch (err: any) {
    console.warn(
      '[purchases] list error:',
      err?.name === 'AbortError' ? 'timeout' : err?.message ?? err,
    );
    return null;
  }
}
