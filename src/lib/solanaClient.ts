import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Helius free-tier devnet RPC — replace API key with yours from https://dev.helius.xyz
// TODO: Move to environment variable before public release (revoke & rotate if repo goes public)
const HELIUS_API_KEY = '883b4afc-f56d-4d3e-96b5-8f4a132f1eff';
const DEVNET_URL = HELIUS_API_KEY !== 'YOUR_HELIUS_API_KEY'
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://rpc.ankr.com/solana_devnet';

// Shared RPC connection (kept for any remaining SDK usage)
export const connection = new Connection(DEVNET_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

export const APP_IDENTITY = {
  name: 'Nomi',
  uri: 'https://oraclepet.app',
  icon: 'favicon.ico',
};

/**
 * Raw RPC via XMLHttpRequest — more reliable than fetch on React Native Android.
 * Falls back through multiple endpoints if one fails.
 */
const RPC_ENDPOINTS = [
  DEVNET_URL,
  'https://api.devnet.solana.com',
];

function xhrPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 30000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error(`XHR error for ${url}`));
    xhr.ontimeout = () => reject(new Error(`XHR timeout for ${url}`));
    xhr.send(body);
  });
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  let lastError: Error | null = null;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const text = await xhrPost(endpoint, body);
      const json = JSON.parse(text);
      if (json.error) {
        // RPC returned an error — this is a transaction/data issue, not network.
        // Don't try next endpoint, surface the real error immediately.
        const logs = json.error?.data?.logs;
        const logStr = logs ? '\nLogs: ' + logs.join('\n') : '';
        const msg = `${json.error.message}${logStr}`;
        console.error(`[RPC] ${method} error:`, msg);
        throw new Error(msg);
      }
      return json.result;
    } catch (err: any) {
      // If it's an RPC error (not network), re-throw immediately
      if (err.message && !err.message.includes('XHR')) throw err;
      console.warn(`[RPC] ${endpoint} network fail:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error(`All RPC endpoints failed for ${method}`);
}

/**
 * Fetch real SOL balance for an address.
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const result = await rpcCall('getBalance', [pubkey.toBase58(), { commitment: 'confirmed' }]);
    return (result?.value ?? 0) / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[solanaClient] getBalance error:', error);
    return 0;
  }
}

// Shop treasury address (devnet keypair — receives SOL for purchases)
export const SHOP_TREASURY = 'FHE2gMqe3kk7JDqBQffFqJoBEQGp3DdeQ42K2pHswfJU';

// SKR (Seeker) token — mainnet mint address
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// Solscan deep links (devnet)
export function getSolscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

export function getSolscanNftUrl(mintAddress: string): string {
  return `https://solscan.io/token/${mintAddress}?cluster=devnet`;
}

export function getSolscanAddressUrl(address: string): string {
  return `https://solscan.io/account/${address}?cluster=devnet`;
}

export async function getLatestBlockhashRaw(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const result = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  return result.value;
}

export async function getMinimumBalanceForRentExemptionRaw(size: number): Promise<number> {
  return rpcCall('getMinimumBalanceForRentExemption', [size, { commitment: 'confirmed' }]);
}

export async function sendRawTransactionRaw(serializedTx: Uint8Array): Promise<string> {
  const base64 = Buffer.from(serializedTx).toString('base64');
  return rpcCall('sendTransaction', [
    base64,
    { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' },
  ]);
}

export async function confirmTransactionRaw(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 60000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await rpcCall('getSignatureStatuses', [[signature]]);
    const status = result?.value?.[0];
    if (status) {
      if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') return;
    }
    // Check if blockhash expired
    const bhResult = await rpcCall('isBlockhashValid', [blockhash, { commitment: 'confirmed' }]);
    if (!bhResult?.value) throw new Error('Transaction expired (blockhash no longer valid)');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Transaction confirmation timeout');
}

export { PublicKey, LAMPORTS_PER_SOL, DEVNET_URL };
export type { Connection };
