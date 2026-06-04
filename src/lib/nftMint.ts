import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';
import { getLatestBlockhash, getMinimumBalanceForRentExemption, sendTransaction, confirmTransaction } from './solanaSdk';
import { SHOP_TREASURY, getPriorityFeeMicroLamports, simulateTransactionRaw } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

// Metadata URI is env-overridable so production mints can point at Arweave /
// IPFS (decentralized + permanent) instead of the GitHub default which is a
// single point of failure for "Unknown NFT" display in wallets if github.com
// is down or rate-limits.
export const NFT_METADATA_URI =
  process.env.EXPO_PUBLIC_NFT_METADATA_URI ||
  'https://raw.githubusercontent.com/yash2k26/NomiApp/main/assets/nft-metadata.json';
export const NFT_SYMBOL = 'OPET';
// Optional verified-collection support. When this env is set, every new mint
// declares `collection: { key, verified: false }` in its metadata so wallets
// group it; the collection's update authority can then run verify_collection
// in a follow-up tx to flip verified=true.
const NFT_COLLECTION_MINT = process.env.EXPO_PUBLIC_NFT_COLLECTION_MINT || '';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Mint price paid by the user to the project treasury (in SOL).
// On-chain rent + network fees are additional (~0.01 SOL).
export const MINT_PRICE_SOL = 0.15;

export interface MintResult {
  mintAddress: string;
  txSignature: string;
}

export interface PetAttributes {
  ownerName?: string;
  level?: number;
  stage?: number;
  streak?: number;
}

export async function mintPetNFT(
  authToken: string,
  petName: string,
  attributes?: PetAttributes,
): Promise<MintResult> {
  console.log('[nftMint] ========== mintPetNFT START ==========');

  const mintKeypair = Keypair.generate();
  const mintPubkey = mintKeypair.publicKey;
  console.log('[nftMint] mint pubkey:', mintPubkey.toBase58());

  // ── Phase 1: RPC calls OUTSIDE wallet session ──
  // Only rent gets pre-fetched here. Blockhash is intentionally deferred to
  // inside the wallet session (right before signing) — the wallet prompt can
  // take 5-30s on Phantom/Seeker, and if we used a blockhash from before the
  // prompt opened, it would be near-expired by the time the user approves,
  // making the signed tx dead on arrival when we submit. Refetching at sign
  // time gives us the freshest possible blockhash window.
  console.log('[nftMint] Phase 1: Fetching rent...');
  const mintRent = await getMinimumBalanceForRentExemption(MINT_SIZE);
  console.log('[nftMint] Phase 1 done — rent:', mintRent);

  // ── Phase 2: Open wallet ONLY for signing, then close it ──
  console.log('[nftMint] Phase 2: Wallet session for signing...');
  let blockhash = '';
  let lastValidBlockHeight = 0;
  const serializedTx = await withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const tokenAccount = getAssociatedTokenAddressSync(mintPubkey, payer);
    console.log('[nftMint] payer:', address, 'ATA:', tokenAccount.toBase58());

    // Use the canonical metadata URI directly. Per-NFT query strings make each
    // mint have a unique URI, which prevents Phantom/Helius from caching the
    // resolved metadata + image and causes random "Unknown" placeholders. The
    // GitHub-hosted JSON is static anyway — query params do nothing there.
    const metadataUri = NFT_METADATA_URI;
    void attributes; // accepted for API stability, no longer used in URI

    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );
    const [masterEditionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer(), Buffer.from('edition')],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const tx = new Transaction();

    // Priority fee — small ComputeBudget instruction so the mint lands
    // reliably during congestion. Cost is negligible (~5000 lamports total)
    // vs the 0.15 SOL mint fee. Skipped silently if RPC can't tell us the
    // current median.
    try {
      const microLamports = await getPriorityFeeMicroLamports();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
    } catch {}

    // 0. Mint fee — 0.15 SOL to project treasury
    tx.add(SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(SHOP_TREASURY),
      lamports: Math.round(MINT_PRICE_SOL * LAMPORTS_PER_SOL),
    }));

    // 1. Create mint account
    tx.add(SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintPubkey,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    }));

    // 2. Initialize mint
    tx.add(createInitializeMint2Instruction(mintPubkey, 0, payer, payer));

    // 3. Create ATA
    tx.add(createAssociatedTokenAccountInstruction(payer, tokenAccount, payer, mintPubkey));

    // 4. Mint 1 token
    tx.add(createMintToInstruction(mintPubkey, tokenAccount, payer, 1));

    // 5. Create metadata
    // URI cap dropped 200 → 150 to leave more headroom under the 1232-byte
    // legacy-tx limit now that the mint memo is part of the same tx.
    const collection = NFT_COLLECTION_MINT
      ? { key: new PublicKey(NFT_COLLECTION_MINT), verified: false }
      : null;
    tx.add(createCreateMetadataAccountV3Instruction(
      { metadata: metadataPda, mint: mintPubkey, mintAuthority: payer, payer, updateAuthority: payer },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: petName.slice(0, 32),
            symbol: NFT_SYMBOL,
            uri: metadataUri.slice(0, 150),
            sellerFeeBasisPoints: 0,
            creators: null,
            collection,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      },
    ));

    // 6. Create master edition
    tx.add(createCreateMasterEditionV3Instruction(
      { edition: masterEditionPda, mint: mintPubkey, updateAuthority: payer, mintAuthority: payer, payer, metadata: metadataPda },
      { createMasterEditionArgs: { maxSupply: 0 } },
    ));

    // 7. oracle-pet:mint memo — folded INTO the mint tx so it's atomic with
    // the mint (no second wallet prompt, no orphan-memo case if the user
    // denies the second sign). Restore reads { mintAddress, name, ownerName }
    // from the JSON payload; txSignature isn't included because we can't know
    // it pre-sign, and restore falls back to the signature of the memo-
    // containing tx, which IS this same mint tx.
    const ownerName = (attributes?.ownerName ?? '').slice(0, 32);
    const memoPayload = JSON.stringify({
      mintAddress: mintPubkey.toBase58(),
      name: petName.slice(0, 32),
      ownerName,
    });
    tx.add(new TransactionInstruction({
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`oracle-pet:mint|${memoPayload}`, 'utf-8'),
    }));

    tx.feePayer = payer;
    // Refetch blockhash RIGHT before signing so the validity window is
    // maximally fresh when the wallet hands the signed tx back.
    const fresh = await getLatestBlockhash();
    blockhash = fresh.blockhash;
    lastValidBlockHeight = fresh.lastValidBlockHeight;
    tx.recentBlockhash = blockhash;
    tx.partialSign(mintKeypair);

    console.log('[nftMint] tx size:', tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length, 'bytes');
    console.log('[nftMint] Signing with wallet (blockhash:', blockhash.slice(0, 12), '...)');

    // Simulate BEFORE the wallet prompt — catches doomed mints (rent
    // shortfall, blockhash already too old, account ownership wrong, etc.)
    // before we ask the user to sign and burn gas on a guaranteed failure.
    await simulateTransactionRaw(tx);

    const signedTxs = await wallet.signTransactions({ transactions: [tx] });
    const serialized = signedTxs[0].serialize();
    console.log('[nftMint] Signed! Serialized size:', serialized.length, 'bytes');

    // Return the serialized bytes — do NOT send from inside the wallet session
    return serialized;
  });

  // ── Phase 3: Send + confirm OUTSIDE wallet session (MWA closed) ──
  console.log('[nftMint] Phase 3: Sending transaction (wallet session closed)...');
  const txSig = await sendTransaction(serializedTx);
  console.log('[nftMint] Sent! signature:', txSig);

  console.log('[nftMint] Confirming...');
  await confirmTransaction(txSig, blockhash, lastValidBlockHeight);
  console.log('[nftMint] ========== mintPetNFT SUCCESS ==========');

  // Fire-and-forget: also await finalization so the audit log can confirm
  // there was no reorg-rollback of the mint. UI doesn't wait.
  try {
    const { awaitFinalizedRaw } = require('./solanaClient');
    awaitFinalizedRaw(txSig).then(() => {
      console.log('[nftMint] finalized:', txSig);
    }).catch((e: any) => {
      console.warn('[nftMint] mint did not finalize within timeout:', e?.message);
    });
  } catch {}

  return {
    mintAddress: mintPubkey.toBase58(),
    txSignature: txSig,
  };
}