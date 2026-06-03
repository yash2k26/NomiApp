import { writeMemo } from './solanaTransactions';
import { getSolscanTxUrl } from './solanaClient';

/*
 * On-chain referral verification.
 *
 * Today: when a recipient (B) redeems referrer A's code, B signs a memo
 * transaction `oraclepet:referral|<refA>|<refB>` that confirms on Solana.
 * The tx is the proof. Local SKR credit happens only after the tx confirms.
 *
 * Future (server-side reconciliation): a worker scans these memos and pays
 * out real SKR from a treasury to both sides. For now A's bonus is queued in
 * the UI as "you'll get paid out when your friend's tx confirms" — we don't
 * have a treasury yet, so the credit stays local. The on-chain memo is the
 * audit trail that lets you reconcile later.
 */

const MEMO_PREFIX = 'oraclepet:referral';

export interface ReferralMemo {
  referrer: string;
  redeemer: string;
}

export function buildReferralMemo(referrer: string, redeemer: string): string {
  return `${MEMO_PREFIX}|${referrer}|${redeemer}`;
}

export function parseReferralMemo(memo: string | null | undefined): ReferralMemo | null {
  if (!memo) return null;
  const parts = memo.split('|');
  if (parts.length !== 3) return null;
  if (parts[0] !== MEMO_PREFIX) return null;
  if (!parts[1] || !parts[2]) return null;
  return { referrer: parts[1], redeemer: parts[2] };
}

/**
 * Submit a referral redemption as an on-chain memo transaction. Only the
 * network fee (~0.000005 SOL) is charged. Returns the tx signature on
 * confirmation; throws on failure or user cancellation.
 */
export async function submitReferralOnChain(
  authToken: string,
  referrer: string,
  redeemer: string,
): Promise<{ txSignature: string; solscanUrl: string }> {
  const memo = buildReferralMemo(referrer, redeemer);
  const txSignature = await writeMemo(authToken, memo);
  return { txSignature, solscanUrl: getSolscanTxUrl(txSignature) };
}
