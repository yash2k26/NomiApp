import { Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
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
import { getLatestBlockhashRaw, getMinimumBalanceForRentExemptionRaw, sendRawTransactionRaw, confirmTransactionRaw } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

const NFT_METADATA_URI = 'https://raw.githubusercontent.com/yash2k26/NomiApp/main/assets/nft-metadata.json';

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
  const mintKeypair = Keypair.generate();
  const mintPubkey = mintKeypair.publicKey;

  // ── Phase 1: RPC calls OUTSIDE wallet session (avoid MWA timeout) ──
  const [{ blockhash, lastValidBlockHeight }, mintRent] = await Promise.all([
    getLatestBlockhashRaw(),
    getMinimumBalanceForRentExemptionRaw(MINT_SIZE),
  ]);

  // ── Phase 2: Open wallet only for address + signing ──
  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const tokenAccount = getAssociatedTokenAddressSync(mintPubkey, payer);

    // Build metadata URI with pet attributes
    let metadataUri = NFT_METADATA_URI;
    if (attributes) {
      const params: string[] = [];
      if (attributes.ownerName) params.push(`owner=${encodeURIComponent(attributes.ownerName)}`);
      if (attributes.level) params.push(`level=${attributes.level}`);
      if (attributes.stage) params.push(`stage=${attributes.stage}`);
      if (attributes.streak) params.push(`streak=${attributes.streak}`);
      params.push(`mint=${mintPubkey.toBase58().slice(0, 8)}`);
      if (params.length > 0) metadataUri = `${NFT_METADATA_URI}?${params.join('&')}`;
    }

    // Find PDAs
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );
    const [masterEditionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer(), Buffer.from('edition')],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const tx = new Transaction();

    // 1. Create mint account
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintPubkey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
    );

    // 2. Initialize mint (decimals=0, authority=payer) — uses InitializeMint2 (no rent sysvar needed)
    tx.add(
      createInitializeMint2Instruction(mintPubkey, 0, payer, payer),
    );

    // 3. Create associated token account
    tx.add(
      createAssociatedTokenAccountInstruction(payer, tokenAccount, payer, mintPubkey),
    );

    // 4. Mint 1 token
    tx.add(
      createMintToInstruction(mintPubkey, tokenAccount, payer, 1),
    );

    // 5. Create metadata account (Metaplex)
    tx.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPda,
          mint: mintPubkey,
          mintAuthority: payer,
          payer: payer,
          updateAuthority: payer,
        },
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
      ),
    );

    // 6. Create master edition (makes it a 1/1 NFT)
    tx.add(
      createCreateMasterEditionV3Instruction(
        {
          edition: masterEditionPda,
          mint: mintPubkey,
          updateAuthority: payer,
          mintAuthority: payer,
          payer: payer,
          metadata: metadataPda,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0,
          },
        },
      ),
    );

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    // Partial sign with mint keypair
    tx.partialSign(mintKeypair);

    // Sign with wallet via MWA
    const signedTxs = await wallet.signTransactions({ transactions: [tx] });

    // ── Phase 3: Send + confirm ──
    const serialized = signedTxs[0].serialize();
    let txSig: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        txSig = await sendRawTransactionRaw(serialized);
        break;
      } catch (err: any) {
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    if (!txSig) throw new Error('Failed to send transaction after retries');

    await confirmTransactionRaw(txSig, blockhash, lastValidBlockHeight);

    return {
      mintAddress: mintPubkey.toBase58(),
      txSignature: txSig,
    };
  });
}
