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

// ── On-chain purchase memo parsing ──

const MEMO_PREFIX = 'oracle-pet:';

export interface OraclePetPurchase {
  type: 'shop' | 'premium' | 'sync';
  itemId: string;
  timestamp: number | null;
  signature: string;
}

/**
 * Strip Solana's "[N] " prefix from memo strings.
 * RPC returns memos as e.g. "[1] oracle-pet:shop|headphones"
 */
function stripMemoPrefix(raw: string): string {
  return raw.replace(/^\[\d+\]\s*/, '');
}

/**
 * Fetch all oracle-pet:* memos from the user's transaction history.
 * Used to restore purchases on fresh install without a backend.
 */
export async function getOraclePetPurchases(address: string): Promise<OraclePetPurchase[]> {
  try {
    const pubkey = new PublicKey(address);
    const signatures = await getSignaturesForAddressRaw(pubkey, 200);

    const purchases: OraclePetPurchase[] = [];

    for (const sig of signatures) {
      // Skip failed transactions
      if (sig.err !== null) continue;
      if (!sig.memo) continue;

      const memo = stripMemoPrefix(sig.memo);
      if (!memo.startsWith(MEMO_PREFIX)) continue;

      // Parse "oracle-pet:<type>|<payload>"
      const body = memo.slice(MEMO_PREFIX.length); // e.g. "shop|headphones"
      const pipeIdx = body.indexOf('|');
      if (pipeIdx === -1) continue;

      const type = body.slice(0, pipeIdx);
      const payload = body.slice(pipeIdx + 1);

      if (type === 'shop' || type === 'premium' || type === 'sync') {
        purchases.push({
          type,
          itemId: payload,
          timestamp: sig.blockTime ?? null,
          signature: sig.signature,
        });
      }
    }

    console.log('[transactionHistory] getOraclePetPurchases found:', purchases.length, 'memos');
    return purchases;
  } catch (error) {
    console.error('[transactionHistory] getOraclePetPurchases error:', error);
    return [];
  }
}
