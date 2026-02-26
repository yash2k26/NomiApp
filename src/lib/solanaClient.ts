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

export { PublicKey, LAMPORTS_PER_SOL };
export type { Connection };
