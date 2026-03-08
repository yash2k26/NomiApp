import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getLatestBlockhashRaw,
  getMinimumBalanceForRentExemptionRaw,
  sendRawTransactionRaw,
  confirmTransactionRaw,
  getBalance as getBalanceRaw,
} from './solanaClient';

export async function getLatestBlockhash() {
  return getLatestBlockhashRaw();
}

export async function getMinimumBalanceForRentExemption(size: number) {
  return getMinimumBalanceForRentExemptionRaw(size);
}

export async function getBalance(address: string): Promise<number> {
  try {
    return await getBalanceRaw(address);
  } catch {
    return 0;
  }
}

export async function sendTransaction(serializedTx: Uint8Array): Promise<string> {
  return sendRawTransactionRaw(serializedTx);
}

export async function confirmTransaction(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  await confirmTransactionRaw(signature, blockhash, lastValidBlockHeight);
}

export { LAMPORTS_PER_SOL };
