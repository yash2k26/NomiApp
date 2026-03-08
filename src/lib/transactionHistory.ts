import { getSignaturesForAddressRaw } from './solanaClient';
import { PublicKey } from '@solana/web3.js';

export interface OnChainTransaction {
  signature: string;
  timestamp: number | null;
  slot: number;
  err: boolean;
  memo: string | null;
}

/**
 * Fetch recent transaction signatures for an address from Solana devnet.
 */
export async function getTransactionHistory(
  address: string,
  limit: number = 15,
): Promise<OnChainTransaction[]> {
  try {
    const pubkey = new PublicKey(address);
    const signatures = await getSignaturesForAddressRaw(pubkey, limit);

    return signatures.map((sig) => ({
      signature: sig.signature,
      timestamp: sig.blockTime ?? null,
      slot: sig.slot,
      err: sig.err !== null,
      memo: sig.memo ?? null,
    }));
  } catch (error) {
    console.error('[transactionHistory] fetch error:', error);
    return [];
  }
}
