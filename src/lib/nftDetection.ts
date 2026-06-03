import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { connection, getAccountInfoRaw } from './solanaClient';
import { NFT_METADATA_URI, NFT_SYMBOL } from './nftMint';

// Defensive URI matching for Nomi NFT detection.
//
// The canonical URI is the GitHub-raw URL of the metadata JSON. But real
// minted NFTs have shown several variations that strict equality rejected:
//   - Query strings appended ("?owner=X&level=Y") — Gary's case
//   - Trailing whitespace / null bytes from Metaplex padding
//   - Trailing slash
//   - http vs https mismatch (unlikely but cheap to handle)
// Each variation is a Nomi we minted ourselves. Detection that rejects them
// is a bug. This normalizer accepts all of the above.
function uriMatchesNomi(uri: string | undefined | null): boolean {
  if (!uri) return false;
  // 1. Trim null-byte padding (Metaplex raw bytes), whitespace
  // 2. Drop query string and fragment
  // 3. Normalize trailing slash
  // 4. Normalize protocol (http -> https)
  const cleaned = uri
    .replace(/\0+/g, '')
    .trim()
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '')
    .replace(/^http:\/\//, 'https://');
  return cleaned === NFT_METADATA_URI;
}

// Same defensive treatment for symbol comparison. Real NFTs have shown:
//   - Null-byte padding from Metaplex
//   - Trailing whitespace
//   - Case differences (defensive — none seen but cheap to handle)
function symbolMatchesNomi(symbol: string | undefined | null): boolean {
  if (!symbol) return false;
  return symbol.replace(/\0+/g, '').trim().toUpperCase() === NFT_SYMBOL.toUpperCase();
}

/*
 * On-chain Nomi NFT detection.
 *
 * Restore via memo only catches NFTs minted with the recent oracle-pet:mint
 * memo write. Older mints (and any future mint that fails to write its memo
 * for whatever reason) are invisible to memo-based restore — the user lands
 * on MintScreen even though they own a Nomi NFT.
 *
 * This module finds the user's Nomi NFT by scanning their actual on-chain
 * holdings for the unique markers: symbol="OPET" + a specific metadata URI.
 *
 * Two paths in priority order:
 *   1. Helius DAS getAssetsByOwner — single fast RPC call. Requires
 *      EXPO_PUBLIC_HELIUS_API_KEY.
 *   2. Fallback: enumerate SPL token accounts → derive Metaplex metadata PDAs
 *      → fetch + parse symbol/URI. Slower (one RPC per token account) but
 *      works without Helius.
 *
 * Both return null on no match or any error — never throw.
 */

export interface DetectedNomiNft {
  mintAddress: string;
  name: string;
}

// Bumped from 8s → 20s after real users on slow networks reported
// "can't restore from chain". The holdings scan IS finding their NFTs
// when given enough time; the old 8s was too aggressive for cellular
// networks + heavily-used wallets with hundreds of token accounts.
const HELIUS_TIMEOUT_MS = 20000;
// Bumped from 25 → 60 so heavy wallets (lots of NFTs) actually finish
// scanning before the function gives up. RPC fallback is still bounded —
// just not as aggressively.
const FALLBACK_MAX_CANDIDATES = 60;

export async function detectNomiNftHolding(walletAddress: string): Promise<DetectedNomiNft | null> {
  if (!walletAddress) return null;

  console.log('[nftDetection] scanning wallet:', walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4));

  const heliusKey = process.env.EXPO_PUBLIC_HELIUS_API_KEY;
  if (heliusKey) {
    const found = await detectViaHelius(walletAddress, heliusKey);
    if (found) {
      console.log('[nftDetection] found via Helius:', found.mintAddress);
      return found;
    }
    console.log('[nftDetection] Helius path returned no match — falling through to RPC');
  } else {
    console.log('[nftDetection] no Helius key, using RPC fallback');
  }

  const fallback = await detectViaRpcFallback(walletAddress);
  if (fallback) {
    console.log('[nftDetection] found via RPC fallback:', fallback.mintAddress);
  } else {
    console.log('[nftDetection] no Nomi NFT found in this wallet (scanned all paths)');
  }
  return fallback;
}

// ── Helius DAS path ───────────────────────────────────────────────────────

interface HeliusAsset {
  id: string; // mint address
  content?: {
    json_uri?: string;
    metadata?: {
      name?: string;
      symbol?: string;
    };
  };
}

async function detectViaHelius(walletAddress: string, apiKey: string): Promise<DetectedNomiNft | null> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HELIUS_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'nomi-detect',
        method: 'getAssetsByOwner',
        params: { ownerAddress: walletAddress, page: 1, limit: 200 },
      }),
    });

    if (!res.ok) {
      console.warn('[nftDetection] Helius DAS HTTP', res.status);
      return null;
    }

    const data = (await res.json()) as { result?: { items?: HeliusAsset[] } };
    const items = data.result?.items ?? [];

    // Filter for our markers — both must match to reject "OPET"-symbol fakes.
    // URI + symbol both go through defensive matchers (handle null bytes,
    // query strings, padding, case, protocol drift).
    const candidates = items.filter((asset) => {
      const meta = asset.content?.metadata;
      const uri = asset.content?.json_uri;
      return symbolMatchesNomi(meta?.symbol) && uriMatchesNomi(uri);
    });

    if (candidates.length === 0) return null;

    // Helius doesn't sort by mint time reliably; first match is fine since the
    // user only "should" own one Nomi pet. Multi-mint edge case picks any.
    const winner = candidates[0];
    return {
      mintAddress: winner.id,
      name: winner.content?.metadata?.name ?? 'Nomi',
    };
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[nftDetection] Helius DAS error:', err?.message ?? err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── RPC fallback path ─────────────────────────────────────────────────────

async function detectViaRpcFallback(walletAddress: string): Promise<DetectedNomiNft | null> {
  try {
    const owner = new PublicKey(walletAddress);
    const result = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
    const accounts = result.value;

    // NFT pattern: amount = "1" string, decimals = 0.
    const candidateMints: string[] = [];
    for (const { account } of accounts) {
      const info: any = account.data?.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      if (!tokenAmount) continue;
      if (tokenAmount.decimals === 0 && tokenAmount.amount === '1' && info.mint) {
        candidateMints.push(info.mint as string);
        if (candidateMints.length >= FALLBACK_MAX_CANDIDATES) break;
      }
    }

    for (const mint of candidateMints) {
      const found = await checkMintForNomiMarkers(mint);
      if (found) return found;
    }
    return null;
  } catch (err: any) {
    console.warn('[nftDetection] RPC fallback error:', err?.message ?? err);
    return null;
  }
}

async function checkMintForNomiMarkers(mintAddress: string): Promise<DetectedNomiNft | null> {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );
    const accountInfo = await getAccountInfoRaw(metadataPda);
    if (!accountInfo?.data) return null;

    const parsed = parseMetadataAccountData(accountInfo.data);
    if (!parsed) return null;
    if (!symbolMatchesNomi(parsed.symbol)) return null;
    if (!uriMatchesNomi(parsed.uri)) return null;

    return { mintAddress, name: parsed.name || 'Nomi' };
  } catch {
    return null;
  }
}

/**
 * Parse the Metaplex Token Metadata v1 account layout. We only need the
 * first three string fields (name, symbol, uri); skip authority/mint headers
 * and ignore everything past the URI.
 *
 * Layout (see metaplex-foundation/mpl-token-metadata):
 *   key: u8                 (1)
 *   updateAuthority: Pubkey (32)
 *   mint: Pubkey            (32)
 *   data:
 *     name: String   (4-byte LE length + utf-8 bytes)
 *     symbol: String (same)
 *     uri: String    (same)
 *     ... (sellerFeeBasisPoints, creators, etc. — ignored)
 *
 * Strings are fixed-padded with null bytes in the on-chain layout; we trim
 * those off after decode.
 */
function parseMetadataAccountData(data: Buffer | Uint8Array): { name: string; symbol: string; uri: string } | null {
  try {
    const buf = Buffer.from(data);
    let offset = 1 + 32 + 32; // key + updateAuthority + mint

    const readString = (): string => {
      const len = buf.readUInt32LE(offset);
      offset += 4;
      const slice = buf.subarray(offset, offset + len);
      offset += len;
      // Strip null padding
      return slice.toString('utf-8').replace(/\0+$/, '').trim();
    };

    const name = readString();
    const symbol = readString();
    const uri = readString();
    return { name, symbol, uri };
  } catch (err: any) {
    console.warn('[nftDetection] metadata parse error:', err?.message ?? err);
    return null;
  }
}
