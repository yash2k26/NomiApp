import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Helius mainnet RPC — set EXPO_PUBLIC_HELIUS_API_KEY in .env
const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? '';
const MAINNET_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

console.log('[solanaClient] Initializing — network: mainnet');
console.log('[solanaClient] Helius API key present:', !!HELIUS_API_KEY);
console.log('[solanaClient] Primary RPC endpoint:', MAINNET_URL);

// Shared RPC connection (kept for any remaining SDK usage)
export const connection = new Connection(MAINNET_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

export const APP_IDENTITY = {
  name: 'Nomi',
  uri: 'https://oraclepet.app',
  icon: 'favicon.png',
};

/**
 * Raw RPC via XMLHttpRequest — more reliable than fetch on React Native Android.
 * Falls back through multiple endpoints if one fails.
 */
const RPC_ENDPOINTS = HELIUS_API_KEY
  ? [MAINNET_URL, 'https://api.mainnet-beta.solana.com']
  : ['https://api.mainnet-beta.solana.com'];

console.log('[solanaClient] RPC endpoints configured:', RPC_ENDPOINTS.length);

function xhrPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[solanaClient] xhrPost → sending request to:', url);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 45000;
    const startTime = Date.now();
    console.log('[solanaClient] xhrPost → request body length:', body.length, 'chars');
    xhr.onreadystatechange = () => {
      console.log('[solanaClient] xhrPost → readyState:', xhr.readyState, 'status:', xhr.status, 'elapsed:', Date.now() - startTime, 'ms', 'url:', url);
    };
    xhr.onload = () => {
      const elapsed = Date.now() - startTime;
      console.log('[solanaClient] xhrPost → response status:', xhr.status, 'from:', url, 'in', elapsed, 'ms');
      console.log('[solanaClient] xhrPost → response headers:', xhr.getAllResponseHeaders());
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('[solanaClient] xhrPost → success, response length:', xhr.responseText.length);
        console.log('[solanaClient] xhrPost → response preview:', xhr.responseText.slice(0, 300));
        resolve(xhr.responseText);
      } else {
        console.error('[solanaClient] xhrPost → HTTP error:', xhr.status, xhr.statusText, 'url:', url);
        console.error('[solanaClient] xhrPost → error response body:', xhr.responseText?.slice(0, 500));
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => {
      const elapsed = Date.now() - startTime;
      console.error('[solanaClient] xhrPost → network error for:', url, 'after', elapsed, 'ms');
      console.error('[solanaClient] xhrPost → readyState at error:', xhr.readyState, 'status:', xhr.status);
      console.error('[solanaClient] xhrPost → responseText:', xhr.responseText || '(empty)');
      reject(new Error(`XHR error for ${url}`));
    };
    xhr.ontimeout = () => {
      console.error('[solanaClient] xhrPost → timeout (45s) for:', url, 'readyState:', xhr.readyState);
      reject(new Error(`XHR timeout for ${url}`));
    };
    console.log('[solanaClient] xhrPost → calling xhr.send()...');
    xhr.send(body);
    console.log('[solanaClient] xhrPost → xhr.send() returned, waiting for response...');
  });
}

let rpcCallCount = 0;

async function rpcCall(method: string, params: any[]): Promise<any> {
  const callId = ++rpcCallCount;
  const callStart = Date.now();
  console.log(`[solanaClient] rpcCall #${callId} → ${method} params:`, JSON.stringify(params).slice(0, 200));
  const body = JSON.stringify({ jsonrpc: '2.0', id: callId, method, params });
  let lastError: Error | null = null;

  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[i];
    try {
      console.log(`[solanaClient] rpcCall #${callId} → trying endpoint ${i + 1}/${RPC_ENDPOINTS.length}:`, endpoint);
      const text = await xhrPost(endpoint, body);
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error(`[solanaClient] rpcCall #${callId} → JSON parse error:`, parseErr, 'raw text:', text.slice(0, 500));
        throw new Error(`Invalid JSON response from ${endpoint}`);
      }
      if (json.error) {
        const logs = json.error?.data?.logs;
        const logStr = logs ? '\nLogs: ' + logs.join('\n') : '';
        const msg = `${json.error.message} (code: ${json.error.code})${logStr}`;
        console.error(`[solanaClient] rpcCall #${callId} → RPC error for ${method}:`, msg);
        console.error(`[solanaClient] rpcCall #${callId} → full error object:`, JSON.stringify(json.error));
        throw new Error(msg);
      }
      const elapsed = Date.now() - callStart;
      console.log(`[solanaClient] rpcCall #${callId} → ${method} succeeded on endpoint ${i + 1} in ${elapsed}ms`);
      return json.result;
    } catch (err: any) {
      if (err.message && !err.message.includes('XHR') && !err.message.includes('Invalid JSON')) {
        console.error(`[solanaClient] rpcCall #${callId} → non-network error, re-throwing:`, err.message);
        throw err;
      }
      console.warn(`[solanaClient] rpcCall #${callId} → endpoint ${i + 1} failed:`, err.message);
      lastError = err;
    }
  }
  const totalElapsed = Date.now() - callStart;
  console.error(`[solanaClient] rpcCall #${callId} → ALL ${RPC_ENDPOINTS.length} endpoints failed for ${method} after ${totalElapsed}ms`);
  throw lastError || new Error(`All RPC endpoints failed for ${method}`);
}

/**
 * Fetch real SOL balance for an address.
 */
export async function getBalance(address: string): Promise<number> {
  console.log('[solanaClient] getBalance → address:', address);
  try {
    const pubkey = new PublicKey(address);
    const result = await rpcCall('getBalance', [pubkey.toBase58(), { commitment: 'confirmed' }]);
    const balance = (result?.value ?? 0) / LAMPORTS_PER_SOL;
    console.log('[solanaClient] getBalance → result:', balance, 'SOL');
    return balance;
  } catch (error) {
    console.error('[solanaClient] getBalance → error:', error);
    return 0;
  }
}

// Shop treasury address (receives SOL for purchases)
export const SHOP_TREASURY = 'FHE2gMqe3kk7JDqBQffFqJoBEQGp3DdeQ42K2pHswfJU';

// SKR (Seeker) token — mainnet mint address
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// Solscan deep links (mainnet)
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
  console.log('[solanaClient] getLatestBlockhashRaw → fetching...');
  const result = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  console.log('[solanaClient] getLatestBlockhashRaw → blockhash:', result.value.blockhash, 'height:', result.value.lastValidBlockHeight);
  return result.value;
}

export async function getMinimumBalanceForRentExemptionRaw(size: number): Promise<number> {
  console.log('[solanaClient] getMinimumBalanceForRentExemptionRaw → size:', size);
  const result = await rpcCall('getMinimumBalanceForRentExemption', [size, { commitment: 'confirmed' }]);
  console.log('[solanaClient] getMinimumBalanceForRentExemptionRaw → lamports:', result);
  return result;
}

export async function sendRawTransactionRaw(serializedTx: Uint8Array): Promise<string> {
  console.log('[solanaClient] sendRawTransactionRaw → tx size:', serializedTx.length, 'bytes');
  const base64 = Buffer.from(serializedTx).toString('base64');
  console.log('[solanaClient] sendRawTransactionRaw → base64 length:', base64.length);

  // Retry up to 3 times with increasing delay
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        console.log('[solanaClient] sendRawTransactionRaw → retry attempt', attempt + 1);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      const signature = await rpcCall('sendTransaction', [
        base64,
        { encoding: 'base64', skipPreflight: true, preflightCommitment: 'confirmed' },
      ]);
      console.log('[solanaClient] sendRawTransactionRaw → signature:', signature);
      return signature;
    } catch (err: any) {
      console.error('[solanaClient] sendRawTransactionRaw → attempt', attempt + 1, 'failed:', err.message);
      lastError = err;
      // Don't retry on program errors (insufficient funds, etc.)
      if (err.message && !err.message.includes('XHR') && !err.message.includes('All RPC')) break;
    }
  }
  throw lastError || new Error('sendRawTransactionRaw failed after retries');
}

export async function confirmTransactionRaw(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 60000,
): Promise<void> {
  console.log('[solanaClient] confirmTransactionRaw → signature:', signature);
  console.log('[solanaClient] confirmTransactionRaw → blockhash:', blockhash, 'lastValidBlockHeight:', lastValidBlockHeight, 'timeout:', timeoutMs);
  const start = Date.now();
  let pollCount = 0;
  while (Date.now() - start < timeoutMs) {
    pollCount++;
    console.log('[solanaClient] confirmTransactionRaw → poll #' + pollCount, 'elapsed:', Date.now() - start, 'ms');
    const result = await rpcCall('getSignatureStatuses', [[signature]]);
    const status = result?.value?.[0];
    console.log('[solanaClient] confirmTransactionRaw → status:', JSON.stringify(status));
    if (status) {
      if (status.err) {
        console.error('[solanaClient] confirmTransactionRaw → transaction FAILED:', JSON.stringify(status.err));
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        console.log('[solanaClient] confirmTransactionRaw → confirmed! status:', status.confirmationStatus, 'after', Date.now() - start, 'ms');
        return;
      }
    }
    // Check if blockhash expired
    const bhResult = await rpcCall('isBlockhashValid', [blockhash, { commitment: 'confirmed' }]);
    console.log('[solanaClient] confirmTransactionRaw → blockhash valid:', bhResult?.value);
    if (!bhResult?.value) {
      console.error('[solanaClient] confirmTransactionRaw → blockhash expired!');
      throw new Error('Transaction expired (blockhash no longer valid)');
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error('[solanaClient] confirmTransactionRaw → timeout after', timeoutMs, 'ms');
  throw new Error('Transaction confirmation timeout');
}

export { PublicKey, LAMPORTS_PER_SOL, MAINNET_URL as DEVNET_URL };
export type { Connection };
