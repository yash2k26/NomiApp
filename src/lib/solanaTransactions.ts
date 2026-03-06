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
  console.log('[solanaTx] signAndSendTransaction — starting');
  console.log('[solanaTx] additionalSigners count:', additionalSigners.length);
  console.log('[solanaTx] transaction instructions:', transaction.instructions.length);

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    console.log('[solanaTx] signAndSend — payer:', payer.toBase58());

    console.log('[solanaTx] signAndSend — fetching latest blockhash...');
    const bhStart = Date.now();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    console.log('[solanaTx] signAndSend — blockhash:', blockhash, 'height:', lastValidBlockHeight, 'in', Date.now() - bhStart, 'ms');

    transaction.feePayer = payer;
    transaction.recentBlockhash = blockhash;

    if (additionalSigners.length > 0) {
      console.log('[solanaTx] signAndSend — partial signing with', additionalSigners.length, 'keypair(s)...');
      try {
        transaction.partialSign(...additionalSigners);
        console.log('[solanaTx] signAndSend — partial sign OK');
      } catch (err: any) {
        console.error('[solanaTx] signAndSend — partial sign FAILED:', err.message);
        throw err;
      }
    }

    console.log('[solanaTx] signAndSend — requesting wallet signature via MWA...');
    const signStart = Date.now();
    let signedTxs: Transaction[];
    try {
      signedTxs = await wallet.signTransactions({ transactions: [transaction] });
      console.log('[solanaTx] signAndSend — wallet signed in', Date.now() - signStart, 'ms');
    } catch (err: any) {
      console.error('[solanaTx] signAndSend — wallet sign FAILED after', Date.now() - signStart, 'ms:', err.message);
      throw err;
    }

    console.log('[solanaTx] signAndSend — sending raw transaction...');
    const sendStart = Date.now();
    let txSig: string;
    try {
      txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('[solanaTx] signAndSend — sent in', Date.now() - sendStart, 'ms, signature:', txSig);
    } catch (err: any) {
      console.error('[solanaTx] signAndSend — sendRawTransaction FAILED after', Date.now() - sendStart, 'ms');
      console.error('[solanaTx] signAndSend — error:', err.message);
      console.error('[solanaTx] signAndSend — logs:', err.logs || '(none)');
      throw err;
    }

    console.log('[solanaTx] signAndSend — confirming transaction...');
    const confirmStart = Date.now();
    try {
      await connection.confirmTransaction(
        { signature: txSig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      console.log('[solanaTx] signAndSend — confirmed in', Date.now() - confirmStart, 'ms');
    } catch (err: any) {
      console.error('[solanaTx] signAndSend — confirmation FAILED after', Date.now() - confirmStart, 'ms:', err.message);
      throw err;
    }

    console.log('[solanaTx] signAndSendTransaction SUCCESS — signature:', txSig);
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
  console.log('[solanaTx] transferSOL — to:', recipientAddress, 'amount:', amountSOL, 'SOL');
  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
  console.log('[solanaTx] transferSOL — lamports:', lamports);

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    console.log('[solanaTx] transferSOL — payer:', payer.toBase58());

    console.log('[solanaTx] transferSOL — fetching blockhash...');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    console.log('[solanaTx] transferSOL — blockhash:', blockhash);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(recipientAddress),
        lamports,
      }),
    );

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    console.log('[solanaTx] transferSOL — requesting wallet signature...');
    const signStart = Date.now();
    let signedTxs: Transaction[];
    try {
      signedTxs = await wallet.signTransactions({ transactions: [tx] });
      console.log('[solanaTx] transferSOL — signed in', Date.now() - signStart, 'ms');
    } catch (err: any) {
      console.error('[solanaTx] transferSOL — wallet sign FAILED:', err.message);
      throw err;
    }

    console.log('[solanaTx] transferSOL — sending...');
    const sendStart = Date.now();
    let txSig: string;
    try {
      txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('[solanaTx] transferSOL — sent in', Date.now() - sendStart, 'ms, signature:', txSig);
    } catch (err: any) {
      console.error('[solanaTx] transferSOL — send FAILED:', err.message);
      console.error('[solanaTx] transferSOL — logs:', err.logs || '(none)');
      throw err;
    }

    console.log('[solanaTx] transferSOL — confirming...');
    const confirmStart = Date.now();
    try {
      await connection.confirmTransaction(
        { signature: txSig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      console.log('[solanaTx] transferSOL — confirmed in', Date.now() - confirmStart, 'ms');
    } catch (err: any) {
      console.error('[solanaTx] transferSOL — confirmation FAILED:', err.message);
      throw err;
    }

    console.log('[solanaTx] transferSOL SUCCESS — signature:', txSig);
    return txSig;
  });
}

/**
 * Request a mainnet airdrop — NOTE: airdrops only work on devnet/testnet.
 * This will fail on mainnet. Kept for reference only.
 */
export async function requestAirdrop(address: string, amountSOL: number = 1): Promise<string> {
  console.log('[solanaTx] requestAirdrop — address:', address, 'amount:', amountSOL, 'SOL');
  console.warn('[solanaTx] WARNING: Airdrops do NOT work on mainnet!');

  try {
    const pubkey = new PublicKey(address);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    console.log('[solanaTx] requestAirdrop — requesting...');
    const sig = await connection.requestAirdrop(pubkey, amountSOL * LAMPORTS_PER_SOL);
    console.log('[solanaTx] requestAirdrop — sig:', sig, '— confirming...');
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );
    console.log('[solanaTx] requestAirdrop SUCCESS — sig:', sig);
    return sig;
  } catch (err: any) {
    console.error('[solanaTx] requestAirdrop FAILED:', err.message);
    throw err;
  }
}

/**
 * Write a memo on-chain (for pet state verification).
 */
export async function writeMemo(authToken: string, message: string): Promise<string> {
  console.log('[solanaTx] writeMemo — message length:', message.length, 'preview:', message.slice(0, 50));

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    console.log('[solanaTx] writeMemo — payer:', payer.toBase58());

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    console.log('[solanaTx] writeMemo — blockhash:', blockhash);

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(message),
      }),
    );

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    console.log('[solanaTx] writeMemo — requesting wallet signature...');
    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    console.log('[solanaTx] writeMemo — signed, sending...');

    const txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log('[solanaTx] writeMemo — sent, signature:', txSig, '— confirming...');

    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    console.log('[solanaTx] writeMemo SUCCESS — signature:', txSig);
    return txSig;
  });
}
