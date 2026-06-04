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
 * Fetch recent transaction signatures for an address. Pass `before` to
 * paginate further back — e.g. pass the last visible signature to get the
 * NEXT page of older transactions.
 */
export async function getTransactionHistory(
  address: string,
  limit: number = 30,
  before?: string,
): Promise<OnChainTransaction[]> {
  try {
    const pubkey = new PublicKey(address);
    const signatures = await getSignaturesForAddressRaw(pubkey, limit, before);

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
  type: 'shop' | 'premium' | 'sync' | 'mint' | 'streak-repair';
  itemId: string;
  timestamp: number | null;
  signature: string;
}

/**
 * Strip Solana's "[N] " prefix from memo strings.
 * RPC returns memos as e.g. "[1] oracle-pet:shop|headphones"
 *
 * Also handles common edge cases observed in the wild:
 *   - Leading whitespace before "[N]"
 *   - Trailing whitespace
 *   - Multiple bracketed prefixes (rare but possible if memo was wrapped)
 *   - Null-byte padding (Metaplex artifacts)
 */
function stripMemoPrefix(raw: string): string {
  return raw
    .replace(/\0+/g, '')
    .replace(/^\s*(\[\d+\]\s*)+/, '')
    .trim();
}

/**
 * Fetch all oracle-pet:* memos from the user's transaction history.
 * Used to restore purchases on fresh install / wallet reconnect.
 *
 * Paginates up to MAX_PAGES * PAGE_SIZE signatures so users with active
 * wallets (frequent unrelated activity) don't lose their Nomi history when
 * older Nomi memos scroll off the most-recent page. Capped to prevent
 * unbounded scans on heavily-used wallets.
 */
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // up to 1000 signatures scanned (fast path)
// Deep rescue cap. Only used when the fast scan + server ledger found NO
// premium and NO mint memo for a wallet that clearly has on-chain history —
// i.e. a paying user whose AsyncStorage cache was wiped (reinstall /
// sideloaded APK) and who bought BEFORE the server ledger existed. Their
// only restore path is this scan; if their premium memo scrolled past 1000
// signatures of unrelated activity, Pro was being lost permanently. The
// `stopWhenFound` early-exit means real Pro owners almost always bail out
// long before this cap; the cap only bounds cost for heavy non-Nomi wallets.
const DEEP_MAX_PAGES = 30; // up to 6000 signatures scanned

interface ScanOpts {
  /** Page cap. Defaults to MAX_PAGES (fast path). */
  maxPages?: number;
  /** Stop paging as soon as a memo of each listed type has been seen. Used
   *  only by the deep rescue pass so it exits early for actual owners. */
  stopWhenFound?: OraclePetPurchase['type'][];
}

export async function getOraclePetPurchases(
  address: string,
  opts: ScanOpts = {},
): Promise<OraclePetPurchase[]> {
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const stopWhenFound = opts.stopWhenFound ?? null;
  try {
    const pubkey = new PublicKey(address);
    const purchases: OraclePetPurchase[] = [];
    let before: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      const signatures = await getSignaturesForAddressRaw(pubkey, PAGE_SIZE, before);
      if (!signatures || signatures.length === 0) break;

      for (const sig of signatures) {
        if (sig.err !== null) continue;
        if (!sig.memo) continue;

        const memo = stripMemoPrefix(sig.memo);
        if (!memo.startsWith(MEMO_PREFIX)) continue;

        const body = memo.slice(MEMO_PREFIX.length); // "shop|headphones"
        const pipeIdx = body.indexOf('|');
        if (pipeIdx === -1) continue;

        // Trim each segment defensively — saw real memos with stray
        // whitespace that would otherwise fail TIER_ORDER lookups or
        // shopStore.id comparisons. Cheap insurance.
        const type = body.slice(0, pipeIdx).trim();
        const payload = body.slice(pipeIdx + 1).trim();

        if (type === 'shop' || type === 'premium' || type === 'sync' || type === 'mint' || type === 'streak-repair') {
          purchases.push({
            type,
            itemId: payload,
            timestamp: sig.blockTime ?? null,
            signature: sig.signature,
          });
        }
      }

      // Deep-rescue early exit: once every requested critical memo type has
      // been seen, stop — no need to keep paging thousands of signatures
      // deep just to confirm what we already found.
      if (
        stopWhenFound &&
        stopWhenFound.every((t) => purchases.some((p) => p.type === t))
      ) {
        break;
      }

      // Partial-page handling. Previously we treated any `signatures.length <
      // PAGE_SIZE` as definitive end-of-history. But rate-limited RPC
      // sometimes returns a short page even when more history exists,
      // silently truncating restore for active wallets. Now: retry the same
      // window once with backoff before declaring done. Only stop early if
      // BOTH attempts return short.
      if (signatures.length < PAGE_SIZE) {
        await new Promise((r) => setTimeout(r, 600));
        const retry = await getSignaturesForAddressRaw(
          pubkey,
          PAGE_SIZE,
          before,
        ).catch(() => null);
        if (!retry || retry.length <= signatures.length) {
          // Retry gave us no more data — actually at end of history.
          break;
        }
        // Retry got more sigs; advance to the bottom of the retry result so
        // the next page continues from beyond what we've seen.
        before = retry[retry.length - 1].signature;
        continue;
      }
      before = signatures[signatures.length - 1].signature;
    }

    console.log('[transactionHistory] getOraclePetPurchases found:', purchases.length, 'memos');
    return purchases;
  } catch (error) {
    console.error('[transactionHistory] getOraclePetPurchases error:', error);
    return [];
  }
}
