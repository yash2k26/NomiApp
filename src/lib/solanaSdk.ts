import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.EXPO_PUBLIC_HELIUS_API_KEY ?? '';
const MAINNET_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const connection = new Connection(MAINNET_URL, 'confirmed');

// Read calls — SDK fetch works fine for these
export async function getLatestBlockhash() {
  return connection.getLatestBlockhash('confirmed');
}

export async function getMinimumBalanceForRentExemption(size: number) {
  return connection.getMinimumBalanceForRentExemption(size, 'confirmed');
}

export async function getBalance(address: string): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address), 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// ── XHR-based send (fetch fails for large POST bodies on Android RN) ──

const RPC_URLS = HELIUS_API_KEY
  ? [MAINNET_URL, 'https://api.mainnet-beta.solana.com']
  : ['https://api.mainnet-beta.solana.com'];

function xhrRpc(method: string, params: any[]): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

  function tryEndpoint(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 45000;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.error) {
              const logs = json.error?.data?.logs;
              const logStr = logs ? '\nLogs: ' + logs.join('\n') : '';
              reject(new Error(`${json.error.message}${logStr}`));
            } else {
              resolve(json.result);
            }
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error(`XHR error for ${url}`));
      xhr.ontimeout = () => reject(new Error(`XHR timeout for ${url}`));
      xhr.send(body);
    });
  }

  // Try endpoints in order
  return RPC_URLS.reduce(
    (chain, url) => chain.catch(() => tryEndpoint(url)),
    tryEndpoint(RPC_URLS[0]),
  );
}

export async function sendTransaction(serializedTx: Uint8Array): Promise<string> {
  console.log('[solanaSdk] sendTransaction via XHR — tx size:', serializedTx.length);
  const base64 = Buffer.from(serializedTx).toString('base64');
  return xhrRpc('sendTransaction', [
    base64,
    { encoding: 'base64', skipPreflight: true, preflightCommitment: 'confirmed' },
  ]);
}

export async function confirmTransaction(
  signature: string,
  blockhash: string,
  _lastValidBlockHeight: number,
): Promise<void> {
  console.log('[solanaSdk] confirmTransaction via XHR — sig:', signature);
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const result = await xhrRpc('getSignatureStatuses', [[signature]]);
    const status = result?.value?.[0];
    if (status) {
      if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        console.log('[solanaSdk] confirmed in', Date.now() - start, 'ms');
        return;
      }
    }
    const bh = await xhrRpc('isBlockhashValid', [blockhash, { commitment: 'confirmed' }]);
    if (!bh?.value) throw new Error('Blockhash expired');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Confirmation timeout');
}