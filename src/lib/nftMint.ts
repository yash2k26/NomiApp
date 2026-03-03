import { Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { connection } from './solanaClient';
import { withWallet } from './mobileWalletAdapter';

// NFT metadata URI — host this JSON on nft.storage, GitHub Pages, or any public URL
// Update this with your actual metadata URI before demo
const NFT_METADATA_URI = 'https://raw.githubusercontent.com/yash-dev/oracle-pet/main/assets/nft-metadata.json';

// Token Metadata Program (Metaplex)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
// SPL Token Program
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
// Associated Token Account Program
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
// System Rent Sysvar
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

export interface MintResult {
  mintAddress: string;
  txSignature: string;
}

function findMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

function findMasterEditionPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from('edition')],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return pda;
}

/**
 * Mint a pet as a real NFT on Solana devnet.
 * Uses raw instructions (no Metaplex SDK import) to avoid polyfill issues.
 */
export async function mintPetNFT(
  authToken: string,
  petName: string,
): Promise<MintResult> {
  const mintKeypair = Keypair.generate();

  return withWallet(authToken, async (wallet, address) => {
    const payer = new PublicKey(address);
    const mintPubkey = mintKeypair.publicKey;
    const metadataPda = findMetadataPda(mintPubkey);
    const masterEditionPda = findMasterEditionPda(mintPubkey);
    const tokenAccount = findAssociatedTokenAddress(payer, mintPubkey);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Get minimum rent for mint account (82 bytes for SPL Token mint)
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

    // 2. Initialize mint (decimals=0, mintAuthority=payer)
    tx.add({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([
        0, // InitializeMint instruction
        0, // decimals = 0 (NFT)
        ...payer.toBytes(), // mintAuthority
        1, // has freezeAuthority
        ...payer.toBytes(), // freezeAuthority
      ]),
    });

    // 3. Create associated token account
    tx.add({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: false, isWritable: false },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.alloc(0),
    });

    // 4. Mint 1 token to the associated token account
    tx.add({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false },
      ],
      data: Buffer.from([
        7, // MintTo instruction
        1, 0, 0, 0, 0, 0, 0, 0, // amount = 1 (u64 LE)
      ]),
    });

    // 5. Create metadata account (Metaplex Token Metadata v1 CreateMetadataAccountV3)
    const nameBytes = Buffer.from(petName.padEnd(32, '\0').slice(0, 32));
    const symbolBytes = Buffer.from('OPET'.padEnd(10, '\0').slice(0, 10));
    const uriBytes = Buffer.from(NFT_METADATA_URI.padEnd(200, '\0').slice(0, 200));

    // CreateMetadataAccountV3 = instruction discriminator 33
    const metadataData = Buffer.concat([
      Buffer.from([33]), // CreateMetadataAccountV3
      // Data:
      Buffer.from([nameBytes.length, 0, 0, 0]), ...[ nameBytes ], // name (borsh string)
      Buffer.from([symbolBytes.length, 0, 0, 0]), ...[ symbolBytes ], // symbol
      Buffer.from([uriBytes.length, 0, 0, 0]), ...[ uriBytes ], // uri
      Buffer.from([0, 0]), // sellerFeeBasisPoints = 0
      Buffer.from([0]), // no creators (Option<Vec<Creator>> = None)
      Buffer.from([0]), // no collection (Option<Collection> = None)
      Buffer.from([0]), // no uses (Option<Uses> = None)
      Buffer.from([1]), // isMutable = true
      Buffer.from([0]), // collectionDetails = None
    ]);

    tx.add({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: false }, // mintAuthority
        { pubkey: payer, isSigner: true, isWritable: true }, // payer
        { pubkey: payer, isSigner: false, isWritable: false }, // updateAuthority
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: metadataData,
    });

    // 6. Create Master Edition (makes it a 1/1 NFT)
    tx.add({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
        { pubkey: masterEditionPda, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false }, // updateAuthority
        { pubkey: payer, isSigner: true, isWritable: false }, // mintAuthority
        { pubkey: payer, isSigner: true, isWritable: true }, // payer
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([
        17, // CreateMasterEditionV3
        1, // has maxSupply
        0, 0, 0, 0, 0, 0, 0, 0, // maxSupply = 0 (means 1/1 NFT, no prints)
      ]),
    });

    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    // Partial sign with mint keypair
    tx.partialSign(mintKeypair);

    // Sign with wallet via MWA
    const signedTxs = await wallet.signTransactions({ transactions: [tx] });

    const txSig = await connection.sendRawTransaction(signedTxs[0].serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    return {
      mintAddress: mintPubkey.toBase58(),
      txSignature: txSig,
    };
  });
}
