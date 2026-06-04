import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { events } from '../lib/analytics';

const ADVENTURE_STORAGE_KEY = 'oracle-pet-adventure';

// ── Adventure Zones ──
export interface AdventureZone {
  id: string;
  name: string;
  emoji: string;
  levelRequired: number;
  durationMs: number; // milliseconds
  durationLabel: string;
  description: string;
  xpRange: [number, number];
  coinRange: [number, number];
  shardChance: number; // 0-1
}

export const ADVENTURE_ZONES: AdventureZone[] = [
  {
    id: 'sunny-meadow',
    name: 'Sunny Meadow',
    emoji: '\u{1F33B}',
    levelRequired: 1,
    durationMs: 30 * 60 * 1000, // 30 min
    durationLabel: '30 min',
    description: 'A peaceful meadow with hidden treasures',
    xpRange: [20, 40],
    coinRange: [0, 0.1],
    shardChance: 0,
  },
  {
    id: 'crystal-cave',
    name: 'Crystal Cave',
    emoji: '\u{1F48E}',
    levelRequired: 5,
    durationMs: 2 * 60 * 60 * 1000, // 2 hours
    durationLabel: '2 hours',
    description: 'Glowing crystals hide rare rewards',
    xpRange: [40, 80],
    coinRange: [0, 0.3],
    shardChance: 0.01,
  },
  {
    id: 'shadow-forest',
    name: 'Shadow Forest',
    emoji: '\u{1F332}',
    levelRequired: 10,
    durationMs: 4 * 60 * 60 * 1000, // 4 hours
    durationLabel: '4 hours',
    description: 'Dark woods with legendary creatures',
    xpRange: [60, 120],
    coinRange: [0.1, 0.5],
    shardChance: 0.03,
  },
  {
    id: 'dragon-peak',
    name: 'Dragon Peak',
    emoji: '\u{1F525}',
    levelRequired: 15,
    durationMs: 8 * 60 * 60 * 1000, // 8 hours
    durationLabel: '8 hours',
    description: 'The dragon\'s lair holds immense power',
    xpRange: [100, 200],
    coinRange: [0.2, 0.8],
    shardChance: 0.05,
  },
  {
    id: 'oracle-temple',
    name: 'Oracle Temple',
    emoji: '\u{1F3DB}\uFE0F',
    levelRequired: 25,
    durationMs: 24 * 60 * 60 * 1000, // 24 hours
    durationLabel: '24 hours',
    description: 'Ancient temple of the Oracle. Maximum rewards.',
    xpRange: [200, 400],
    coinRange: [0.5, 2.0],
    shardChance: 0.10,
  },
];

// ── Loot ──
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface LootReward {
  rarity: LootRarity;
  xp: number;
  coins: number;
  skr: number; // SKR token reward
  shard: boolean;
  freeItem: boolean;
}

// Loot/event `coins` and `skr` are stored as small fractions — a legacy of
// when they mapped onto on-chain SOL/SKR amounts. The actual game economy
// (shop prices 50–1000, balance shown with thousands separators, daily caps
// of 250/150/100) is denominated in WHOLE coins. The reveal modal already
// scaled by 100 for display, but the credit path + toast used the raw
// fraction — so a "+82 / +173 coins" reveal only added ~3 coins (Jordan's
// bug report, May 2026). Display and credit MUST use this one conversion so
// they can never diverge again.
export function lootCoinsToDisplay(fraction: number): number {
  return Math.round((fraction ?? 0) * 100);
}

function rollLoot(zone: AdventureZone, statsBonus: boolean): LootReward {
  const rand = Math.random();
  // Stats > 80% at departure gives +15% rare/legendary chance
  // Premium adds +10% to rare/legendary
  let premiumBonus = 0;
  try {
    const { getPremiumLootBonus } = require('./premiumStore');
    premiumBonus = getPremiumLootBonus();
  } catch {}
  // Level perk loot bonus
  let levelLootBonus = 0;
  try {
    const { getPerksForLevel } = require('./xpStore');
    const level = require('./xpStore').useXpStore.getState().level;
    levelLootBonus = getPerksForLevel(level).lootBonus;
  } catch {}
  const bonus = (statsBonus ? 0.15 : 0) + premiumBonus + levelLootBonus;

  let rarity: LootRarity;
  if (rand < 0.03 + bonus * 0.02) {
    rarity = 'legendary';
  } else if (rand < 0.15 + bonus * 0.05) {
    rarity = 'rare';
  } else if (rand < 0.40 + bonus * 0.05) {
    rarity = 'uncommon';
  } else {
    rarity = 'common';
  }

  const [minXp, maxXp] = zone.xpRange;
  const [minCoin, maxCoin] = zone.coinRange;

  const rarityMultiplier: Record<LootRarity, number> = {
    common: 1,
    uncommon: 1.3,
    rare: 1.8,
    legendary: 2.5,
  };

  const mult = rarityMultiplier[rarity];
  const xp = Math.round((minXp + Math.random() * (maxXp - minXp)) * mult);
  const coins = rarity === 'common' ? 0 :
    Math.round((minCoin + Math.random() * (maxCoin - minCoin)) * mult * 100) / 100;

  // SKR token rewards — rare and legendary adventures earn SKR
  let skr = 0;
  if (rarity === 'rare') {
    skr = Math.round((1 + Math.random() * 4) * 100) / 100; // 1-5 SKR
  } else if (rarity === 'legendary') {
    skr = Math.round((5 + Math.random() * 10) * 100) / 100; // 5-15 SKR
  }

  return {
    rarity,
    xp,
    coins,
    skr,
    shard: rarity === 'legendary' && Math.random() < zone.shardChance * 10,
    freeItem: rarity === 'rare' && Math.random() < 0.3,
  };
}

// ── Active Adventure ──
export interface ActiveAdventure {
  zoneId: string;
  startedAt: number; // timestamp
  endsAt: number; // timestamp
  statsAtDeparture: { hunger: number; happiness: number; energy: number };
}

// ── Spin Wheel ──
export interface SpinResult {
  label: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic';
  xp: number;
  staminaRefill: boolean;
  doubleXpMinutes: number; // 0 = none, 60 = 1 hour
  freeItem: boolean;
  shard: boolean;
}

export const SPIN_SEGMENTS: SpinResult[] = [
  { label: '10 XP', emoji: '\u{2B50}', rarity: 'common', xp: 10, staminaRefill: false, doubleXpMinutes: 0, freeItem: false, shard: false },
  { label: '25 XP', emoji: '\u{2B50}', rarity: 'common', xp: 25, staminaRefill: false, doubleXpMinutes: 0, freeItem: false, shard: false },
  { label: '50 XP', emoji: '\u{1F31F}', rarity: 'common', xp: 50, staminaRefill: false, doubleXpMinutes: 0, freeItem: false, shard: false },
  { label: 'Full Stamina', emoji: '\u{26A1}', rarity: 'common', xp: 0, staminaRefill: true, doubleXpMinutes: 0, freeItem: false, shard: false },
  { label: '2x XP 1hr', emoji: '\u{1F525}', rarity: 'rare', xp: 0, staminaRefill: false, doubleXpMinutes: 60, freeItem: false, shard: false },
  { label: '100 XP', emoji: '\u{1F4AB}', rarity: 'common', xp: 100, staminaRefill: false, doubleXpMinutes: 0, freeItem: false, shard: false },
  { label: 'Free Item', emoji: '\u{1F381}', rarity: 'rare', xp: 0, staminaRefill: false, doubleXpMinutes: 0, freeItem: true, shard: false },
  { label: 'Evo Shard', emoji: '\u{1F48E}', rarity: 'rare', xp: 50, staminaRefill: false, doubleXpMinutes: 0, freeItem: false, shard: true },
  { label: 'Rare Crate', emoji: '\u{1F9F0}', rarity: 'rare', xp: 180, staminaRefill: false, doubleXpMinutes: 0, freeItem: true, shard: true },
  { label: 'Epic Jackpot', emoji: '\u{1F451}', rarity: 'epic', xp: 400, staminaRefill: true, doubleXpMinutes: 120, freeItem: true, shard: true },
];

// Weighted spin — lower indices more likely
function spinWheel(): number {
  // Rare and Epic outcomes intentionally have low odds.
  const weights = [22, 20, 15, 12, 9, 8, 5, 4, 2, 1]; // sums to 98
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return i;
  }
  return 0;
}

// ── Login Calendar ──
export interface LoginDay {
  day: number; // 1-7
  xpReward: number;
  bonusLabel: string;
  claimed: boolean;
}

const LOGIN_REWARDS: { xp: number; bonus: string }[] = [
  { xp: 25, bonus: '' },
  { xp: 40, bonus: '+20 Stamina' },
  { xp: 60, bonus: '' },
  { xp: 80, bonus: 'Stamina Potion' },
  { xp: 100, bonus: 'Free Spin' },
  { xp: 150, bonus: 'Shop Discount' },
  { xp: 300, bonus: 'Mystery Box' },
];

function createFreshCalendar(): LoginDay[] {
  return LOGIN_REWARDS.map((r, i) => ({
    day: i + 1,
    xpReward: r.xp,
    bonusLabel: r.bonus,
    claimed: false,
  }));
}

// ── Evolution ──
export interface EvolutionStage {
  stage: number;
  name: string;
  levelRequired: number;
  shardsRequired: number;
  visualEffect: string; // description for rendering
  scale: number;
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  { stage: 1, name: 'Baby Nomi', levelRequired: 1, shardsRequired: 0, visualEffect: 'none', scale: 1.0 },
  { stage: 2, name: 'Teen Nomi', levelRequired: 10, shardsRequired: 3, visualEffect: 'glow', scale: 1.1 },
  { stage: 3, name: 'Adult Nomi', levelRequired: 20, shardsRequired: 7, visualEffect: 'glow+particles', scale: 1.2 },
  { stage: 4, name: 'Elder Nomi', levelRequired: 35, shardsRequired: 15, visualEffect: 'golden-glow+crown', scale: 1.3 },
  { stage: 5, name: 'Oracle Nomi', levelRequired: 50, shardsRequired: 25, visualEffect: 'aura+wings', scale: 1.4 },
];

// ── Store ──
interface AdventureState {
  activeAdventure: ActiveAdventure | null;
  completedAdventures: number;
  pendingLoot: LootReward | null; // set when adventure completes, cleared when user opens it
  /** Date.now() of when pendingLoot was created. Used so a stale
   *  unclaimed loot from days ago doesn't reappear when the user comes
   *  back. null when pendingLoot is null. */
  pendingLootCreatedAt: number | null;
  // Evolution
  evolutionShards: number;
  evolutionStage: number; // 1-5
  // Spin wheel
  lastSpinDate: string; // ISO date
  extraSpinsToday: number;
  doubleXpUntil: number; // timestamp, 0 = inactive
  freeItemTokens: number; // earned from spin wheel
  // Login calendar
  loginCalendar: LoginDay[];
  loginCalendarStartDate: string; // ISO date of day 1
  currentLoginDay: number; // which day we're on (1-7), 0 = not started
  lastLoginClaimDate: string; // ISO date of last claim
  totalLoginDays: number; // lifetime count for monthly milestones
  // Game scores
  highScores: Record<string, number>;
  miniGamesWon: number;
  miniGameXpEarned: number;
}

interface AdventureActions {
  startAdventure: (zoneId: string, stats: { hunger: number; happiness: number; energy: number }) => boolean;
  checkAdventureComplete: () => boolean;
  claimAdventureLoot: () => LootReward | null;
  // Spin
  canSpinToday: () => boolean;
  /** Authoritative free-vs-paid + cost for the NEXT spin — computed with the
   *  same premium/level-perk logic as doSpin so the UI never charges SOL for a
   *  spin the store treats as free (Pro = 3 free spins/day at 0 cost). */
  getSpinState: () => { isFreeSpin: boolean; cost: number };
  doSpin: () => SpinResult | null;
  claimSpinReward: (result: SpinResult) => void;
  // Login
  claimLoginReward: () => LoginDay | null;
  checkLoginCalendarReset: () => void;
  // Evolution
  checkEvolution: (level: number) => void;
  canEvolve: (level: number) => boolean;
  evolve: () => void;
  // Game scores
  reportMiniGameScore: (gameId: string, score: number, xpEarned: number) => void;
  // Persistence
  hydrateAdventure: () => Promise<void>;
}

type AdventureStore = AdventureState & AdventureActions;

export function saveAdventureState(state: AdventureState): Promise<void> {
  const data: Record<string, any> = {};
  const keys: (keyof AdventureState)[] = [
    'activeAdventure', 'completedAdventures', 'pendingLoot',
    'evolutionShards', 'evolutionStage',
    'lastSpinDate', 'extraSpinsToday', 'doubleXpUntil', 'freeItemTokens',
    'loginCalendar', 'loginCalendarStartDate', 'currentLoginDay', 'lastLoginClaimDate', 'totalLoginDays',
    'highScores', 'miniGamesWon', 'miniGameXpEarned',
  ];
  for (const key of keys) {
    data[key] = state[key];
  }
  // Stamp pendingLoot creation time so hydrate can drop it if it's been
  // sitting unclaimed for too long (currently >7 days). Stored as a
  // separate top-level field rather than inside the LootReward to avoid
  // changing the type — pulled out at hydrate.
  data.pendingLootCreatedAt = (state as any).pendingLootCreatedAt ?? null;
  return AsyncStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

export const useAdventureStore = create<AdventureStore>((set, get) => ({
  activeAdventure: null,
  completedAdventures: 0,
  pendingLoot: null,
  pendingLootCreatedAt: null,
  evolutionShards: 0,
  evolutionStage: 1,
  lastSpinDate: '',
  extraSpinsToday: 0,
  doubleXpUntil: 0,
  freeItemTokens: 0,
  loginCalendar: createFreshCalendar(),
  loginCalendarStartDate: '',
  currentLoginDay: 0,
  lastLoginClaimDate: '',
  totalLoginDays: 0,
  highScores: {},
  miniGamesWon: 0,
  miniGameXpEarned: 0,

  startAdventure: (zoneId, stats) => {
    const { activeAdventure } = get();
    if (activeAdventure) return false; // already on an adventure

    const zone = ADVENTURE_ZONES.find(z => z.id === zoneId);
    if (!zone) return false;

    // Check stats > 30%
    if (stats.hunger < 30 || stats.happiness < 30 || stats.energy < 30) return false;

    const now = Date.now();
    set({
      activeAdventure: {
        zoneId,
        startedAt: now,
        endsAt: now + zone.durationMs,
        statsAtDeparture: stats,
      },
    });
    saveAdventureState(get());

    // Update weekly quest
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.updateWeeklyQuestProgress('adventuresSent');
    } catch {}

    // Schedule notification for adventure completion
    try {
      const ns = require('./notificationStore').useNotificationStore.getState();
      ns.scheduleAdventureComplete(now + zone.durationMs, zone.name);
    } catch {}

    // Record personality memory
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('adventure_start', zone.name);
      ps.updateTraits('adventure_start');
    } catch {}

    events.adventureStarted({ zone: zone.id, duration_min: Math.round(zone.durationMs / 60000) });

    return true;
  },

  checkAdventureComplete: () => {
    const { activeAdventure } = get();
    if (!activeAdventure) return false;
    if (Date.now() < activeAdventure.endsAt) return false;

    // Adventure is done — roll loot
    const zone = ADVENTURE_ZONES.find(z => z.id === activeAdventure.zoneId);
    if (!zone) return false;

    const { hunger, happiness, energy } = activeAdventure.statsAtDeparture;
    const statsBonus = hunger >= 80 && happiness >= 80 && energy >= 80;
    const loot = rollLoot(zone, statsBonus);

    set({
      pendingLoot: loot,
      pendingLootCreatedAt: Date.now(),
      activeAdventure: null,
      completedAdventures: get().completedAdventures + 1,
    });
    saveAdventureState(get());

    events.adventureCompleted({
      zone: zone.id,
      xp: loot.xp,
      coins: loot.coins,
      shards: loot.shard ? 1 : 0,
    });

    // Surface completion immediately. Without this, the user only finds out
    // their adventure finished by navigating back to the AdventureCard —
    // dead time turns into "did anything happen?" Toast fires regardless of
    // current screen so the user can claim from anywhere via the bell.
    try {
      const { notify } = require('../lib/notify');
      const rarity = (loot.rarity ?? 'common').toString();
      const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
      const parts: string[] = [];
      if (loot.xp > 0) parts.push(`+${loot.xp} XP`);
      const totalCoins = lootCoinsToDisplay(loot.coins) + lootCoinsToDisplay(loot.skr);
      if (totalCoins > 0) parts.push(`+${totalCoins} coins`);
      if (loot.shard) parts.push('+1 shard');
      if (loot.freeItem) parts.push('+1 free item');
      notify.success(
        `${zone.name} complete!`,
        `${rarityLabel} loot ready · tap to claim · ${parts.join(' · ')}`,
        { category: 'reward' },
      );
    } catch {}

    return true;
  },

  claimAdventureLoot: () => {
    const { pendingLoot } = get();
    if (!pendingLoot) return null;

    // Re-entry guard: clear pendingLoot FIRST. Without this, a double-tap
    // on the claim button would award XP/coins/shards twice before the
    // store finished updating. Setting state first means the second call
    // hits the `if (!pendingLoot) return null` early-out above.
    set({ pendingLoot: null, pendingLootCreatedAt: null });
    saveAdventureState(get());

    // Award XP
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(pendingLoot.xp, 'adventure');
    } catch {}

    // Award coins + skr to the in-app wallet (single unified game currency).
    // Real SOL/SKR balances are chain truth — never written here.
    // Source 'adventure' is daily-capped in walletStore to deter farming.
    const totalCoins = lootCoinsToDisplay(pendingLoot.coins) + lootCoinsToDisplay(pendingLoot.skr);
    if (totalCoins > 0) {
      try {
        const walletStore = require('./walletStore').useWalletStore.getState();
        walletStore.addAppCoins?.(totalCoins, 'adventure');
      } catch {}
    }

    // Surface what the user got — coins/XP/shards in one toast. The cap
    // notification (if hit) fires separately from walletStore.addAppCoins.
    try {
      const { notify } = require('../lib/notify');
      const parts: string[] = [];
      if (pendingLoot.xp > 0) parts.push(`+${pendingLoot.xp} XP`);
      if (totalCoins > 0) parts.push(`+${totalCoins} coins`);
      if (pendingLoot.shard) parts.push('+1 shard');
      if (pendingLoot.freeItem) parts.push('+1 free item token');
      const rarity = (pendingLoot.rarity ?? '').toString();
      const rarityLabel = rarity ? rarity.charAt(0).toUpperCase() + rarity.slice(1) : 'Common';
      notify.success(
        `${rarityLabel} loot claimed`,
        parts.join(' · '),
        { category: 'reward' },
      );
    } catch {}

    // Award shard
    if (pendingLoot.shard) {
      set({ evolutionShards: get().evolutionShards + 1 });
    }

    // Record personality memory + speech bubble reaction
    try {
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      const ownerName = require('./petStore').usePetStore.getState().ownerName;
      ps.recordMemory('adventure_complete');
      ps.updateTraits('adventure_complete');
      ps.setCurrentDialogue(mod.getActionDialogue('adventure_complete', ps.traits, ownerName));
    } catch {}

    // pendingLoot was already cleared at the top of this function as a
    // re-entry guard; the rewards have now been applied. Persist the final
    // state (in case other actions like addXp mutated it).
    saveAdventureState(get());
    return pendingLoot;
  },

  // ── Spin Wheel ──
  canSpinToday: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { lastSpinDate, extraSpinsToday } = get();
    // Premium: 3 free spins, 5 paid. Free: 1 free, 3 paid.
    // Default cost MUST match premiumStore.getPremiumSpinConfig (0.002 SOL).
    // Previously this fallback was 0.2 SOL (100× higher) so a transient
    // require failure during boot could overcharge a single spin.
    let spinConfig = { maxFreeSpins: 1, maxPaidSpins: 3, paidSpinCost: 0.002 };
    try {
      const { getPremiumSpinConfig } = require('./premiumStore');
      spinConfig = getPremiumSpinConfig();
    } catch {}
    // Level perk: extra free spins
    try {
      const { getPerksForLevel } = require('./xpStore');
      const level = require('./xpStore').useXpStore.getState().level;
      spinConfig.maxFreeSpins += getPerksForLevel(level).freeSpinBonus;
    } catch {}
    if (lastSpinDate !== today) return true; // first spin of the day
    return extraSpinsToday < (spinConfig.maxFreeSpins - 1 + spinConfig.maxPaidSpins);
  },

  getSpinState: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { lastSpinDate, extraSpinsToday } = get();
    // Default cost must match the non-Pro paid-spin price in premiumStore
    // (0.002 SOL). Previously the fallback was 0.2 SOL — 100× the real
    // cost — so a transient `require('./premiumStore')` failure during
    // boot/hot-reload could charge users 0.2 SOL for a single spin.
    let spinConfig = { maxFreeSpins: 1, maxPaidSpins: 3, paidSpinCost: 0.002 };
    try {
      const { getPremiumSpinConfig } = require('./premiumStore');
      spinConfig = getPremiumSpinConfig();
    } catch {}
    try {
      const { getPerksForLevel } = require('./xpStore');
      const level = require('./xpStore').useXpStore.getState().level;
      spinConfig.maxFreeSpins += getPerksForLevel(level).freeSpinBonus;
    } catch {}
    // Mirror doSpin exactly: spinsUsedToday < totalFreeSpins ⇒ free.
    const isNewDay = lastSpinDate !== today;
    const spinsUsedToday = isNewDay ? 0 : extraSpinsToday + 1;
    const isFreeSpin = spinsUsedToday < spinConfig.maxFreeSpins;
    return { isFreeSpin, cost: isFreeSpin ? 0 : spinConfig.paidSpinCost };
  },

  doSpin: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { lastSpinDate, extraSpinsToday } = get();

    // See getSpinState comment — default mirrors premiumStore (0.002 SOL).
    let spinConfig = { maxFreeSpins: 1, maxPaidSpins: 3, paidSpinCost: 0.002 };
    try {
      const { getPremiumSpinConfig } = require('./premiumStore');
      spinConfig = getPremiumSpinConfig();
    } catch {}
    // Level perk: extra free spins
    try {
      const { getPerksForLevel } = require('./xpStore');
      const level = require('./xpStore').useXpStore.getState().level;
      spinConfig.maxFreeSpins += getPerksForLevel(level).freeSpinBonus;
    } catch {}

    const totalFreeSpins = spinConfig.maxFreeSpins;
    const isNewDay = lastSpinDate !== today;
    const spinsUsedToday = isNewDay ? 0 : extraSpinsToday + 1; // +1 for the first free spin
    const isFreeSpin = spinsUsedToday < totalFreeSpins;
    const maxTotal = totalFreeSpins + spinConfig.maxPaidSpins;

    if (!isNewDay && (extraSpinsToday + 1) >= maxTotal) return null;

    // Paid-spin payment is handled entirely by the UI layer (SpinWheel calls
    // transferSOL BEFORE doSpin and bails out if it fails). Previously this
    // block ALSO called walletStore.deductBalance(cost) "as a fallback",
    // which double-debited the local balance — the user saw 0.004 SOL gone
    // for one 0.002 SOL spin until refreshBalance arrived from chain. The
    // user-reported "takes 0.002 SOL twice" symptom traces here. Only do a
    // balance pre-check now; the actual deduct comes from chain refresh.
    if (!isFreeSpin && !isNewDay) {
      const cost = spinConfig.paidSpinCost;
      if (cost > 0) {
        try {
          const walletStore = require('./walletStore').useWalletStore.getState();
          if (walletStore.balance < cost) return null;
        } catch { return null; }
      }
    }

    const segmentIndex = spinWheel();
    const result = SPIN_SEGMENTS[segmentIndex] ?? SPIN_SEGMENTS[0];

    // Track spin usage. CRITICAL: counter must increment on EVERY spin (free
    // or paid). Previously this branched `isFreeSpin ? 0 : extraSpinsToday + 1`
    // which reset to zero on every free spin — fine for the default 1-free
    // case (only first spin is free), but for premium users (3 free) or any
    // user with the level-perk free-spin bonus (maxFreeSpins >= 2), the second
    // free spin would also reset the counter, leaving the user able to spin
    // forever. Real revenue exploit. Now we always increment after the first
    // spin of the day (which is gated by isNewDay above).
    set({
      lastSpinDate: today,
      extraSpinsToday: isNewDay ? 0 : extraSpinsToday + 1,
    });
    saveAdventureState(get());
    return result;
  },

  claimSpinReward: (result: SpinResult) => {
    if (result.xp > 0) {
      try {
        const xpStore = require('./xpStore').useXpStore.getState();
        xpStore.addXp(result.xp, 'spin');
      } catch {}
    }

    if (result.staminaRefill) {
      try {
        const petMod = require('./petStore');
        petMod.usePetStore.setState({ stamina: petMod.getEffectiveStaminaMax(), lastStaminaRegenAt: Date.now() });
      } catch {}
    }

    if (result.doubleXpMinutes > 0) {
      set({ doubleXpUntil: Date.now() + result.doubleXpMinutes * 60 * 1000 });
    }

    if (result.shard) {
      set({ evolutionShards: get().evolutionShards + 1 });
    }

    if (result.freeItem) {
      set({ freeItemTokens: get().freeItemTokens + 1 });
    }

    saveAdventureState(get());

    // Pet reacts to the wheel result
    try {
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      const ownerName = require('./petStore').usePetStore.getState().ownerName;
      ps.setCurrentDialogue(mod.getActionDialogue('spin_won', ps.traits, ownerName));
    } catch {}
  },

  // ── Login Calendar ──
  claimLoginReward: () => {
    // Run the missed-day reset FIRST so the day we're about to claim is
    // correct no matter who calls us first. Previously this relied on the
    // caller (hydrate vs UI) invoking checkLoginCalendarReset beforehand —
    // wrong ordering let a returning user claim a higher day's reward instead
    // of restarting at Day 1 (or skip a day). Idempotent: no-op if no day was
    // missed.
    get().checkLoginCalendarReset();
    const today = new Date().toISOString().slice(0, 10);
    const { lastLoginClaimDate, currentLoginDay, loginCalendar } = get();

    // Already claimed today
    if (lastLoginClaimDate === today) return null;

    const nextDay = currentLoginDay + 1;
    if (nextDay > 7) return null; // calendar full

    const dayReward = loginCalendar[nextDay - 1];
    if (!dayReward || dayReward.claimed) return null;

    // Update calendar
    const updatedCalendar = loginCalendar.map((d, i) =>
      i === nextDay - 1 ? { ...d, claimed: true } : d
    );

    set({
      loginCalendar: updatedCalendar,
      currentLoginDay: nextDay,
      lastLoginClaimDate: today,
      totalLoginDays: get().totalLoginDays + 1,
      loginCalendarStartDate: get().loginCalendarStartDate || today,
    });

    // Award XP (premium gets 1.5x calendar XP)
    try {
      let calendarMult = 1.0;
      try {
        const { getPremiumCalendarMultiplier } = require('./premiumStore');
        calendarMult = getPremiumCalendarMultiplier();
      } catch {}
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(Math.round(dayReward.xpReward * calendarMult), 'login-calendar');
    } catch {}

    // Weekly quest: login every day
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.updateWeeklyQuestProgress('loginEveryDay');
    } catch {}

    // Pet reacts to the daily login claim
    try {
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      const ownerName = require('./petStore').usePetStore.getState().ownerName;
      ps.setCurrentDialogue(mod.getActionDialogue('login_claimed', ps.traits, ownerName));
    } catch {}

    // Handle special bonuses
    if (dayReward.bonusLabel === '+20 Stamina') {
      try {
        const petMod = require('./petStore');
        const current = petMod.usePetStore.getState().getStamina();
        const maxStam = petMod.getEffectiveStaminaMax();
        petMod.usePetStore.setState({ stamina: Math.min(maxStam, current + 20), lastStaminaRegenAt: Date.now() });
      } catch {}
    }

    if (dayReward.bonusLabel === 'Stamina Potion') {
      try {
        const petMod = require('./petStore');
        petMod.usePetStore.setState({ stamina: petMod.getEffectiveStaminaMax(), lastStaminaRegenAt: Date.now() });
      } catch {}
    }

    // Day 7: evolution shard
    if (nextDay === 7) {
      set({ evolutionShards: get().evolutionShards + 1 });
    }

    saveAdventureState(get());
    return dayReward;
  },

  checkLoginCalendarReset: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { lastLoginClaimDate, currentLoginDay } = get();

    // If user missed a day (last claim wasn't yesterday or today), reset calendar
    if (lastLoginClaimDate && lastLoginClaimDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastLoginClaimDate !== yesterday) {
        // Missed a day — reset! Capture the day count we lost so we can
        // surface it to the user. Silent wipe was the worst part of this
        // path: a user opening the app after a 1-day gap saw "Day 1" with
        // no explanation that their 5-day streak just got nuked.
        const lostDays = currentLoginDay;
        set({
          loginCalendar: createFreshCalendar(),
          currentLoginDay: 0,
          loginCalendarStartDate: '',
        });
        saveAdventureState(get());
        if (lostDays >= 2) {
          try {
            const { notify } = require('../lib/notify');
            notify.warning(
              'Login calendar reset',
              `You missed a day, so the 7-day calendar restarted. You had reached Day ${lostDays}.`,
              { category: 'streak' },
            );
          } catch {}
        }
      }
    }

    // If we completed all 7 days, reset for next cycle (regardless of when)
    if (currentLoginDay >= 7 && lastLoginClaimDate !== today) {
      set({
        loginCalendar: createFreshCalendar(),
        currentLoginDay: 0,
        loginCalendarStartDate: '',
      });
      saveAdventureState(get());
    }
  },

  // ── Evolution ──
  checkEvolution: (level) => {
    const { evolutionStage, evolutionShards } = get();
    const nextStage = EVOLUTION_STAGES[evolutionStage]; // 0-indexed: stage 1 = index 0, so next = current index
    if (!nextStage || evolutionStage >= 5) return;
    // Check is done in canEvolve, this is just a trigger point
  },

  canEvolve: (level) => {
    const { evolutionStage, evolutionShards } = get();
    if (evolutionStage >= 5) return false;
    const nextStage = EVOLUTION_STAGES[evolutionStage]; // next stage (0-indexed for current)
    if (!nextStage) return false;
    return level >= nextStage.levelRequired && evolutionShards >= nextStage.shardsRequired;
  },

  evolve: () => {
    const { evolutionStage, evolutionShards } = get();
    if (evolutionStage >= 5) return;
    const nextStage = EVOLUTION_STAGES[evolutionStage];
    if (!nextStage) return;

    set({
      evolutionStage: evolutionStage + 1,
      evolutionShards: evolutionShards - nextStage.shardsRequired,
    });
    saveAdventureState(get());
  },

  // ── Mini-game scores ──
  reportMiniGameScore: (gameId, score, xpEarned) => {
    const { highScores } = get();
    const prevHigh = highScores[gameId] ?? 0;
    const isNewHigh = score > prevHigh;

    set({
      highScores: { ...highScores, [gameId]: Math.max(prevHigh, score) },
      miniGamesWon: get().miniGamesWon + 1,
      miniGameXpEarned: get().miniGameXpEarned + xpEarned,
    });

    // Award XP
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(xpEarned, 'mini-game');

      // Bonus for new high score
      if (isNewHigh && prevHigh > 0) {
        xpStore.addXp(25, 'high-score');
      }

      // Weekly quest progress
      xpStore.updateWeeklyQuestProgress('miniGamesWon');
      xpStore.updateWeeklyQuestProgress('miniGameXp', xpEarned);
    } catch {}

    saveAdventureState(get());
  },

  // ── Persistence ──
  hydrateAdventure: async () => {
    try {
      const raw = await AsyncStorage.getItem(ADVENTURE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      // Stale-loot guard: pendingLoot is captured when an adventure
      // completes, but if the user never claims it, the loot survives across
      // sessions indefinitely. After 7 days the loot has likely diverged
      // from the current game state (zone configs, balancing, items in shop)
      // and the user has long forgotten what triggered it. Drop it silently
      // — they didn't lose anything they were aware of.
      const STALE_LOOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      let restoredLoot = data.pendingLoot ?? null;
      let restoredLootCreatedAt: number | null = typeof data.pendingLootCreatedAt === 'number' ? data.pendingLootCreatedAt : null;
      if (restoredLoot && restoredLootCreatedAt != null) {
        if (Date.now() - restoredLootCreatedAt > STALE_LOOT_MAX_AGE_MS) {
          restoredLoot = null;
          restoredLootCreatedAt = null;
        }
      }

      set({
        activeAdventure: data.activeAdventure ?? null,
        completedAdventures: data.completedAdventures ?? 0,
        pendingLoot: restoredLoot,
        pendingLootCreatedAt: restoredLootCreatedAt,
        evolutionShards: data.evolutionShards ?? 0,
        evolutionStage: data.evolutionStage ?? 1,
        lastSpinDate: data.lastSpinDate ?? '',
        extraSpinsToday: data.extraSpinsToday ?? 0,
        doubleXpUntil: data.doubleXpUntil ?? 0,
        freeItemTokens: data.freeItemTokens ?? 0,
        loginCalendar: data.loginCalendar ?? createFreshCalendar(),
        loginCalendarStartDate: data.loginCalendarStartDate ?? '',
        currentLoginDay: data.currentLoginDay ?? 0,
        lastLoginClaimDate: data.lastLoginClaimDate ?? '',
        totalLoginDays: data.totalLoginDays ?? 0,
        highScores: data.highScores ?? {},
        miniGamesWon: data.miniGamesWon ?? 0,
        miniGameXpEarned: data.miniGameXpEarned ?? 0,
      });

      // Check if adventure completed while app was closed
      get().checkAdventureComplete();

      // Check if login calendar needs reset (missed a day)
      get().checkLoginCalendarReset();
    } catch {
      // First launch
    }
  },
}));
