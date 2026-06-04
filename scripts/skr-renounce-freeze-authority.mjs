#!/usr/bin/env node
/*
 * SKR freeze-authority renounce — one-time deployment helper.
 *
 * Solves Finding 6.2 from the audit: an SPL token with an active freeze
 * authority can have any holder's account frozen by whoever holds the key.
 * Exchanges and sophisticated users flag this as centralization risk and
 * may refuse to list. Renounce it permanently so no one can freeze SKR
 * holdings — including us.
 *
 * Usage:
 *
 *   node scripts/skr-renounce-freeze-authority.mjs \
 *     --keypair /path/to/current-freeze-authority-keypair.json \
 *     [--rpc <url>] [--confirm]
 *
 * Safety:
 *   • Dry-run by default. Pass --confirm to actually broadcast.
 *   • Verifies the keypair matches the on-chain freeze authority first.
 *   • Permanent: once renounced, freeze can never be re-enabled.
 *
 * If you NEED freeze for compliance reasons, DO NOT run this — instead,
 * document the active freeze authority publicly (pinned post + README)
 * and disclose who holds the key. Most token holders accept that
 * trade-off when explained.
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
  const args = {};
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
  if (!args.keypair) {
    console.error('Usage: node scripts/skr-renounce-freeze-authority.mjs --keypair <path> [--rpc <url>] [--confirm]');
    exit(1);
  }

  const rpcUrl = args.rpc || process.env.HELIUS_RPC_URL || DEFAULT_RPC;
  const conn = new Connection(rpcUrl, 'confirmed');
  const current = loadKeypair(args.keypair);

  const mintInfo = await getMint(conn, SKR_MINT, 'confirmed', TOKEN_PROGRAM_ID);
  const currentFreezeAuthority = mintInfo.freezeAuthority?.toBase58() ?? null;

  console.log('');
  console.log('SKR freeze authority renounce');
  console.log('─────────────────────────────────');
  console.log('RPC:                  ', rpcUrl);
  console.log('SKR mint:             ', SKR_MINT.toBase58());
  console.log('Current freeze auth:  ', currentFreezeAuthority ?? '(already renounced)');
  console.log('Your keypair:         ', current.publicKey.toBase58());
  console.log('');

  if (currentFreezeAuthority === null) {
    console.log('Freeze authority is already null. Nothing to do.');
    exit(0);
  }
  if (currentFreezeAuthority !== current.publicKey.toBase58()) {
    console.error('ERROR: --keypair does not match the current on-chain freeze authority.');
    console.error('Current on-chain:', currentFreezeAuthority);
    console.error('Your keypair:    ', current.publicKey.toBase58());
    exit(2);
  }

  if (!args.confirm) {
    console.log('Dry run. Re-run with --confirm to broadcast.');
    exit(0);
  }

  const finalConfirm = await ask(
    'PERMANENT: this will renounce the freeze authority forever. No SKR account can ever be frozen. Type RENOUNCE to proceed: ',
  );
  if (finalConfirm.trim() !== 'RENOUNCE') {
    console.log('Aborted.');
    exit(0);
  }

  const tx = new Transaction().add(
    createSetAuthorityInstruction(
      SKR_MINT,
      current.publicKey,
      AuthorityType.FreezeAccount,
      null, // null = renounce
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
  console.log('Freeze authority on mint: (renounced — null)');
}

main().catch((err) => {
  console.error('FAILED:', err.message ?? err);
  exit(99);
});
