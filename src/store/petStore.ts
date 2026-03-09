import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useXpStore } from './xpStore';

export type PetMood = 'excited' | 'happy' | 'content' | 'tired' | 'hungry' | 'sad';
export type PetSkin = 'default' | 'headphones';

// ── Stamina system ──
export const STAMINA_MAX = 100;
export const STAMINA_REGEN_PER_HOUR = 10; // +1 every 6 minutes (base, premium = 20)
export const STAMINA_COSTS: Record<string, number> = {
  feed: 15,
  play: 25,
  rest: 10,
  reflect: 20,
  miniGame: 25,
};

// ── Cooldown durations (milliseconds) — base values, premium halves/removes ──
// Each care variant has its own cooldown key (e.g. 'feed_kibble', 'play_fetch').
// Per-variant keys fall back to action prefix ('feed', 'play', 'rest') for duration lookup.
export const COOLDOWN_DURATIONS: Record<string, number> = {
  feed: 5 * 60 * 1000,       // 5 minutes per feed variant
  play: 8 * 60 * 1000,       // 8 minutes per play variant
  rest: 10 * 60 * 1000,      // 10 minutes per rest variant
  reflect: 4 * 60 * 60 * 1000, // 4 hours
  miniGame_memory: 15 * 60 * 1000,  // 15 minutes
  miniGame_quicktap: 15 * 60 * 1000,
  miniGame_pattern: 20 * 60 * 1000,  // 20 minutes
};

/** Get effective stamina max (level-perk-aware) */
export function getEffectiveStaminaMax(): number {
  try {
    const { getPerksForLevel } = require('./xpStore');
    const level = require('./xpStore').useXpStore.getState().level;
    return STAMINA_MAX + getPerksForLevel(level).maxStaminaBonus;
  } catch {
    return STAMINA_MAX;
  }
}

/** Get effective cooldown duration (premium + level-perk aware) */
export function getEffectiveCooldown(action: string): number {
  // Exact key first, then fall back to action prefix (e.g. 'feed_kibble' → 'feed')
  let base = COOLDOWN_DURATIONS[action];
  if (base === undefined) {
    const underscoreIdx = action.indexOf('_');
    if (underscoreIdx > 0) {
      base = COOLDOWN_DURATIONS[action.substring(0, underscoreIdx)] ?? 0;
    } else {
      base = 0;
    }
  }
  let result = base;
  try {
    const { getPremiumCooldownMultiplier } = require('./premiumStore');
    result = Math.round(result * getPremiumCooldownMultiplier(action));
  } catch {}
  // Level perk cooldown reduction (stacks with premium)
  try {
    const { getPerksForLevel } = require('./xpStore');
    const level = require('./xpStore').useXpStore.getState().level;
    const perks = getPerksForLevel(level);
    if (perks.cooldownReduction > 0) {
      result = Math.round(result * (1 - perks.cooldownReduction));
    }
  } catch {}
  return result;
}

// --- Mood-to-Model mapping ---
// breathing.glb = default idle model, Sad.glb = any stat < 50%
// Excited.glb = burst at 95%+, fallingdown.glb = double-tap easter egg
// Model switching is handled in PetRenderer via activeModel prop.
const DEFAULT_MODEL = require('../../assets/pets/nomi-combined.glb');

export function getModelForMood(_mood: PetMood) {
  return DEFAULT_MODEL;
}

// --- Need messages for the speech bubble ---

export function getPetNeeds(hunger: number, happiness: number, energy: number): string | null {
  const needs: string[] = [];
  if (hunger < 50) needs.push('hunger');
  if (happiness < 50) needs.push('happiness');
  if (energy < 50) needs.push('energy');

  if (needs.length === 0) return null;

  if (needs.length === 3) {
    return "I miss you... please take care of me!";
  }
  if (needs.length === 2) {
    const msgs: Record<string, string> = {
      'hunger,happiness': "I'm hungry and feeling down...",
      'hunger,energy': "Feed me and let me rest...",
      'happiness,energy': "Play with me and let me rest...",
    };
    return msgs[needs.join(',')] ?? "I need some attention...";
  }
  // Single need
  if (needs.includes('hunger')) return "I'm hungry! Feed me please~";
  if (needs.includes('happiness')) return "I'm feeling lonely... play with me!";
  if (needs.includes('energy')) return "So tired... let me rest...";
  return null;
}

// --- Interfaces ---

interface PetState {
  id: string | null;
  name: string;
  ownerName: string;
  mintAddress: string;
  mintTxSignature: string;
  hunger: number;
  happiness: number;
  energy: number;
  skin: PetSkin;
  hasPet: boolean;
  lastTickAt: number;
  lastActiveDate: string;
  streakDays: number;
  isExcitedBurst: boolean; // temporary excited state
  excitedPlayedAt: number; // timestamp of last excited burst (cooldown tracking)
  // Stamina system
  stamina: number;
  lastStaminaRegenAt: number;
  // Cooldown system — maps action key → timestamp when cooldown expires
  cooldowns: Record<string, number>;
  // Oracle's Blessing (level 50 perk)
  lastBlessingAt: number;
}

interface PetActions {
  setOwnerName: (name: string) => void;
  mintPet: (mintAddress?: string, txSignature?: string) => void;
  feedPet: () => void;
  playWithPet: () => void;
  restPet: () => void;
  reflectProductiveDay: () => void;
  reflectNeedRest: () => void;
  reflectFeelGood: () => void;
  setSkin: (skin: PetSkin) => void;
  getMood: () => PetMood;
  getMoodText: () => string;
  clearPet: () => void;
  tick: () => void;
  triggerExcitedBurst: () => void;
  clearExcitedBurst: () => void;
  // Stamina
  getStamina: () => number; // computed stamina after regen
  consumeStamina: (amount: number) => boolean; // returns false if not enough
  canAffordStamina: (action: string) => boolean;
  // Cooldowns
  isOnCooldown: (action: string) => boolean;
  getCooldownRemaining: (action: string) => number; // ms remaining, 0 if ready
  startCooldown: (action: string) => void;
  // Variant-based care action
  performCareAction: (variantId: string) => boolean;
  // On-chain restore
  restoreFromChain: (data: { streak: number; name: string; lastActive: string }) => void;
}

type PetStore = PetState & PetActions;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function generateMintAddress(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let addr = '';
  for (let i = 0; i < 44; i++) {
    addr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return addr;
}

function computeMood(hunger: number, happiness: number, energy: number, isExcitedBurst: boolean): PetMood {
  // Excited ONLY during the one-shot burst (triggered when all stats first cross 95%)
  if (isExcitedBurst) return 'excited';
  // Any stat below 50% → sad model
  if (hunger < 50 || happiness < 50 || energy < 50) {
    if (hunger < 30) return 'hungry';
    if (energy < 30) return 'tired';
    if (happiness < 50) return 'sad';
    return 'sad';
  }
  if (happiness >= 70 && energy >= 50 && hunger >= 50) return 'happy';
  return 'content';
}

function getMoodTextFromMood(name: string, mood: PetMood): string {
  const moodTexts: Record<PetMood, string> = {
    excited: `${name} is SO excited!`,
    happy: `${name} feels happy`,
    content: `${name} feels content`,
    tired: `${name} is exhausted...`,
    hungry: `${name} is starving...`,
    sad: `${name} feels sad`,
  };
  return moodTexts[mood];
}

// --- Manual AsyncStorage persistence (no zustand persist middleware) ---

const STORAGE_KEY = 'oracle-pet-state';

const PERSISTED_KEYS: (keyof PetState)[] = [
  'id', 'name', 'ownerName', 'mintAddress', 'mintTxSignature', 'hunger', 'happiness', 'energy',
  'skin', 'hasPet', 'lastTickAt', 'lastActiveDate', 'streakDays',
  'stamina', 'lastStaminaRegenAt', 'cooldowns', 'lastBlessingAt',
];

export function savePetState(state: PetState) {
  const data: Record<string, any> = {};
  for (const key of PERSISTED_KEYS) {
    data[key] = state[key];
  }
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => { });
}

export async function hydratePetStore() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const patch: Record<string, any> = {};
    for (const key of PERSISTED_KEYS) {
      if (data[key] !== undefined) {
        patch[key] = data[key];
      }
    }
    usePetStore.setState(patch);
  } catch {
    // First launch or corrupted data — use defaults
  }
}

// --- Helper: check if all stats are maxed and trigger excited burst ---

// Triggers excited burst when all three stats are maxed (100).
function checkExcitedTrigger(state: PetStore) {
  if (
    !state.isExcitedBurst &&
    state.hunger >= 100 &&
    state.happiness >= 100 &&
    state.energy >= 100
  ) {
    state.triggerExcitedBurst();
  }
}

// --- Stamina regen helper ---
// Computes current stamina based on time elapsed since last regen update
function computeRegenedStamina(stamina: number, lastRegenAt: number): { stamina: number; lastRegenAt: number } {
  const now = Date.now();
  const elapsedMs = now - lastRegenAt;
  // Use premium-aware regen rate
  let regenRate = STAMINA_REGEN_PER_HOUR;
  try {
    const { getPremiumRegenRate } = require('./premiumStore');
    regenRate = getPremiumRegenRate();
  } catch {}
  const regenPerMs = regenRate / (60 * 60 * 1000);
  const regened = elapsedMs * regenPerMs;
  const maxStamina = getEffectiveStaminaMax();
  const newStamina = Math.min(maxStamina, stamina + regened);
  return { stamina: newStamina, lastRegenAt: now };
}

// --- Helper: get level perk care stat bonus ---
function getCareStatBonus(): number {
  try {
    const { getPerksForLevel } = require('./xpStore');
    const level = require('./xpStore').useXpStore.getState().level;
    return getPerksForLevel(level).careStatBonus;
  } catch {
    return 0;
  }
}

// --- Store ---

export const usePetStore = create<PetStore>((set, get) => ({
  id: null,
  name: 'Nomi',
  ownerName: '',
  mintAddress: '',
  mintTxSignature: '',
  hunger: 35,
  happiness: 45,
  energy: 52,
  skin: 'default',
  hasPet: false,
  lastTickAt: Date.now(),
  lastActiveDate: '',
  streakDays: 0,
  isExcitedBurst: false,
  excitedPlayedAt: 0,
  stamina: STAMINA_MAX,
  lastStaminaRegenAt: Date.now(),
  cooldowns: {},
  lastBlessingAt: 0,

  setOwnerName: (ownerName: string) => {
    set({ ownerName });
    savePetState(get());
  },

  triggerExcitedBurst: () => {
    set({ isExcitedBurst: true, excitedPlayedAt: Date.now() });
  },

  clearExcitedBurst: () => {
    set({ isExcitedBurst: false });
  },

  // ── Stamina actions ──
  getStamina: () => {
    // Pure computation — no set() calls, safe to use during render
    const { stamina, lastStaminaRegenAt } = get();
    const result = computeRegenedStamina(stamina, lastStaminaRegenAt);
    return Math.floor(result.stamina);
  },

  consumeStamina: (amount: number) => {
    // Flush regen before consuming
    const { stamina, lastStaminaRegenAt } = get();
    const result = computeRegenedStamina(stamina, lastStaminaRegenAt);
    const current = Math.floor(result.stamina);
    if (current < amount) return false;
    set({ stamina: current - amount, lastStaminaRegenAt: Date.now() });
    savePetState(get());
    return true;
  },

  canAffordStamina: (action: string) => {
    const cost = STAMINA_COSTS[action] ?? 0;
    if (cost === 0) return true;
    return get().getStamina() >= cost;
  },

  // ── Cooldown actions ──
  isOnCooldown: (action: string) => {
    const expires = get().cooldowns[action] ?? 0;
    return Date.now() < expires;
  },

  getCooldownRemaining: (action: string) => {
    const expires = get().cooldowns[action] ?? 0;
    return Math.max(0, expires - Date.now());
  },

  startCooldown: (action: string) => {
    const duration = getEffectiveCooldown(action);
    if (duration === 0) return;
    const { cooldowns } = get();
    set({ cooldowns: { ...cooldowns, [action]: Date.now() + duration } });
    savePetState(get());
  },

  mintPet: (realMintAddress?: string, txSignature?: string) => {
    set({
      id: `pet_${Date.now()}`,
      mintAddress: realMintAddress || generateMintAddress(),
      mintTxSignature: txSignature || '',
      hasPet: true,
      hunger: 35,
      happiness: 45,
      energy: 52,
    });
    savePetState(get());
  },

  feedPet: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.feed)) return;
    self.startCooldown('feed');
    const bonus = getCareStatBonus();
    set((state) => ({
      hunger: clamp(state.hunger + 25 + bonus, 0, 100),
      happiness: clamp(state.happiness + 5 + bonus, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    // Personality
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('fed');
      ps.updateTraits('fed');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(8, 'feed');
    xp.incrementCounter('feedCount');
    xp.updateQuestProgress('feed');
    const s = get();
    xp.checkAchievements({ hunger: s.hunger, happiness: s.happiness, energy: s.energy });
    xp.checkWellnessXp(s.hunger, s.happiness, s.energy);
  },

  playWithPet: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.play)) return;
    self.startCooldown('play');
    const bonus = getCareStatBonus();
    set((state) => ({
      happiness: clamp(state.happiness + 20 + bonus, 0, 100),
      energy: clamp(state.energy - 15, 0, 100),
      hunger: clamp(state.hunger - 10, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('played');
      ps.updateTraits('played');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(12, 'play');
    xp.incrementCounter('playCount');
    xp.updateQuestProgress('play');
    const s = get();
    xp.checkAchievements({ hunger: s.hunger, happiness: s.happiness, energy: s.energy });
  },

  restPet: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.rest)) return;
    self.startCooldown('rest');
    const bonus = getCareStatBonus();
    set((state) => ({
      energy: clamp(state.energy + 30 + bonus, 0, 100),
      happiness: clamp(state.happiness + 5 + bonus, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('rested');
      ps.updateTraits('rested');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(5, 'rest');
    xp.incrementCounter('restCount');
    xp.updateQuestProgress('rest');
    const s = get();
    xp.checkWellnessXp(s.hunger, s.happiness, s.energy);
  },

  performCareAction: (variantId: string) => {
    const { ALL_CARE_VARIANTS } = require('../data/careVariants');
    const variant = ALL_CARE_VARIANTS.find((v: any) => v.id === variantId);
    if (!variant) return false;

    const self = get();

    // Check unlock condition
    if (variant.unlockCondition && variant.unlockCondition.type !== 'none') {
      if (variant.unlockCondition.type === 'level') {
        const level = useXpStore.getState().level;
        if (level < (variant.unlockCondition.value ?? 0)) return false;
      }
      if (variant.unlockCondition.type === 'premium') {
        const { getCurrentTier, isAtLeastTier } = require('./premiumStore');
        if (!isAtLeastTier(getCurrentTier(), variant.unlockCondition.tierRequired)) return false;
      }
    }

    // Check cooldown
    if (self.isOnCooldown(variant.cooldownKey)) return false;

    // Check & consume stamina
    if (!self.consumeStamina(variant.staminaCost)) return false;

    // Start cooldown
    self.startCooldown(variant.cooldownKey);

    // Apply stat effects with level perk bonus
    const bonus = getCareStatBonus();
    const fx = variant.statEffects;
    set((state: PetState) => ({
      hunger: clamp(state.hunger + fx.hunger + (fx.hunger > 0 ? bonus : 0), 0, 100),
      happiness: clamp(state.happiness + fx.happiness + (fx.happiness > 0 ? bonus : 0), 0, 100),
      energy: clamp(state.energy + fx.energy + (fx.energy > 0 ? bonus : 0), 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());

    // Personality
    const memoryMap: Record<string, string> = { feed: 'fed', play: 'played', rest: 'rested' };
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory(memoryMap[variant.action] ?? variant.action);
      ps.updateTraits(memoryMap[variant.action] ?? variant.action);
    } catch {}

    // XP + quest progress
    const xp = useXpStore.getState();
    xp.addXp(variant.xpReward, variant.action);
    const counterMap: Record<string, string> = { feed: 'feedCount', play: 'playCount', rest: 'restCount' };
    if (counterMap[variant.action]) {
      xp.incrementCounter(counterMap[variant.action] as any);
    }
    xp.updateQuestProgress(variant.action as any);

    const s = get();
    xp.checkAchievements({ hunger: s.hunger, happiness: s.happiness, energy: s.energy });
    if (variant.action === 'feed' || variant.action === 'rest') {
      xp.checkWellnessXp(s.hunger, s.happiness, s.energy);
    }

    return true;
  },

  reflectProductiveDay: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.reflect)) return;
    self.startCooldown('reflect');
    const bonus = getCareStatBonus();
    set((state) => ({
      happiness: clamp(state.happiness + 15 + bonus, 0, 100),
      energy: clamp(state.energy + 5 + bonus, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(20, 'reflect');
    xp.incrementCounter('reflectCount');
    xp.updateQuestProgress('reflect');
  },

  reflectNeedRest: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.reflect)) return;
    self.startCooldown('reflect');
    const bonus = getCareStatBonus();
    set((state) => ({
      energy: clamp(state.energy + 20 + bonus, 0, 100),
      happiness: clamp(state.happiness + 10 + bonus, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(20, 'reflect');
    xp.incrementCounter('reflectCount');
    xp.updateQuestProgress('reflect');
  },

  reflectFeelGood: () => {
    const self = get();
    if (!self.consumeStamina(STAMINA_COSTS.reflect)) return;
    self.startCooldown('reflect');
    const bonus = getCareStatBonus();
    set((state) => ({
      happiness: clamp(state.happiness + 20 + bonus, 0, 100),
      energy: clamp(state.energy + 10 + bonus, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
    try {
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
    } catch {}
    const xp = useXpStore.getState();
    xp.addXp(20, 'reflect');
    xp.incrementCounter('reflectCount');
    xp.updateQuestProgress('reflect');
  },

  setSkin: (skin: PetSkin) => {
    set({ skin });
    savePetState(get());
  },

  getMood: () => {
    const { hunger, happiness, energy, isExcitedBurst } = get();
    return computeMood(hunger, happiness, energy, isExcitedBurst);
  },

  getMoodText: () => {
    const { name, hunger, happiness, energy, isExcitedBurst } = get();
    const mood = computeMood(hunger, happiness, energy, isExcitedBurst);
    return getMoodTextFromMood(name, mood);
  },

  clearPet: () => {
    set({
      id: null,
      ownerName: '',
      mintAddress: '',
      mintTxSignature: '',
      hasPet: false,
      hunger: 35,
      happiness: 45,
      energy: 52,
      skin: 'default',
      lastTickAt: Date.now(),
      lastActiveDate: '',
      streakDays: 0,
      isExcitedBurst: false,
      excitedPlayedAt: 0,
      stamina: STAMINA_MAX,
      lastStaminaRegenAt: Date.now(),
      cooldowns: {},
      lastBlessingAt: 0,
    });
    savePetState(get());
  },

  tick: () => {
    const now = Date.now();
    const { lastTickAt, lastActiveDate, streakDays, stamina, lastStaminaRegenAt } = get();
    const elapsedMs = now - lastTickAt;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Skip tiny intervals (< 6 minutes)
    if (elapsedHours < 0.1) return;

    // Stat decay: happiness drops FASTEST (loneliness), hunger next, energy slowest
    // ~5 pts/hr happiness, ~3 pts/hr hunger, ~2 pts/hr energy
    // Capped at 40 max decay so the pet is never completely zeroed after a long absence
    const happinessDecay = Math.min(elapsedHours * 5, 40);
    const hungerDecay = Math.min(elapsedHours * 3, 40);
    const energyDecay = Math.min(elapsedHours * 2, 40);

    // Stamina regen
    const regen = computeRegenedStamina(stamina, lastStaminaRegenAt);

    set((state) => ({
      hunger: clamp(state.hunger - hungerDecay, 0, 100),
      happiness: clamp(state.happiness - happinessDecay, 0, 100),
      energy: clamp(state.energy - energyDecay, 0, 100),
      lastTickAt: now,
      stamina: regen.stamina,
      lastStaminaRegenAt: regen.lastRegenAt,
    }));

    // Generate diary entry if away 2+ hours
    if (elapsedHours >= 2) {
      try {
        const ps = require('./personalityStore').usePersonalityStore.getState();
        const state = get();
        const adventureStore = require('./adventureStore').useAdventureStore.getState();
        const activeZone = adventureStore.activeAdventure
          ? require('./adventureStore').ADVENTURE_ZONES.find((z: any) => z.id === adventureStore.activeAdventure.zoneId)?.name
          : undefined;
        ps.generateDiaryEntry({
          hunger: state.hunger,
          happiness: state.happiness,
          energy: state.energy,
          mood: computeMood(state.hunger, state.happiness, state.energy, false),
          equippedSkin: state.skin,
          hoursAway: elapsedHours,
          activeAdventureZone: activeZone,
          ownerName: state.ownerName,
        });
        if (elapsedHours >= 6) {
          ps.recordMemory('long_absence');
        }
      } catch {}
    }

    // Daily streak tracking
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastActiveDate) {
      const yd = new Date(now); yd.setDate(yd.getDate() - 1);
      const yesterday = yd.toISOString().slice(0, 10);
      const newStreak = lastActiveDate === yesterday ? streakDays + 1 : 1;
      const streakBonus = Math.min(newStreak * 2, 10);

      set((state) => ({
        lastActiveDate: today,
        streakDays: newStreak,
        happiness: clamp(state.happiness + streakBonus, 0, 100),
      }));

      // XP for daily login + streak
      const xp = useXpStore.getState();
      xp.addXp(20, 'daily-login');
      xp.addXp(Math.min(newStreak * 5, 25), 'streak-bonus');
      xp.checkAndRefreshQuests();
      xp.checkAchievements({ streakDays: newStreak });
    }

    // Oracle's Blessing (level 50 perk): +1 to all stats every 10 minutes
    try {
      const { getPerksForLevel } = require('./xpStore');
      const level = require('./xpStore').useXpStore.getState().level;
      const perks = getPerksForLevel(level);
      if (perks.oracleBlessing) {
        const { lastBlessingAt } = get();
        const blessingInterval = 10 * 60 * 1000; // 10 minutes
        const intervals = Math.floor((now - (lastBlessingAt || now)) / blessingInterval);
        if (intervals > 0) {
          const boost = Math.min(intervals, 6); // cap at 6 (1 hour of absence)
          set((state) => ({
            hunger: clamp(state.hunger + boost, 0, 100),
            happiness: clamp(state.happiness + boost, 0, 100),
            energy: clamp(state.energy + boost, 0, 100),
            lastBlessingAt: now,
          }));
        }
      }
    } catch {}

    savePetState(get());
  },

  restoreFromChain: (data: { streak: number; name: string; lastActive: string }) => {
    set({
      streakDays: data.streak,
      name: data.name,
      lastActiveDate: data.lastActive,
      hasPet: true,
    });
    savePetState(get());
    console.log('[petStore] restoreFromChain — restored:', data);
  },
}));
