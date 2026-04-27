import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
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
import { SHOP_TREASURY } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

const NFT_METADATA_URI = 'https://raw.githubusercontent.com/yash2k26/NomiApp/main/assets/nft-metadata.json';

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
  console.log('[nftMint] Phase 1: Fetching blockhash + rent...');
  const [blockhashResult, mintRent] = await Promise.all([
    getLatestBlockhash(),
    getMinimumBalanceForRentExemption(MINT_SIZE),
  ]);
  const { blockhash, lastValidBlockHeight } = blockhashResult;
  console.log('[nftMint] Phase 1 done — blockhash:', blockhash, 'rent:', mintRent);

  // ── Phase 2: Open wallet ONLY for signing, then close it ──
  console.log('[nftMint] Phase 2: Wallet session for signing...');
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
    tx.add(createCreateMetadataAccountV3Instruction(
      { metadata: metadataPda, mint: mintPubkey, mintAuthority: payer, payer, updateAuthority: payer },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: petName.slice(0, 32),
            symbol: 'OPET',
            uri: metadataUri.slice(0, 200),
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
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

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;
    tx.partialSign(mintKeypair);

    console.log('[nftMint] tx size:', tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length, 'bytes');
    console.log('[nftMint] Signing with wallet...');

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

  return {
    mintAddress: mintPubkey.toBase58(),
    txSignature: txSig,
  };
}