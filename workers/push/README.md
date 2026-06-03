# Nomi Push Worker

Real server-side push notifications. Sends "your Nomi misses you" 18-25 hours after a user's last app open, even if the OS killed the app. Uses Expo Push API (free, abstracts FCM/APNs).

## One-time deploy

```bash
cd workers/push
npm install
npx wrangler login

# Create the D1 database. Wrangler prints a database_id — paste into wrangler.toml.
npx wrangler d1 create nomi-push

# Apply schema migration to remote DB
npx wrangler d1 migrations apply nomi-push --remote

# Deploy
npx wrangler deploy
```

Wrangler prints a URL like `https://nomi-push.<your-subdomain>.workers.dev`. Paste into the app's `.env`:

```
EXPO_PUBLIC_PUSH_API_URL=https://nomi-push.<your-subdomain>.workers.dev
```

Rebuild the dev client (`npx expo run:android`) so the env var inlines.

## How it works

1. App requests permission (existing flow).
2. After grant, app calls `POST /register { push_token, wallet, pet_name, owner_name }` with the Expo push token. Worker upserts into `devices` table.
3. On every app foreground transition, app calls `POST /heartbeat { push_token, wallet, hunger, happiness, energy, level, streak_days }`. Worker updates `last_active_at` + the most recent stat snapshot for personalized copy.
4. Every hour, the cron handler runs:
   - Find devices where `last_active_at` was 18-25 hours ago AND `last_push_at` was >22h ago
   - Build a personality-aware message ("X is hungry", "Don't break the 12-day streak", etc.)
   - Batch-send via `https://exp.host/--/api/v2/push/send`
   - Mark `last_push_at`. Drop tokens that come back `DeviceNotRegistered`.

## Cost

| Active users | Worker invocations | D1 reads/day | Push sends/day | Monthly $ |
|---|---|---|---|---|
| 100 | ~720 | ~3K | ~80 | $0 (free tier) |
| 10K | ~720 | ~300K | ~8K | $0 |
| 100K | ~720 | ~3M | ~80K | $5 D1 paid |

Expo Push API is free regardless of volume. The bottleneck is D1 reads — free tier is 5M/day.

## Observability

```bash
npx wrangler tail   # streams worker logs in real time
```

Each cron run logs how many devices it pinged. If something is off, look here first.

## Testing locally

```bash
npx wrangler dev
```

Use `EXPO_PUBLIC_PUSH_API_URL=http://10.0.2.2:8787` (Android emulator) or your laptop's LAN IP for device testing. The cron won't fire in dev mode — invoke it manually:

```bash
curl -X POST http://localhost:8787/__scheduled?cron=0+*+*+*+*
```

## Tuning the push window

Constants at the top of `src/index.ts`:

- `RETURN_PUSH_MIN_HOURS = 18`  (don't push earlier than this)
- `RETURN_PUSH_MAX_HOURS = 25`  (don't push later — the window is closed)
- `MIN_PUSH_INTERVAL_MS = 22 hours` (per-device cooldown)
- `BATCH_SIZE = 100` per cron tick (raise as user base grows)
