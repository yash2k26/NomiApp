import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { runRpcHealthCheck } from './solanaDebugger';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? '';
// Network is now env-driven via EXPO_PUBLIC_SOLANA_NETWORK so QA can point
// the same APK at devnet without a code edit. Default is mainnet.
export type SolanaNetwork = 'mainnet' | 'devnet' | 'testnet';
const ENV_NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? 'mainnet').toLowerCase();
export const SOLANA_NETWORK: SolanaNetwork =
  ENV_NETWORK === 'devnet' ? 'devnet' :
  ENV_NETWORK === 'testnet' ? 'testnet' :
  'mainnet';

const HELIUS_HOST =
  SOLANA_NETWORK === 'devnet' ? 'devnet.helius-rpc.com' :
  SOLANA_NETWORK === 'testnet' ? 'testnet.helius-rpc.com' :
  'mainnet.helius-rpc.com';
const PUBLIC_FALLBACK =
  SOLANA_NETWORK === 'devnet' ? 'https://api.devnet.solana.com' :
  SOLANA_NETWORK === 'testnet' ? 'https://api.testnet.solana.com' :
  'https://api.mainnet-beta.solana.com';

const HELIUS_URL = HELIUS_API_KEY ? `https://${HELIUS_HOST}/?api-key=${HELIUS_API_KEY}` : '';

const RPC_ENDPOINTS = HELIUS_URL
  ? [HELIUS_URL, PUBLIC_FALLBACK]
  : [PUBLIC_FALLBACK];

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

/**
 * Simulate a transaction BEFORE asking the wallet to sign. Catches obvious
 * failures (insufficient funds, account constraints, program errors) without
 * burning gas or asking the user to sign a doomed tx. Required for any path
 * that hands a Transaction to `wallet.signTransactions`.
 */
export async function simulateTransactionRaw(tx: import('@solana/web3.js').Transaction): Promise<void> {
  try {
    const sim = await withFallback('simulateTransaction', (conn) =>
      conn.simulateTransaction(tx, undefined, false),
    );
    if (sim.value.err) {
      const logs = (sim.value.logs ?? []).slice(-4).join('\n');
      throw new Error(
        'Simulation failed: ' + JSON.stringify(sim.value.err) + (logs ? '\n' + logs : ''),
      );
    }
  } catch (e: any) {
    // If the simulation RPC itself fails (rate limit etc.), don't block the
    // user — let the wallet sign and let confirmation reveal the truth. We
    // only throw when the simulation returned a definitive error.
    if (String(e?.message ?? '').startsWith('Simulation failed:')) throw e;
  }
}

/**
 * Background "wait for finalized" check, used by paths where reorg-rollback
 * would be expensive (Pro purchase, NFT mint). Callers fire-and-forget AFTER
 * the initial 'confirmed' confirmation so the user gets fast feedback; this
 * resolves quietly when the tx reaches finalized commitment (~13 s on
 * mainnet) and rejects only if the tx ends up failed or never finalized
 * within `timeoutMs`. NOT awaited in the main flow.
 */
export async function awaitFinalizedRaw(signature: string, timeoutMs = 60000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const statuses = await withFallback('getSignatureStatuses', (conn) =>
        conn.getSignatureStatuses([signature], { searchTransactionHistory: true })
      );
      const status = statuses.value[0];
      if (status?.err) throw new Error('Tx errored before finalization');
      if (status?.confirmationStatus === 'finalized') return;
    } catch (e) {
      // Transient — keep polling.
    }
    await delay(2000);
  }
  throw new Error('Finalization timed out (still confirmed but not finalized)');
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
// Threshold above which we surface a one-time-per-spike congestion warning
// to the user. 50k µ-lamports/CU is "noticeably busy mainnet"; above that,
// the user may want to know their tx might take longer or cost slightly
// more. Still tiny in absolute terms (50k * 200k CU = 0.00001 SOL).
const CONGESTION_WARN_THRESHOLD = 50_000;
let cachedPriorityFee = DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
let cachedPriorityFeeAt = 0;
let congestionWarningShownAt = 0;
const PRIORITY_FEE_CACHE_MS = 60_000;
const CONGESTION_WARN_COOLDOWN_MS = 30 * 60_000; // 30 min between warnings

export function isNetworkCongested(): boolean {
  return cachedPriorityFee >= CONGESTION_WARN_THRESHOLD;
}

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

      // Surface a one-time-per-cooldown congestion notice so users
      // understand why their next tx might take 5-30s longer than usual.
      // Cheap to add, no false-positives because the cache means we only
      // fire after a real probe of the chain.
      if (
        cachedPriorityFee >= CONGESTION_WARN_THRESHOLD &&
        Date.now() - congestionWarningShownAt > CONGESTION_WARN_COOLDOWN_MS
      ) {
        congestionWarningShownAt = Date.now();
        try {
          const { notify } = require('./notify');
          notify.info(
            'Solana is congested',
            'Your next on-chain action may take a bit longer than usual. Priority fees are set automatically.',
            { category: 'system' },
          );
        } catch {}
      }
    }
  } catch (err: any) {
    console.warn('[solanaClient] getPriorityFee failed, using default:', err?.message ?? err);
  }
  return cachedPriorityFee;
}

// Re-exported as DEVNET_URL for legacy callers — actually the active primary
// RPC URL for the configured network (env-driven, see above).
export { PublicKey, LAMPORTS_PER_SOL };
export const DEVNET_URL = RPC_ENDPOINTS[0];
export type { Connection };
