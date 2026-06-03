# Nomi State Backup Worker

Per-wallet game-state backup so users don't lose XP/streak/coins/freezes/shards/etc. on reinstall, wallet disconnect, or device swap.

What's stored: anything that's local-only on device today (and would otherwise be wiped). What's NOT stored: pet mint address, owned shop items, premium tier — those are owned by chain and recovered via on-chain memos / NFT holdings scan.

## One-time deploy

```bash
cd workers/state
npm install
npx wrangler login

# Create the D1 database. Wrangler prints a database_id — paste into wrangler.toml.
npx wrangler d1 create nomi-state

# Apply schema migration to remote DB
npx wrangler d1 migrations apply nomi-state --remote

# Deploy
npx wrangler deploy
```

Wrangler prints a URL like `https://nomi-state.<your-subdomain>.workers.dev`. Paste into the app's `.env`:

```
EXPO_PUBLIC_STATE_API_URL=https://nomi-state.<your-subdomain>.workers.dev
```

Rebuild the dev client (`npx expo run:android`) so the env var inlines.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/sync` | `{ wallet, state, version }` | `{ ok, version, updated_at }` or `409 { currentVersion }` if `version` is stale |
| `GET` | `/state?wallet=...` | — | `{ state, version, updated_at }` or `404` |
| `POST` | `/unregister` | `{ wallet }` | `{ ok }` (drops the row — used on wallet disconnect) |

State payload is whatever JSON shape the client sends. Worker doesn't validate it — schema lives client-side.

## Conflict resolution

- Client increments `version` on each push (single counter per device).
- Server accepts a sync only if `incoming.version > stored.version`.
- On 409 the client should pull the server's state, merge or last-write-wins client-side, then re-push with `serverVersion + 1`.
- Single-device users will never hit 409. Multi-device users get last-write-wins by version.

## Cost

| Active users | Sync writes/day | D1 writes/day | Monthly $ |
|---|---|---|---|
| 100 | ~200 | ~200 | $0 (free) |
| 10K | ~20K | ~20K | $0 (free, 100K/day cap) |
| 100K | ~200K | ~200K | $5 (paid D1) |

Reads are cheaper — pulls happen once per wallet connect (~few/day per user).

## Privacy

Stored data is keyed by wallet address (already a public identifier on Solana). No PII collected. State payload contains game progress only — no personal info beyond what the user types as their pet/owner names.

To delete a user's data: `POST /unregister` with their wallet address. Client triggers this on `disconnectWallet()`.

## Testing locally

```bash
npx wrangler dev
```

Use `EXPO_PUBLIC_STATE_API_URL=http://10.0.2.2:8787` (Android emulator) or your laptop's LAN IP for device testing.

## Tail logs

```bash
npx wrangler tail
```

Streams every request — handy for debugging "why did sync fail".
