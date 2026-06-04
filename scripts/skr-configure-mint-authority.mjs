#!/usr/bin/env node
/*
 * SKR mint-authority configuration — one-time deployment helper.
 *
 * Solves Finding 6.1 from the audit: the SKR mint authority must NOT be
 * a hot key. Either renounce it (if no future emissions are planned) or
 * transfer it to a multisig (Squads is the Solana de-facto standard).
 *
 * Usage:
 *
 *   # Renounce mint authority permanently (no future SKR can be minted ever)
 *   node scripts/skr-configure-mint-authority.mjs renounce \
 *     --keypair /path/to/current-authority-keypair.json
 *
 *   # Transfer mint authority to a Squads multisig (or hardware wallet)
 *   node scripts/skr-configure-mint-authority.mjs transfer \
 *     --keypair /path/to/current-authority-keypair.json \
 *     --to <NEW_AUTHORITY_BASE58>
 *
 *   # Override RPC (defaults to mainnet public; use Helius for reliability)
 *   ... --rpc https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
 *
 * Safety:
 *   • Dry-run by default. Pass --confirm to actually broadcast.
 *   • Prints a summary diff before broadcasting.
 *   • Never writes the new authority keypair to disk.
 *
 * Pre-flight: ensure the current authority keypair has enough SOL to pay
 * the tx fee (~0.00001 SOL).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit } from 'node:process';
import { createInterface } from 'node:readline';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createSetAuthorityInstruction,
  AuthorityType,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const SKR_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

function parseArgs() {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadKeypair(path) {
  const abs = resolve(path);
  const raw = readFileSync(abs, 'utf8');
  const bytes = JSON.parse(raw);
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error(`${abs}: expected a 64-byte secret-key JSON array`);
  }
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
}

async function main() {
  const args = parseArgs();
  const sub = args._[0];

  if (!sub || (sub !== 'renounce' && sub !== 'transfer')) {
    console.error('Usage:');
    console.error('  node scripts/skr-configure-mint-authority.mjs renounce --keypair <path> [--confirm]');
    console.error('  node scripts/skr-configure-mint-authority.mjs transfer --keypair <path> --to <pubkey> [--confirm]');
    exit(1);
  }

  if (!args.keypair) { console.error('Missing --keypair <path>'); exit(1); }
  if (sub === 'transfer' && !args.to) { console.error('Missing --to <new-authority-base58>'); exit(1); }

  const rpcUrl = args.rpc || process.env.HELIUS_RPC_URL || DEFAULT_RPC;
  const conn = new Connection(rpcUrl, 'confirmed');
  const current = loadKeypair(args.keypair);

  // Pre-flight: confirm the keypair actually holds mint authority right now.
  const mintInfo = await getMint(conn, SKR_MINT, 'confirmed', TOKEN_PROGRAM_ID);
  const currentMintAuthority = mintInfo.mintAuthority?.toBase58() ?? null;

  console.log('');
  console.log('SKR mint authority configuration');
  console.log('─────────────────────────────────');
  console.log('RPC:                ', rpcUrl);
  console.log('SKR mint:           ', SKR_MINT.toBase58());
  console.log('Current authority:  ', currentMintAuthority ?? '(already renounced)');
  console.log('Your keypair:       ', current.publicKey.toBase58());
  console.log('Action:             ', sub);
  if (sub === 'transfer') console.log('New authority:      ', args.to);
  console.log('');

  if (currentMintAuthority === null) {
    console.log('Mint authority is already null. Nothing to do.');
    exit(0);
  }
  if (currentMintAuthority !== current.publicKey.toBase58()) {
    console.error('ERROR: --keypair does not match the current on-chain mint authority.');
    console.error('Current on-chain:', currentMintAuthority);
    console.error('Your keypair:    ', current.publicKey.toBase58());
    exit(2);
  }

  let newAuthority = null;
  if (sub === 'transfer') {
    try {
      newAuthority = new PublicKey(args.to);
    } catch {
      console.error('ERROR: --to is not a valid base58 pubkey:', args.to);
      exit(3);
    }
  }

  if (!args.confirm) {
    console.log('Dry run. Re-run with --confirm to broadcast.');
    exit(0);
  }

  const finalConfirm = await ask(
    sub === 'renounce'
      ? 'PERMANENT: this will renounce the mint authority forever. No more SKR will ever be mintable. Type RENOUNCE to proceed: '
      : `Transfer mint authority to ${args.to}? Type TRANSFER to proceed: `,
  );
  const expected = sub === 'renounce' ? 'RENOUNCE' : 'TRANSFER';
  if (finalConfirm.trim() !== expected) {
    console.log('Aborted.');
    exit(0);
  }

  const tx = new Transaction().add(
    createSetAuthorityInstruction(
      SKR_MINT,
      current.publicKey,
      AuthorityType.MintTokens,
      newAuthority, // null = renounce
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  console.log('Broadcasting…');
  const sig = await sendAndConfirmTransaction(conn, tx, [current], {
    commitment: 'confirmed',
    skipPreflight: false,
  });

  console.log('');
  console.log('✅ Done. Signature:', sig);
  console.log('Verify:        https://solscan.io/tx/' + sig);
  console.log('New authority on mint:', newAuthority?.toBase58() ?? '(renounced)');
}

main().catch((err) => {
  console.error('FAILED:', err.message ?? err);
  exit(99);
});
