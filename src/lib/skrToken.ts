import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAccountInfoRaw,
  getLatestBlockhashRaw,
  getMinimumBalanceForRentExemptionRaw,
  sendRawTransactionRaw,
  confirmTransactionRaw,
} from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

// ── SKR Token Constants ──

// Real SKR mint on mainnet (Solana Mobile Seeker token)
export const SKR_MINT_MAINNET = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// Use TOKEN_PROGRAM_ID from @solana/spl-token (imported above)

// Devnet test mint stored here
const SKR_DEVNET_MINT_KEY = 'oracle-pet-skr-devnet-mint';
const SKR_DECIMALS = 6;
const SKR_CLAIM_AMOUNT = 100; // 100 SKR per claim

// ── Helpers ──

function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner);
}

/**
 * Get the current devnet test SKR mint address (if created).
 */
async function getDevnetMint(): Promise<{ mintPubkey: PublicKey; mintKeypair: Keypair } | null> {
  try {
    const raw = await AsyncStorage.getItem(SKR_DEVNET_MINT_KEY);
    if (!raw) return null;
    const secretKey = new Uint8Array(JSON.parse(raw));
    const mintKeypair = Keypair.fromSecretKey(secretKey);
    return { mintPubkey: mintKeypair.publicKey, mintKeypair };
  } catch {
    return null;
  }
}

/**
 * Get the active SKR mint for the current network.
 * On devnet: returns test mint (or null if not created yet).
 * On mainnet: returns the real SKR mint.
 */
export async function getActiveSkrMint(): Promise<PublicKey> {
  return new PublicKey(SKR_MINT_MAINNET);
}

// ── Balance ──

/**
 * Get SKR token balance for a wallet address.
 */
export async function getSkrBalance(address: string): Promise<number> {
  try {
    const mint = await getActiveSkrMint();
    const owner = new PublicKey(address);
    const ata = findAssociatedTokenAddress(owner, mint);

    const accountInfo = await getAccountInfoRaw(ata);
    if (!accountInfo) return 0;

    // Parse SPL token account data — balance is at offset 64, u64 LE
    const data = accountInfo.data;
    if (data.length < 72) return 0;

    const rawAmount = data.readBigUInt64LE(64);
    return Number(rawAmount) / Math.pow(10, SKR_DECIMALS);
  } catch (err) {
    console.warn('[skrToken] getSkrBalance error:', err);
    return 0;
  }
}

// ── Claim Test SKR (Devnet Only) ──

/**
 * Create a test SKR mint on devnet and mint tokens to the user.
 * First call creates the mint; subsequent calls just mint more tokens.
 */
export async function claimTestSkr(authToken: string): Promise<string> {
  let stored = await getDevnetMint();
  const amount = SKR_CLAIM_AMOUNT * Math.pow(10, SKR_DECIMALS);

  if (!stored) {
    // First time: create mint + ATA + mint tokens in one transaction
    const mintKeypair = Keypair.generate();

    const txSig = await withWallet(authToken, async (wallet, address) => {
      const payer = new PublicKey(address);
      const mintPubkey = mintKeypair.publicKey;
      const ata = findAssociatedTokenAddress(payer, mintPubkey);
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();

      const mintRent = await getMinimumBalanceForRentExemptionRaw(82);

      const tx = new Transaction();

      // 1. Create mint account
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mintPubkey,
          space: 82,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        }),
      );

      // 2. Initialize mint (decimals=6, mintAuthority=payer) — uses InitializeMint2 (correct encoding)
      tx.add(createInitializeMint2Instruction(mintPubkey, SKR_DECIMALS, payer, payer));

      // 3. Create ATA
      tx.add(createAssociatedTokenAccountInstruction(payer, ata, payer, mintPubkey));

      // 4. Mint tokens
      tx.add(createMintToInstruction(mintPubkey, ata, payer, BigInt(amount)));

      tx.feePayer = payer;
      tx.recentBlockhash = blockhash;
      tx.partialSign(mintKeypair);

      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      const sig = await sendRawTransactionRaw(signedTxs[0].serialize());

      await confirmTransactionRaw(sig, blockhash, lastValidBlockHeight);

      return sig;
    });

    // Save mint keypair for future mints
    await AsyncStorage.setItem(
      SKR_DEVNET_MINT_KEY,
      JSON.stringify(Array.from(mintKeypair.secretKey)),
    );

    return txSig;
  }

  // Subsequent claims: just mint more tokens
  // NOTE: mintAuthority is the user's wallet (set during create), so we need
  // the user to sign a MintTo instruction.
  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const mintPubkey = stored!.mintPubkey;
    const ata = findAssociatedTokenAddress(payer, mintPubkey);
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();

    const tx = new Transaction();

    // Check if ATA exists, create if not
    const ataInfo = await getAccountInfoRaw(ata);
    if (!ataInfo) {
      tx.add(createAssociatedTokenAccountInstruction(payer, ata, payer, mintPubkey));
    }

    tx.add(createMintToInstruction(mintPubkey, ata, payer, BigInt(amount)));

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const sig = await sendRawTransactionRaw(signedTxs[0].serialize());

    await confirmTransactionRaw(sig, blockhash, lastValidBlockHeight);

    return sig;
  });
}

// ── Transfer SKR ──

/**
 * Transfer SKR tokens from connected wallet to a recipient.
 */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export async function transferSkr(
  authToken: string,
  recipientAddress: string,
  amount: number,
  memo?: string,
): Promise<string> {
  const mint = await getActiveSkrMint();

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const recipient = new PublicKey(recipientAddress);
    const senderAta = findAssociatedTokenAddress(payer, mint);
    const recipientAta = findAssociatedTokenAddress(recipient, mint);
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashRaw();

    const rawAmount = BigInt(Math.round(amount * Math.pow(10, SKR_DECIMALS)));

    const tx = new Transaction();

    // Create recipient ATA if it doesn't exist
    const recipientAtaInfo = await getAccountInfoRaw(recipientAta);
    if (!recipientAtaInfo) {
      tx.add(createAssociatedTokenAccountInstruction(payer, recipientAta, recipient, mint));
    }

    // SPL Token Transfer
    tx.add(createTransferInstruction(senderAta, recipientAta, payer, rawAmount));

    // Attach memo for on-chain purchase tracking
    if (memo) {
      tx.add(
        new TransactionInstruction({
          keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memo, 'utf-8'),
        }),
      );
    }

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const sig = await sendRawTransactionRaw(signedTxs[0].serialize());

    await confirmTransactionRaw(sig, blockhash, lastValidBlockHeight);

    return sig;
  });
}
