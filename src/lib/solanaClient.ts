import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';

const CLUSTER = 'devnet';
const DEVNET_URL = clusterApiUrl(CLUSTER);

// Shared RPC connection (works in Expo Go — no native modules needed)
export const connection = new Connection(DEVNET_URL, 'confirmed');

export const APP_IDENTITY = {
  name: 'Oracle Pet',
  uri: 'https://oraclepet.app',
  icon: 'favicon.ico',
};

/**
 * Fetch real SOL balance for an address.
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[solanaClient] getBalance error:', error);
    return 0;
  }
}

// Shop treasury address (devnet keypair — receives SOL for purchases)
export const SHOP_TREASURY = 'FHE2gMqe3kk7JDqBQffFqJoBEQGp3DdeQ42K2pHswfJU';

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

export { PublicKey, LAMPORTS_PER_SOL };
export type { Connection };
