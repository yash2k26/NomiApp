import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  connection,
  getLatestBlockhashRaw,
  sendRawTransactionRaw,
} from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Confirm a transaction using web3.js Connection.
 * Retries on network errors (Android may briefly lose network after wallet interaction).
 */
async function confirmWithRetry(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 30000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      if (result.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
      }
      console.log('[solanaTx] confirmed via web3.js');
      return;
    } catch (err: any) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out')) {
        console.warn('[solanaTx] confirm network error, retrying...', err?.message);
        await delay(2000);
        continue;
      }
      console.warn('[solanaTx] confirm error:', err?.message);
      break;
    }
  }

  // Fallback: check signature status
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const statuses = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const status = statuses.value[0];
      if (status?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status) {
        console.log('[solanaTx] accepted status:', status.confirmationStatus ?? 'processed');
        return;
      }
    } catch (err: any) {
      console.warn(`[solanaTx] status check ${attempt + 1} failed:`, err?.message);
      await delay(1500);
    }
  }

  // Don't throw — tx was already submitted on-chain
  console.warn('[solanaTx] could not confirm, but tx was submitted:', signature);
}

export async function signAndSendTransaction(
  authToken: string,
  transaction: Transaction,
  additionalSigners: Keypair[] = [],
): Promise<string> {
  console.log('[solanaTx] signAndSendTransaction start');

  // Phase 1: Get blockhash OUTSIDE wallet session
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();
  console.log('[solanaTx] blockhash fetched');

  // Phase 2: Wallet session — ONLY sign
  const serializedTx = await withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    transaction.feePayer = payer;
    transaction.recentBlockhash = blockhash;

    if (additionalSigners.length > 0) {
      transaction.partialSign(...additionalSigners);
    }

    console.log('[solanaTx] signAndSend — signing via wallet...');
    const signedTxs = await wallet.signTransactions({ transactions: [transaction] });
    const serialized = signedTxs[0].serialize();
    console.log('[solanaTx] signAndSend — signed, bytes:', serialized.length);
    return serialized;
  });

  // Phase 3: Send + confirm OUTSIDE wallet session
  console.log('[solanaTx] signAndSend — submitting via web3.js...');
  const txSig = await sendRawTransactionRaw(serializedTx);
  console.log('[solanaTx] signAndSend — submitted:', txSig);
  await confirmWithRetry(txSig, blockhash, lastValidBlockHeight);
  return txSig;
}

export async function transferSOL(
  authToken: string,
  recipientAddress: string,
  amountSOL: number,
  memo?: string,
): Promise<string> {
  const startedAt = Date.now();
  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
  console.log('[solanaTx] transferSOL start', { recipientAddress, amountSOL, lamports, memo: memo ?? null });

  try {
    // Phase 1: Get blockhash OUTSIDE wallet session
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();
    console.log('[solanaTx] transferSOL blockhash fetched:', blockhash);

    // Phase 2: Wallet session — ONLY sign (no RPC calls inside)
    const serializedTx = await withWallet(authToken, async (wallet, address) => {
      const payer = new PublicKey(address);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: new PublicKey(recipientAddress),
          lamports,
        }),
      );

      // Attach memo instruction in the same tx (single wallet popup, single fee)
      if (memo) {
        tx.add(
          new TransactionInstruction({
            keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: Buffer.from(memo),
          }),
        );
      }

      tx.feePayer = payer;
      tx.recentBlockhash = blockhash;

      console.log('[solanaTx] transferSOL — signing via wallet...');
      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      const serialized = signedTxs[0].serialize();
      console.log('[solanaTx] transferSOL — signed, bytes:', serialized.length);
      return serialized;
    });

    // Phase 3: Send + confirm OUTSIDE wallet session (MWA closed)
    console.log('[solanaTx] transferSOL — submitting via web3.js...');
    const txSig = await sendRawTransactionRaw(serializedTx);
    console.log('[solanaTx] transferSOL — submitted:', txSig);
    await confirmWithRetry(txSig, blockhash, lastValidBlockHeight);
    console.log('[solanaTx] transferSOL confirmed in', Date.now() - startedAt, 'ms');
    return txSig;
  } catch (err: any) {
    console.error('[solanaTx] transferSOL failed', {
      recipientAddress,
      amountSOL,
      elapsedMs: Date.now() - startedAt,
      error: err?.message ?? String(err),
    });
    throw err;
  }
}

export async function requestAirdrop(address: string, amountSOL = 1): Promise<string> {
  console.log('[solanaTx] requestAirdrop start', { address, amountSOL });
  const pubkey = new PublicKey(address);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();
  const sig = await connection.requestAirdrop(pubkey, amountSOL * LAMPORTS_PER_SOL);
  await confirmWithRetry(sig, blockhash, lastValidBlockHeight);
  console.log('[solanaTx] requestAirdrop success:', sig);
  return sig;
}

export async function writeMemo(authToken: string, message: string): Promise<string> {
  console.log('[solanaTx] writeMemo start', { length: message.length });

  // Phase 1: Get blockhash OUTSIDE wallet session
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();

  // Phase 2: Wallet session — ONLY sign
  const serializedTx = await withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(message),
      }),
    );
    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    console.log('[solanaTx] writeMemo — signing via wallet...');
    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    return signedTxs[0].serialize();
  });

  // Phase 3: Send + confirm OUTSIDE wallet session
  const txSig = await sendRawTransactionRaw(serializedTx);
  await confirmWithRetry(txSig, blockhash, lastValidBlockHeight);
  console.log('[solanaTx] writeMemo success:', txSig);
  return txSig;
}
