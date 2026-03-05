# Nomi

A Tamagotchi-style virtual companion that lives on Solana. Built for the **Monolith Solana Mobile Hackathon**.

## What It Does

Nomi is a mobile-first companion app where you mint your pet as an **on-chain NFT**, care for it, customize it, and earn tokens through gameplay — all powered by real Solana blockchain transactions.

### Core Features

- **3D Interactive Pet** — Real-time 3D rendered companion (Three.js + React Three Fiber) with mood-reactive animations
- **On-Chain NFT Minting** — Mint your pet as a Solana NFT using raw Metaplex instructions (no SDK dependency)
- **Mobile Wallet Adapter** — Connect Phantom/Solflare via the official Solana Mobile MWA protocol
- **Care System** — Feed, play, rest, and reflect to manage hunger, happiness, and energy stats
- **SKR Token Economy** — Earn and spend $SKR tokens through adventures and the in-app shop
- **Shop with On-Chain Purchases** — Buy skins, accessories, and animations with SOL or SKR (real blockchain transfers)
- **Adventures & Loot** — Send your pet on timed adventures across 5 zones, earn rarity-based loot
- **3 Mini-Games** — Memory Match, Quick Tap, Pattern Recall with XP and token rewards
- **50-Level Progression** — XP system with daily/weekly quests, achievements, and level perks
- **Pet Personality & Diary** — AI-driven personality traits that evolve based on your interactions
- **Evolution System** — 5 evolution stages from Egg to Oracle
- **On-Chain State Sync** — Pet state written to Solana via memo program for verifiable history
- **Transaction History** — Real Solscan-linked transaction log

### Solana Integration

| Feature | Implementation | On-Chain? |
|---------|---------------|-----------|
| Wallet Connection | Mobile Wallet Adapter (MWA) | Yes |
| NFT Minting | Raw Metaplex Token Metadata v1 instructions | Yes |
| Shop Purchases | SystemProgram.transfer to treasury | Yes |
| SKR Token Claims | SPL Token mint (devnet test token) | Yes |
| SKR Transfers | SPL Token transfer instructions | Yes |
| Pet State Sync | Memo Program write | Yes |
| Balance Fetching | RPC getBalance + parsed token accounts | Yes |
| Transaction History | getSignaturesForAddress | Yes |
| SOL Airdrop | requestAirdrop (devnet) | Yes |

### SKR Token Integration

The app integrates with the **SKR (Seeker)** token ecosystem:
- Mainnet mint: `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`
- Devnet: Creates a test SPL token with matching decimals (6) for demo
- Earn SKR through adventures (rare/legendary loot)
- Spend SKR in the shop on premium items
- Real SPL token operations (create mint, create ATA, mint, transfer)

## Tech Stack

- **React Native** + Expo (TypeScript)
- **Three.js** + React Three Fiber + Drei (3D rendering)
- **Solana Web3.js** (blockchain)
- **Zustand** (state management, no persist middleware)
- **NativeWind** (Tailwind CSS)
- **expo-gl** + **expo-three** (WebGL bridge)
- **expo-av** (audio)
- **expo-haptics** (tactile feedback)

## Architecture

```
src/
  screens/       5 main screens (Home, Games, Shop, Profile, Mint)
  store/         11 Zustand stores (pet, wallet, xp, shop, adventure, etc.)
  lib/           Solana utilities (MWA, NFT mint, transactions, SKR token)
  components/    40+ UI components (3D renderer, modals, care actions)
  theme/         Design system and typography
  data/          Game data (care variants, premium tiers)
```

## Running Locally

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Build for Android (required for MWA + native modules)
npx expo prebuild --clean
npx expo run:android
```

**Requirements:**
- Node.js 18+
- Android device with Phantom wallet installed
- Connected to Solana devnet

## Demo Flow

1. Open app → Welcome intro
2. Connect wallet via Phantom (MWA)
3. Enter your name
4. Mint your pet as an NFT (on-chain transaction)
5. Care for your pet (feed, play, rest)
6. Explore Games tab (mini-games, adventures, spin wheel)
7. Browse Shop (buy items with SOL/SKR)
8. Check Profile (wallet, achievements, TX history)

## Network

- **Cluster**: Devnet (`https://api.devnet.solana.com`)
- **Shop Treasury**: `FHE2gMqe3kk7JDqBQffFqJoBEQGp3DdeQ42K2pHswfJU`
- All transactions viewable on [Solscan (devnet)](https://solscan.io/?cluster=devnet)

## License

MIT
