import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connection } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

// ── SKR Token Constants ──

// Real SKR mint on mainnet (Solana Mobile Seeker token)
export const SKR_MINT_MAINNET = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// SPL Token Program
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

// Devnet test mint stored here
const SKR_DEVNET_MINT_KEY = 'oracle-pet-skr-devnet-mint';
const SKR_DECIMALS = 6;
const SKR_CLAIM_AMOUNT = 100; // 100 SKR per claim

// ── Helpers ──

function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return pda;
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
export async function getActiveSkrMint(): Promise<PublicKey | null> {
  // For devnet, use our test mint
  const devnet = await getDevnetMint();
  if (devnet) return devnet.mintPubkey;
  return null;
  // On mainnet: return new PublicKey(SKR_MINT_MAINNET);
}

// ── Balance ──

/**
 * Get SKR token balance for a wallet address.
 */
export async function getSkrBalance(address: string): Promise<number> {
  try {
    const mint = await getActiveSkrMint();
    if (!mint) return 0;

    const owner = new PublicKey(address);
    const ata = findAssociatedTokenAddress(owner, mint);

    const accountInfo = await connection.getAccountInfo(ata);
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
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const mintRent = await connection.getMinimumBalanceForRentExemption(82);

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

      // 2. Initialize mint (decimals=6, mintAuthority=payer)
      tx.add({
        programId: TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          0, // InitializeMint instruction
          SKR_DECIMALS, // decimals
          ...payer.toBytes(), // mintAuthority
          1, // has freezeAuthority
          ...payer.toBytes(), // freezeAuthority
        ]),
      });

      // 3. Create ATA
      tx.add({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: false, isWritable: false },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      });

      // 4. Mint tokens
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(BigInt(amount));

      tx.add({
        programId: TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false }, // mintAuthority
        ],
        data: Buffer.from([7, ...amountBuffer]), // MintTo instruction
      });

      tx.feePayer = payer;
      tx.recentBlockhash = blockhash;
      tx.partialSign(mintKeypair);

      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      const sig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

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
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));

    const tx = new Transaction();

    // Check if ATA exists, create if not
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      tx.add({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: false, isWritable: false },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      });
    }

    tx.add({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false }, // mintAuthority
      ],
      data: Buffer.from([7, ...amountBuffer]),
    });

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const sig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return sig;
  });
}

// ── Transfer SKR ──

/**
 * Transfer SKR tokens from connected wallet to a recipient.
 */
export async function transferSkr(
  authToken: string,
  recipientAddress: string,
  amount: number,
): Promise<string> {
  const mint = await getActiveSkrMint();
  if (!mint) throw new Error('SKR mint not available');

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const recipient = new PublicKey(recipientAddress);
    const senderAta = findAssociatedTokenAddress(payer, mint);
    const recipientAta = findAssociatedTokenAddress(recipient, mint);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const rawAmount = BigInt(Math.round(amount * Math.pow(10, SKR_DECIMALS)));
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(rawAmount);

    const tx = new Transaction();

    // Create recipient ATA if it doesn't exist
    const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
    if (!recipientAtaInfo) {
      tx.add({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: recipientAta, isSigner: false, isWritable: true },
          { pubkey: recipient, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      });
    }

    // SPL Token Transfer instruction (index 3)
    tx.add({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false }, // owner
      ],
      data: Buffer.from([3, ...amountBuffer]), // Transfer instruction
    });

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const sig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return sig;
  });
}
