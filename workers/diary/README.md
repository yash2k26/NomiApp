# Nomi Diary Worker

Cloudflare Worker that proxies the Anthropic API. The mobile app cannot hold the API key directly — anyone with the APK can extract bundled `EXPO_PUBLIC_*` env vars. This worker is the security boundary.

## One-time setup

```bash
cd workers/diary
npm install
npx wrangler login
```

Get an Anthropic API key at https://console.anthropic.com (cheapest plan is fine — Haiku is ~$0.001 per diary entry).

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# paste your sk-ant-... key when prompted
```

## Deploy

```bash
npx wrangler deploy
```

Wrangler will print a URL like `https://nomi-diary.<your-subdomain>.workers.dev`. Copy that into the app's `.env`:

```
EXPO_PUBLIC_DIARY_API_URL=https://nomi-diary.<your-subdomain>.workers.dev
```

Then rebuild the app (`npx expo run:android`) — `EXPO_PUBLIC_*` vars are inlined at build time.

## Optional: rate limiting via KV

If users start abusing it, create a KV namespace:

```bash
npx wrangler kv:namespace create RATE_LIMIT
```

Wrangler prints an `id`. Paste it into `wrangler.toml` and uncomment the `[[kv_namespaces]]` block. Redeploy. The worker will then enforce 30 req/hr per IP.

## Cost estimate

| Active users | Diaries/user/day | $/month (Haiku) |
|---|---|---|
| 100 | 1 | $3 |
| 1,000 | 1 | $30 |
| 10,000 | 1 | $300 |

Worker invocations are free up to 100K/day, so the only cost is Anthropic.

## Local dev

```bash
npx wrangler dev
```

Spins up the worker at `http://localhost:8787`. Set `EXPO_PUBLIC_DIARY_API_URL=http://10.0.2.2:8787` (Android emulator) or your laptop's LAN IP for device testing.

## Contract

`POST /` (JSON):

```ts
{
  traits: { playful: number, foodie: number, sleepy: number, adventurous: number, social: number },
  recentMemories: [{ type: string, detail?: string, daysAgo: number }],
  mood: string,
  hunger: number,
  happiness: number,
  energy: number,
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
  ownerName?: string,
  equippedSkin?: string,
  activeAdventureZone?: string,
  hoursAway: number
}
```

Response:

```ts
{ text: string, illustration: string }
```

If the worker fails, the app falls back to the local template generator — diary still works, just the old voice.
