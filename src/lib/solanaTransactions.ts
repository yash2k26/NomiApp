import { Transaction, PublicKey, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Keypair } from '@solana/web3.js';
import { connection } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Sign and send a transaction via MWA (opens Phantom for approval).
 * Optionally partial-sign with additional keypairs before sending to wallet.
 */
export async function signAndSendTransaction(
  authToken: string,
  transaction: Transaction,
  additionalSigners: Keypair[] = [],
): Promise<string> {
  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    transaction.feePayer = payer;
    transaction.recentBlockhash = blockhash;

    // Partial sign with any additional keypairs (e.g., new mint account)
    if (additionalSigners.length > 0) {
      transaction.partialSign(...additionalSigners);
    }

    // Send to MWA for wallet signature
    const signedTxs = await wallet.signTransactions({
      transactions: [transaction],
    });

    const txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return txSig;
  });
}

/**
 * Transfer SOL from connected wallet to a recipient.
 */
export async function transferSOL(
  authToken: string,
  recipientAddress: string,
  amountSOL: number,
): Promise<string> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: PublicKey.default, // placeholder — set by signAndSendTransaction
      toPubkey: new PublicKey(recipientAddress),
      lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
    }),
  );

  // Fix: fromPubkey needs to be set inside withWallet where we know the address
  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(recipientAddress),
        lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
      }),
    );

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return txSig;
  });
}

/**
 * Request a devnet airdrop (for demos).
 */
export async function requestAirdrop(address: string, amountSOL: number = 1): Promise<string> {
  const pubkey = new PublicKey(address);
  const sig = await connection.requestAirdrop(pubkey, amountSOL * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

/**
 * Write a memo on-chain (for pet state verification).
 */
export async function writeMemo(authToken: string, message: string): Promise<string> {
  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(message),
      }),
    );

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return txSig;
  });
}
