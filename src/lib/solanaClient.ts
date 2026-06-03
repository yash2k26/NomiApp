import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { runRpcHealthCheck } from './solanaDebugger';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? '';
// Mainnet (production)
const MAINNET_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const RPC_ENDPOINTS = HELIUS_API_KEY
  ? [MAINNET_URL, 'https://api.mainnet-beta.solana.com']
  : ['https://api.mainnet-beta.solana.com'];

// Active network (reflects RPC URL). Update this if you swap MAINNET_URL above.
export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet';
export const SOLANA_NETWORK: SolanaNetwork = RPC_ENDPOINTS[0].includes('devnet')
  ? 'devnet'
  : RPC_ENDPOINTS[0].includes('testnet')
    ? 'testnet'
    : 'mainnet';

console.log('[solanaClient] Initializing web3.js RPC endpoints:', RPC_ENDPOINTS);

/**
 * Human-readable name of the active primary RPC. Used by the Profile
 * Transparency card so users can verify which endpoint the app is using.
 * Strips api keys from URLs so we never display them.
 */
export function getActiveRpcLabel(): string {
  const primary = RPC_ENDPOINTS[0];
  if (primary.includes('helius-rpc.com')) return 'Helius (mainnet, fast)';
  if (primary.includes('api.mainnet-beta')) return 'api.mainnet-beta.solana.com (public)';
  if (primary.includes('devnet')) return 'devnet';
  if (primary.includes('testnet')) return 'testnet';
  return 'custom';
}

const connections = RPC_ENDPOINTS.map((url) => new Connection(url, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
}));

// Backward-compatible primary connection export
export const connection = connections[0];

async function withFallback<T>(opName: string, fn: (conn: Connection, index: number) => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < connections.length; i++) {
    try {
      return await fn(connections[i], i);
    } catch (err: any) {
      lastErr = err;
      console.warn(`[solanaClient] ${opName} failed on endpoint ${i + 1}/${connections.length}:`, err?.message ?? err);
    }
  }
  throw lastErr ?? new Error(`${opName} failed on all RPC endpoints`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyNetworkError(error: any): boolean {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('socket hang up')
  );
}

export const APP_IDENTITY = {
  name: 'Nomi',
  uri: 'https://oraclepet.app',
  icon: 'favicon.png',
};

export async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const lamports = await withFallback('getBalance', (conn) => conn.getBalance(pubkey, 'confirmed'));
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[solanaClient] getBalance error:', error);
    return 0;
  }
}

/**
 * Like `getBalance` but distinguishes "RPC failed" from "zero balance."
 * Previously the app showed "0 SOL" identically for both cases, so users on
 * rate-limited RPC thought they were broke and blamed us. Use this in any
 * UI path that needs to render a non-zero "balance unavailable" state.
 */
export async function getBalanceSafe(address: string): Promise<{ value: number; ok: boolean }> {
  try {
    const pubkey = new PublicKey(address);
    const lamports = await withFallback('getBalance', (conn) => conn.getBalance(pubkey, 'confirmed'));
    return { value: lamports / LAMPORTS_PER_SOL, ok: true };
  } catch (error) {
    console.warn('[solanaClient] getBalanceSafe failed:', (error as any)?.message ?? error);
    return { value: 0, ok: false };
  }
}

export const SHOP_TREASURY = 'uP7ZfsuXEcUq7LM9jSPeEZi74YJeaGuy3cbodknXhQz';
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

export function getSolscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function getSolscanNftUrl(mintAddress: string): string {
  return `https://solscan.io/token/${mintAddress}`;
}

export function getSolscanAddressUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export async function getLatestBlockhashRaw(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  return withFallback('getLatestBlockhash', (conn) => conn.getLatestBlockhash('confirmed'));
}

export async function getMinimumBalanceForRentExemptionRaw(size: number): Promise<number> {
  return withFallback('getMinimumBalanceForRentExemption', (conn) => conn.getMinimumBalanceForRentExemption(size, 'confirmed'));
}

export async function sendRawTransactionRaw(serializedTx: Uint8Array): Promise<string> {
  let lastErr: any;
  let ranHealthCheck = false;

  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await delay(attempt * 700);
        }
        const sig = await conn.sendRawTransaction(serializedTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 5,
        });
        return sig;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[solanaClient] sendRawTransaction failed endpoint ${i + 1}, attempt ${attempt + 1}:`, err?.message ?? err);

        if (!ranHealthCheck && isLikelyNetworkError(err)) {
          ranHealthCheck = true;
          try {
            const health = await runRpcHealthCheck(RPC_ENDPOINTS, connections);
            console.warn('[solanaClient] RPC health snapshot after network failure:', JSON.stringify(health, null, 2));
          } catch (healthErr: any) {
            console.warn('[solanaClient] RPC health snapshot failed:', healthErr?.message ?? healthErr);
          }
        }
      }
    }
  }
  throw lastErr ?? new Error('sendRawTransaction failed on all endpoints');
}

// Authoritative "did this signature land?" check. Uses
// searchTransactionHistory so a tx that confirmed AFTER the blockhash
// window passed is still found (the status cache alone would miss it).
// Returns 'ok' (landed), 'failed' (landed with an on-chain error), or
// 'unknown' (genuinely not found yet / RPC couldn't say).
async function finalSignatureCheck(
  signature: string,
): Promise<'ok' | 'failed' | 'unknown'> {
  try {
    const statuses = await withFallback('getSignatureStatuses', (conn) =>
      conn.getSignatureStatuses([signature], { searchTransactionHistory: true })
    );
    const status = statuses.value[0];
    if (!status) return 'unknown';
    if (status.err) return 'failed';
    if (
      status.confirmationStatus === 'confirmed' ||
      status.confirmationStatus === 'finalized'
    ) {
      return 'ok';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function confirmTransactionRaw(
  signature: string,
  _blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 60000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await withFallback('getSignatureStatuses', (conn) =>
      conn.getSignatureStatuses([signature], { searchTransactionHistory: true })
    );

    const status = statuses.value[0];
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return;
    }

    const currentBlockHeight = await withFallback('getBlockHeight', (conn) =>
      conn.getBlockHeight('confirmed')
    );
    if (currentBlockHeight > lastValidBlockHeight) {
      // CRITICAL: do NOT declare failure on the height check alone.
      // getBlockHeight and getSignatureStatuses can be served by different
      // RPC endpoints with different lag — a tx that actually LANDED (and
      // so already debited the user's SOL/SKR on chain) would otherwise be
      // reported as "expired", the app would treat the mint/purchase as
      // failed, and the user gets "I paid but nothing arrived". One last
      // authoritative lookup (with history search) settles it before we
      // ever throw. This is the exact class of bug behind the
      // "minted/paid but NFT/Pro never showed up" reports.
      const settled = await finalSignatureCheck(signature);
      if (settled === 'ok') return;
      if (settled === 'failed') {
        throw new Error('Transaction failed on chain.');
      }
      throw new Error('Transaction expired before confirmation (blockhash is no longer valid).');
    }

    await delay(1200);
  }

  // Timed out polling — but "timed out" must never mean "failed" until we've
  // asked the chain definitively. Slow RPC under load is common; the tx may
  // be perfectly confirmed.
  const settled = await finalSignatureCheck(signature);
  if (settled === 'ok') return;
  if (settled === 'failed') {
    throw new Error('Transaction failed on chain.');
  }
  throw new Error(`Transaction confirmation timed out after ${timeoutMs}ms`);
}

export async function getAccountInfoRaw(pubkey: PublicKey) {
  return withFallback('getAccountInfo', (conn) => conn.getAccountInfo(pubkey, 'confirmed'));
}

export async function getSignaturesForAddressRaw(
  pubkey: PublicKey,
  limit: number,
  before?: string,
) {
  return withFallback('getSignaturesForAddress', (conn) =>
    conn.getSignaturesForAddress(pubkey, before ? { limit, before } : { limit }),
  );
}

/**
 * Median priority fee (micro-lamports per compute unit) cached for ~60s.
 * Used to add a small ComputeBudget priority instruction to user-facing txs
 * (premium / shop / mint / spin) so they land reliably during congestion.
 *
 * Returns 1000 by default if RPC fails — that's a safe, cheap floor
 * (~5000 lamports = $0.000001 on a typical 200k CU tx).
 */
const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 1000;
let cachedPriorityFee = DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
let cachedPriorityFeeAt = 0;
const PRIORITY_FEE_CACHE_MS = 60_000;

export async function getPriorityFeeMicroLamports(): Promise<number> {
  if (Date.now() - cachedPriorityFeeAt < PRIORITY_FEE_CACHE_MS) {
    return cachedPriorityFee;
  }
  try {
    const fees = await withFallback('getRecentPrioritizationFees', (conn) =>
      (conn as any).getRecentPrioritizationFees(),
    ) as Array<{ slot: number; prioritizationFee: number }>;
    if (Array.isArray(fees) && fees.length > 0) {
      // Take the median of the recent samples to avoid being skewed by spikes.
      const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      // Floor at the default so we always pay at least a token fee even when
      // the network is idle (which makes our tx land slightly ahead of free
      // ones and survives the next congestion spike).
      cachedPriorityFee = Math.max(DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS, median);
      cachedPriorityFeeAt = Date.now();
    }
  } catch (err: any) {
    console.warn('[solanaClient] getPriorityFee failed, using default:', err?.message ?? err);
  }
  return cachedPriorityFee;
}

export { PublicKey, LAMPORTS_PER_SOL, MAINNET_URL as DEVNET_URL };
export type { Connection };
