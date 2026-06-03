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
  const token = process.env.EXPO_PUBLIC_STATE_API_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-App-Token'] = token;
  return headers;
}

function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

export type PurchaseKind = 'premium' | 'shop' | 'mint';
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
