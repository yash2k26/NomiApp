import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { runRpcHealthCheck } from './solanaDebugger';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? '';
const MAINNET_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const RPC_ENDPOINTS = HELIUS_API_KEY
  ? [MAINNET_URL, 'https://api.mainnet-beta.solana.com']
  : ['https://api.mainnet-beta.solana.com'];

console.log('[solanaClient] Initializing web3.js RPC endpoints:', RPC_ENDPOINTS);

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

export const SHOP_TREASURY = '3rfAFvCcotvc5YADAazHKizJYoddBGZx3AZqB41z5yGd';
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
      throw new Error('Transaction expired before confirmation (blockhash is no longer valid).');
    }

    await delay(1200);
  }

  throw new Error(`Transaction confirmation timed out after ${timeoutMs}ms`);
}

export async function getAccountInfoRaw(pubkey: PublicKey) {
  return withFallback('getAccountInfo', (conn) => conn.getAccountInfo(pubkey, 'confirmed'));
}

export async function getSignaturesForAddressRaw(pubkey: PublicKey, limit: number) {
  return withFallback('getSignaturesForAddress', (conn) => conn.getSignaturesForAddress(pubkey, { limit }));
}

export { PublicKey, LAMPORTS_PER_SOL, MAINNET_URL as DEVNET_URL };
export type { Connection };
