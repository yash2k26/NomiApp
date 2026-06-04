import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useXpStore } from './xpStore';
import { events } from '../lib/analytics';

// 48h was the original window. The audit caught that a long-streak user who
// breaks at the start of a busy work week can lose the repair offer entirely.
// Now scaled by streak length so a 60-day streak gets a full week to come back.
export const STREAK_REPAIR_WINDOW_MS = 48 * 60 * 60 * 1000; // legacy export — default

export function getStreakRepairWindowMs(brokenFromStreak: number): number {
  if (brokenFromStreak >= 60) return 7 * 24 * 60 * 60 * 1000; // 7 days
  if (brokenFromStreak >= 30) return 5 * 24 * 60 * 60 * 1000; // 5 days
  return 48 * 60 * 60 * 1000; // 48 hours
}

// Local-timezone date string. The previous code used `toISOString().slice(0,10)`
// which is UTC — so a PST user opening the app at 4pm (midnight UTC) would
// silently roll over the date and lose a day off their streak. This returns
// the user's local-calendar date instead.
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse a YYYY-MM-DD string as a local date (matching getLocalDateString) so
// daysMissed math doesn't double-count the UTC vs local skew.
function parseLocalDateMs(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

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
  reflect: 30 * 60 * 1000, // 30 minutes — short enough that the personality
                           // and diary system (which only fire on reflect) is
                           // actually reachable in a normal play session.
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
    return "i'm a small disaster, send everything halp";
  }
  if (needs.length === 2) {
    const msgs: Record<string, string> = {
      'hunger,happiness': "lonely AND empty. catastrophic combo.",
      'hunger,energy': "tired tummy, sleepy soul, save me",
      'happiness,energy': "nap + cuddle, that's the entire prescription",
    };
    return msgs[needs.join(',')] ?? "i need... something. SOMETHING.";
  }
  // Single need
  if (needs.includes('hunger')) return "treat alarm: low. critically low.";
  if (needs.includes('happiness')) return "i need attention. literally any attention.";
  if (needs.includes('energy')) return "eyelids... too... heavy... save... me...";
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
  // Streak freeze — preserve streak when missing a day
  streakFreezes: number;
  lastFreezeRefillDate: string; // ISO date when last weekly free freeze was granted
  // Post-break repair offer — when streak resets from a meaningful length, the
  // last value is preserved so the user can pay/spend a freeze to restore it.
  // 0 / 0 means no offer active.
  lastBrokenStreak: number;
  streakBrokenAt: number; // Date.now() of break; offer expires after STREAK_REPAIR_WINDOW_MS
  // Welcome-back bonus tracking — populated when a returning user (pet found
  // via holdings scan, no local progress) is granted a one-time apology
  // package. Persisted so the modal doesn't re-fire and the bonus doesn't
  // re-apply on subsequent app launches.
  welcomeBackBonusAppliedAt: number; // 0 if never applied
  // Referral — has the user already redeemed a friend's referral code
  referralRedeemed: boolean;
  // Tracks which NFT we've already written a retroactive `oracle-pet:mint`
  // memo for. Without this, the purchaseRestore flow would re-write a fresh
  // memo on every single app open whenever the memo-lookup RPC call gets
  // rate-limited and silently returns empty — burning real tx fees and
  // popping a wallet prompt every launch. We saw users in the wild with 7+
  // duplicate mint memos for the same NFT before this guard existed.
  retroactiveMintMemoWrittenFor: string | null;
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
  // Streak-break repair offer — `applyStreakRepair` restores streakDays to the
  // pre-break value and clears the offer; pass useFreeze: true to also consume
  // a streak freeze (free path). Direct/paid paths handle payment in the caller.
  /** Returns true on success, false on silent no-op (window expired / no
   *  freezes / no broken streak). Awaits the AsyncStorage persist before
   *  resolving so callers can show "Streak restored" only after the change
   *  is actually durable. Callers must check before showing success toasts
   *  or charging on-chain. */
  applyStreakRepair: (opts?: { useFreeze?: boolean; cost_sol?: number; cost_skr?: number }) => Promise<boolean>;
  dismissStreakRepair: () => void;
  consumeStamina: (amount: number) => boolean; // returns false if not enough
  canAffordStamina: (action: string) => boolean;
  // Cooldowns
  isOnCooldown: (action: string) => boolean;
  getCooldownRemaining: (action: string) => number; // ms remaining, 0 if ready
  startCooldown: (action: string) => void;
  // Skip cooldown for a single action (or all variants matching prefix). Clears the timer.
  skipCooldown: (actionPrefix: string) => void;
  // Variant-based care action
  performCareAction: (variantId: string) => boolean;
  // On-chain restore
  restoreFromChain: (data: { streak: number; name: string; lastActive: string }) => void;
  restoreFromMint: (data: { mintAddress: string; mintTxSignature: string; name: string; ownerName: string }) => void;
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
    excited: `${name} is BUZZING with joy!`,
    happy: `${name} is feeling sunshiney~`,
    content: `${name} is just chillin'`,
    tired: `${name} is barely awake...`,
    hungry: `${name} would commit minor crimes for snacks`,
    sad: `${name}'s heart is doing the slow thing`,
  };
  return moodTexts[mood];
}

// --- Manual AsyncStorage persistence (no zustand persist middleware) ---

const STORAGE_KEY = 'oracle-pet-state';

const PERSISTED_KEYS: (keyof PetState)[] = [
  'id', 'name', 'ownerName', 'mintAddress', 'mintTxSignature', 'hunger', 'happiness', 'energy',
  'skin', 'hasPet', 'lastTickAt', 'lastActiveDate', 'streakDays',
  'stamina', 'lastStaminaRegenAt', 'cooldowns', 'lastBlessingAt',
  'streakFreezes', 'lastFreezeRefillDate',
  'lastBrokenStreak', 'streakBrokenAt',
  'welcomeBackBonusAppliedAt',
  'referralRedeemed',
  'retroactiveMintMemoWrittenFor',
];

/**
 * Persists pet state. Resolves true on success, false on failure (NEVER
 * rejects, so non-awaiting callers don't get unhandled promise rejections).
 * Failures previously vanished entirely; now they emit a telemetry event so
 * we can spot storage corruption in the wild, and callers who care (the
 * streak repair modal) can check the boolean and surface a warning.
 */
export function savePetState(state: PetState): Promise<boolean> {
  const data: Record<string, any> = {};
  for (const key of PERSISTED_KEYS) {
    data[key] = state[key];
  }
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    .then(() => true)
    .catch((err) => {
      try {
        const { captureError } = require('../lib/analytics');
        captureError(err, { surface: 'savePetState' });
      } catch {}
      return false;
    });
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
  hunger: 70,
  happiness: 70,
  energy: 70,
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
  streakFreezes: 1, // start with one free freeze
  lastFreezeRefillDate: '',
  lastBrokenStreak: 0,
  streakBrokenAt: 0,
  welcomeBackBonusAppliedAt: 0,
  referralRedeemed: false,
  retroactiveMintMemoWrittenFor: null,

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

  applyStreakRepair: async (opts) => {
    // Returns true ONLY when the repair was applied AND persisted. Previously
    // the persist was fire-and-forget so the modal could dismiss with a
    // success toast while the AsyncStorage write was still in flight — if
    // the write failed, both the freeze deduction and the streak restore
    // were lost on next launch but the user already saw "Streak restored".
    const { lastBrokenStreak, streakBrokenAt, streakFreezes } = get();
    if (!lastBrokenStreak || lastBrokenStreak < 1) return false;
    if (Date.now() - streakBrokenAt > getStreakRepairWindowMs(lastBrokenStreak)) return false;
    if (opts?.useFreeze && streakFreezes < 1) return false;

    set({
      streakDays: lastBrokenStreak,
      lastBrokenStreak: 0,
      streakBrokenAt: 0,
      streakFreezes: opts?.useFreeze ? streakFreezes - 1 : streakFreezes,
    });
    const saved = await savePetState(get());
    if (!saved) {
      // Persist failed. The in-memory state is updated, so the user sees the
      // restore for this session, but on next launch the streak will revert.
      // Surface telemetry; callers will still see `true` because the apply
      // succeeded — the user's payment was honored — but we have a paper
      // trail if they complain about losing it later.
      try {
        const { captureError } = require('../lib/analytics');
        captureError(new Error('streak-repair persist failed'), {
          surface: 'applyStreakRepair',
          used_freeze: !!opts?.useFreeze,
          cost_sol: opts?.cost_sol,
          cost_skr: opts?.cost_skr,
        });
      } catch {}
    }

    try {
      events.streakRepairUsed({
        days_repaired: lastBrokenStreak,
        cost_sol: opts?.cost_sol,
        cost_skr: opts?.cost_skr,
      });
    } catch {}
    return true;
  },

  dismissStreakRepair: () => {
    // Clear the offer without restoring — user accepted the loss.
    set({ lastBrokenStreak: 0, streakBrokenAt: 0 });
    savePetState(get());
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

  skipCooldown: (actionPrefix: string) => {
    const { cooldowns } = get();
    const next = { ...cooldowns };
    let cleared = 0;
    for (const key of Object.keys(next)) {
      if (key === actionPrefix || key.startsWith(`${actionPrefix}-`) || key.startsWith(`${actionPrefix}/`)) {
        delete next[key];
        cleared++;
      }
    }
    if (cleared > 0) {
      set({ cooldowns: next });
      savePetState(get());
    }
  },

  mintPet: (realMintAddress?: string, txSignature?: string) => {
    set({
      id: `pet_${Date.now()}`,
      mintAddress: realMintAddress || generateMintAddress(),
      mintTxSignature: txSignature || '',
      hasPet: true,
      hunger: 80,
      happiness: 80,
      energy: 80,
    });
    savePetState(get());
    try {
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.setCurrentDialogue(mod.getActionDialogue('minted', ps.traits, get().ownerName));
    } catch {}
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('fed');
      ps.updateTraits('fed');
      ps.setCurrentDialogue(mod.getActionDialogue('fed', ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('played');
      ps.updateTraits('played');
      ps.setCurrentDialogue(mod.getActionDialogue('played', ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('rested');
      ps.updateTraits('rested');
      ps.setCurrentDialogue(mod.getActionDialogue('rested', ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      const action = memoryMap[variant.action] ?? variant.action;
      ps.recordMemory(action);
      ps.updateTraits(action);
      ps.setCurrentDialogue(mod.getActionDialogue(action, ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
      ps.setCurrentDialogue(mod.getActionDialogue('reflected', ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
      ps.setCurrentDialogue(mod.getActionDialogue('reflected', ps.traits, get().ownerName));
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
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      ps.recordMemory('reflected');
      ps.updateTraits('reflected');
      ps.setCurrentDialogue(mod.getActionDialogue('reflected', ps.traits, get().ownerName));
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
    // Reset every persisted field — used as the cascade-clear target on
    // wallet disconnect, so anything we leave alone here leaks across user
    // switches on the same device. Defaults must match the store's initial
    // state declared at the top of create().
    set({
      id: null,
      name: 'Nomi',
      ownerName: '',
      mintAddress: '',
      mintTxSignature: '',
      hasPet: false,
      hunger: 70,
      happiness: 70,
      energy: 70,
      skin: 'default',
      lastTickAt: Date.now(),
      lastActiveDate: '',
      streakDays: 0,
      isExcitedBurst: false,
      excitedPlayedAt: 0, // companion to isExcitedBurst — must reset together
      stamina: STAMINA_MAX,
      lastStaminaRegenAt: Date.now(),
      cooldowns: {},
      lastBlessingAt: 0,
      // Streak/freeze + welcome-back + trial + referral state must reset too —
      // otherwise User B inherits User A's freezes, "already-applied" bonus
      // flag, and trial timer.
      streakFreezes: 1,
      lastFreezeRefillDate: '',
      lastBrokenStreak: 0,
      streakBrokenAt: 0,
      welcomeBackBonusAppliedAt: 0,
      referralRedeemed: false,
      retroactiveMintMemoWrittenFor: null,
    });
    savePetState(get());
  },

  tick: () => {
    const now = Date.now();
    const { lastTickAt, lastActiveDate, streakDays, stamina, lastStaminaRegenAt } = get();
    const elapsedMs = now - lastTickAt;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Skip tiny intervals (< 6 minutes) for stat decay / stamina regen — but
    // NOT for the date-based daily-streak block below. Previously this early
    // return meant a user who opened the app at 23:58 then again at 00:01
    // (elapsed ~3 min, but a new calendar day) silently skipped the streak
    // advance until a later open. The streak block is calendar-date driven,
    // not elapsed-time driven, so it must run regardless.
    const skipDecay = elapsedHours < 0.1;

    if (!skipDecay) {
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
    }

    // Generate diary entry if away 2+ hours
    if (!skipDecay && elapsedHours >= 2) {
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

    // Daily streak tracking — LOCAL DATE, not UTC. Previously a PST user
    // opening the app at 4pm would silently roll over to the next UTC day
    // and lose a day of streak. Now mirrors the user's calendar.
    const today = getLocalDateString();
    if (today !== lastActiveDate) {
      const yd = new Date(now); yd.setDate(yd.getDate() - 1);
      const yesterday = getLocalDateString(yd);

      // Compute days missed since last visit (excluding today's visit) —
      // parsing the stored date as LOCAL so the subtraction matches the
      // calendar, not UTC. Off-by-one from DST is still possible but bounded
      // to one day per transition.
      const { streakFreezes, lastFreezeRefillDate } = get();
      let daysMissed = 0;
      if (lastActiveDate && lastActiveDate !== yesterday) {
        const lastMs = parseLocalDateMs(lastActiveDate);
        const todayMs = parseLocalDateMs(today);
        daysMissed = Math.max(0, Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24)) - 1);
      }

      let consumedFreezes = 0;
      let newStreak: number;
      let brokeFromStreak = 0; // captures the lost streak length if reset happens
      if (lastActiveDate === yesterday) {
        // No gap — streak continues, today was earned
        newStreak = streakDays + 1;
      } else if (lastActiveDate && daysMissed > 0 && streakFreezes >= daysMissed) {
        // Use freezes to cover gap, streak continues (today still counts as earned —
        // the user IS opening the app today, freezes covered the missed days)
        consumedFreezes = daysMissed;
        newStreak = streakDays + 1;
      } else {
        // Not enough freezes — streak resets. Lowered threshold from 3 to 1
        // so even short streaks get the repair offer (the freeze path is free).
        newStreak = 1;
        if (streakDays >= 1) brokeFromStreak = streakDays;
      }

      // Weekly free freeze refill. The audit flagged a bug here: the cap of 3
      // was being applied to ALL freezes via Math.min, which silently deleted
      // freezes the user had PAID for above the cap. Now the cap only gates the
      // weekly free grant — purchased freezes stack above it.
      const FREEZE_CAP = 3;             // ceiling for the WEEKLY free grant
      const FREEZE_HARD_MAX = 99;       // safety ceiling overall
      const REFILL_INTERVAL_DAYS = 7;
      const remainingAfterConsume = streakFreezes - consumedFreezes;
      const eligibleForBonus = remainingAfterConsume < FREEZE_CAP;
      let bonusFreeze = 0;
      if (!lastFreezeRefillDate) {
        if (eligibleForBonus) bonusFreeze = 1;
      } else {
        const lastRefillMs = parseLocalDateMs(lastFreezeRefillDate);
        const todayMs = parseLocalDateMs(today);
        const daysSinceRefill = Math.floor((todayMs - lastRefillMs) / (1000 * 60 * 60 * 24));
        if (daysSinceRefill >= REFILL_INTERVAL_DAYS && eligibleForBonus) bonusFreeze = 1;
      }

      const finalFreezes = Math.min(FREEZE_HARD_MAX, remainingAfterConsume + bonusFreeze);
      const streakBonus = Math.min(newStreak * 2, 10);

      set((state) => ({
        lastActiveDate: today,
        streakDays: newStreak,
        happiness: clamp(state.happiness + streakBonus, 0, 100),
        streakFreezes: finalFreezes,
        // Only update refill-date when we actually granted a bonus — previously
        // updating it on every tick burned the weekly grant even when capped.
        lastFreezeRefillDate: bonusFreeze > 0 ? today : state.lastFreezeRefillDate,
        ...(brokeFromStreak > 0
          ? { lastBrokenStreak: brokeFromStreak, streakBrokenAt: now }
          : {}),
      }));

      // User-visible feedback when a freeze actually saved the streak. Previously
      // freezes vanished silently and users had no way to know they'd been
      // protected — only that "Day 12" was still on the badge somehow.
      if (consumedFreezes > 0) {
        try {
          const { notify } = require('../lib/notify');
          notify.success(
            `Freeze saved your ${newStreak}-day streak`,
            `Used ${consumedFreezes} · ${finalFreezes} left`,
            { category: 'streak' },
          );
        } catch {}
      }

      if (brokeFromStreak > 0) {
        try { events.streakBroken({ previous_streak: brokeFromStreak }); } catch {}
      }

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

  restoreFromMint: (data: { mintAddress: string; mintTxSignature: string; name: string; ownerName: string }) => {
    // Mint memo restore — establishes pet identity (name, mint addr) without
    // overwriting stats. Lets users recover ownership after reinstall.
    const existing = get();
    set({
      mintAddress: data.mintAddress,
      mintTxSignature: data.mintTxSignature,
      name: data.name || existing.name || 'Nomi',
      ownerName: existing.ownerName || data.ownerName || '',
      hasPet: true,
    });
    savePetState(get());
    console.log('[petStore] restoreFromMint — restored mint identity:', data.mintAddress);
  },
}));
