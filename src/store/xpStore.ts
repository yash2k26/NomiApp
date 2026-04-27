import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const XP_STORAGE_KEY = 'oracle-pet-xp';

// ── Leveling formula (steeper curve) ──
// xpRequired(level) = 150 + (level-1)*75 + floor((level-1)/5)*100
export function xpRequiredForLevel(level: number): number {
  return 150 + (level - 1) * 75 + Math.floor((level - 1) / 5) * 100;
}

// ── XP Multiplier based on pet stats ──
// Any stat < 30 → 0.5x penalty, all > 80 → 1.5x, all 100 → 2x
export function getXpMultiplier(hunger: number, happiness: number, energy: number): number {
  if (hunger < 30 || happiness < 30 || energy < 30) return 0.5;
  if (hunger >= 100 && happiness >= 100 && energy >= 100) return 2.0;
  if (hunger >= 80 && happiness >= 80 && energy >= 80) return 1.5;
  return 1.0;
}

export const MAX_LEVEL = 50;

// ── Level titles ──
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Newborn',
  3: 'Explorer',
  5: 'Buddy',
  7: 'Caretaker',
  10: 'Companion',
  15: 'Best Friend',
  20: 'Guardian',
  25: 'Elder',
  30: 'Legend',
  40: 'Mythic',
  50: 'Oracle',
};

export function getTitleForLevel(level: number): string {
  let title = 'Newborn';
  for (const [lvl, t] of Object.entries(LEVEL_TITLES)) {
    if (level >= Number(lvl)) title = t;
  }
  return title;
}

// ── Level rewards (free shop item unlocks) ──
export const LEVEL_REWARDS: Record<number, { type: 'item' | 'title'; value: string }[]> = {
  5: [{ type: 'title', value: 'Buddy' }],
  10: [{ type: 'title', value: 'Companion' }],
  15: [{ type: 'title', value: 'Best Friend' }],
  20: [{ type: 'title', value: 'Guardian' }],
  30: [{ type: 'title', value: 'Legend' }],
  50: [{ type: 'title', value: 'Oracle' }],
};

// ── Level Perks (tangible gameplay rewards at milestone levels) ──
export const LEVEL_PERKS: Record<number, { type: string; label: string }> = {
  3:  { type: 'maxStamina',      label: '+5 Max Stamina' },
  5:  { type: 'shopDiscount',    label: '5% Shop Discount' },
  7:  { type: 'maxStamina',      label: '+5 Max Stamina' },
  10: { type: 'freeSpins',       label: '+1 Free Daily Spin' },
  12: { type: 'cooldownReduce',  label: '10% Cooldown Reduction' },
  15: { type: 'maxStamina',      label: '+10 Max Stamina' },
  18: { type: 'extraEvents',     label: '+1 Daily Event' },
  20: { type: 'shopDiscount',    label: '10% Shop Discount' },
  22: { type: 'maxStamina',      label: '+5 Max Stamina' },
  25: { type: 'careStat',        label: '+2 Care Action Bonus' },
  28: { type: 'cooldownReduce',  label: '20% Cooldown Reduction' },
  30: { type: 'freeSpins',       label: '+1 Free Daily Spin' },
  33: { type: 'maxStamina',      label: '+10 Max Stamina' },
  35: { type: 'shopDiscount',    label: '15% Shop Discount' },
  38: { type: 'lootBonus',       label: '+5% Loot Bonus' },
  40: { type: 'xpMultiplier',    label: '+0.15x XP Multiplier' },
  42: { type: 'extraEvents',     label: '+1 Daily Event' },
  45: { type: 'careStat',        label: '+4 Care Action Bonus' },
  48: { type: 'lootBonus',       label: '+10% Loot Bonus' },
  50: { type: 'oracleBlessing',  label: "Oracle's Blessing: +1 all stats/10min" },
};

export interface LevelPerks {
  maxStaminaBonus: number;
  shopDiscount: number;
  cooldownReduction: number;
  freeSpinBonus: number;
  extraEventsPerDay: number;
  careStatBonus: number;
  lootBonus: number;
  xpMultiplierBonus: number;
  oracleBlessing: boolean;
}

/** Returns cumulative perks active at a given level */
export function getPerksForLevel(level: number): LevelPerks {
  const perks: LevelPerks = {
    maxStaminaBonus: 0,
    shopDiscount: 0,
    cooldownReduction: 0,
    freeSpinBonus: 0,
    extraEventsPerDay: 0,
    careStatBonus: 0,
    lootBonus: 0,
    xpMultiplierBonus: 0,
    oracleBlessing: false,
  };

  for (const [lvl, perk] of Object.entries(LEVEL_PERKS)) {
    if (level < Number(lvl)) continue;
    switch (perk.type) {
      case 'maxStamina': {
        const val = perk.label.includes('+10') ? 10 : 5;
        perks.maxStaminaBonus += val;
        break;
      }
      case 'shopDiscount':
        perks.shopDiscount = perk.label.includes('15%') ? 0.15 : perk.label.includes('10%') ? 0.10 : 0.05;
        break;
      case 'cooldownReduce':
        perks.cooldownReduction = perk.label.includes('20%') ? 0.20 : 0.10;
        break;
      case 'freeSpins':
        perks.freeSpinBonus += 1;
        break;
      case 'extraEvents':
        perks.extraEventsPerDay += 1;
        break;
      case 'careStat':
        perks.careStatBonus = perk.label.includes('+4') ? 4 : 2;
        break;
      case 'lootBonus':
        perks.lootBonus = perk.label.includes('10%') ? 0.10 : 0.05;
        break;
      case 'xpMultiplier':
        perks.xpMultiplierBonus = 0.15;
        break;
      case 'oracleBlessing':
        perks.oracleBlessing = true;
        break;
    }
  }

  return perks;
}

/** Returns the next level that has a perk unlock, or null if at/past max */
export function getNextPerkLevel(currentLevel: number): number | null {
  const levels = Object.keys(LEVEL_PERKS).map(Number).sort((a, b) => a - b);
  return levels.find(l => l > currentLevel) ?? null;
}

// ── Daily Quests ──
export type QuestType = 'feed' | 'play' | 'rest' | 'reflect' | 'equip' | 'allStats';

export interface DailyQuest {
  id: string;
  description: string;
  type: QuestType;
  target: number;
  progress: number;
  xpReward: number;
  completed: boolean;
}

const QUEST_POOL: Omit<DailyQuest, 'progress' | 'completed'>[] = [
  { id: 'feed-3', description: 'Feed Nomi 3 times', type: 'feed', target: 3, xpReward: 30 },
  { id: 'feed-5', description: 'Feed Nomi 5 times', type: 'feed', target: 5, xpReward: 45 },
  { id: 'play-2', description: 'Play with Nomi 2 times', type: 'play', target: 2, xpReward: 35 },
  { id: 'play-4', description: 'Play with Nomi 4 times', type: 'play', target: 4, xpReward: 50 },
  { id: 'rest-2', description: 'Rest Nomi 2 times', type: 'rest', target: 2, xpReward: 25 },
  { id: 'rest-3', description: 'Rest Nomi 3 times', type: 'rest', target: 3, xpReward: 35 },
  { id: 'reflect-1', description: 'Complete a reflection', type: 'reflect', target: 1, xpReward: 25 },
  { id: 'reflect-2', description: 'Complete 2 reflections', type: 'reflect', target: 2, xpReward: 40 },
  { id: 'equip-1', description: 'Equip a different outfit', type: 'equip', target: 1, xpReward: 20 },
  { id: 'allStats-80', description: 'Get all stats above 80%', type: 'allStats', target: 80, xpReward: 40 },
  { id: 'feed-2', description: 'Feed Nomi 2 times', type: 'feed', target: 2, xpReward: 20 },
  { id: 'play-3', description: 'Play with Nomi 3 times', type: 'play', target: 3, xpReward: 40 },
];

function generateDailyQuestsFromSeed(seed: number): DailyQuest[] {
  // Use day-of-year as seed to deterministically pick 3 quests
  const shuffled = [...QUEST_POOL].sort((a, b) => {
    const hashA = ((seed * 31 + a.id.charCodeAt(0)) % 997);
    const hashB = ((seed * 31 + b.id.charCodeAt(0)) % 997);
    return hashA - hashB;
  });

  // Pick 3 with different types
  const picked: DailyQuest[] = [];
  const usedTypes = new Set<QuestType>();
  for (const q of shuffled) {
    if (picked.length >= 3) break;
    if (usedTypes.has(q.type)) continue;
    usedTypes.add(q.type);
    picked.push({ ...q, progress: 0, completed: false });
  }

  // Fill remaining if we couldn't get 3 unique types
  for (const q of shuffled) {
    if (picked.length >= 3) break;
    if (picked.some(p => p.id === q.id)) continue;
    picked.push({ ...q, progress: 0, completed: false });
  }

  return picked;
}

function getDaySeed(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ── Weekly Challenges ──
export type WeeklyQuestType = 'miniGamesWon' | 'allDailyQuests' | 'allStats100' | 'adventuresSent' | 'loginEveryDay' | 'feedCount' | 'miniGameXp';

export interface WeeklyQuest {
  id: string;
  description: string;
  type: WeeklyQuestType;
  target: number;
  progress: number;
  xpReward: number;
  completed: boolean;
}

const WEEKLY_QUEST_POOL: Omit<WeeklyQuest, 'progress' | 'completed'>[] = [
  { id: 'w-minigames-10', description: 'Win 10 mini-games', type: 'miniGamesWon', target: 10, xpReward: 200 },
  { id: 'w-dailies-5', description: 'Complete all daily quests for 5 days', type: 'allDailyQuests', target: 5, xpReward: 300 },
  { id: 'w-allstats-3', description: 'Max all stats 3 times', type: 'allStats100', target: 3, xpReward: 250 },
  { id: 'w-adventures-5', description: 'Send Nomi on 5 adventures', type: 'adventuresSent', target: 5, xpReward: 250 },
  { id: 'w-login-7', description: 'Login every day this week', type: 'loginEveryDay', target: 7, xpReward: 350 },
  { id: 'w-feed-20', description: 'Feed Nomi 20 times', type: 'feedCount', target: 20, xpReward: 150 },
  { id: 'w-minigame-xp', description: 'Earn 500 XP from mini-games', type: 'miniGameXp', target: 500, xpReward: 200 },
];

function getWeekSeed(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7); // week number
}

function generateWeeklyQuests(seed: number): WeeklyQuest[] {
  const shuffled = [...WEEKLY_QUEST_POOL].sort((a, b) => {
    const hashA = ((seed * 37 + a.id.charCodeAt(2)) % 991);
    const hashB = ((seed * 37 + b.id.charCodeAt(2)) % 991);
    return hashA - hashB;
  });
  return shuffled.slice(0, 2).map(q => ({ ...q, progress: 0, completed: false }));
}

function getMondayDateString(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// ── Achievements ──
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'care' | 'streak' | 'style' | 'milestone';
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  // Care
  { id: 'first-feed', title: 'First Feed', description: 'Feed your pet for the first time', icon: '\u{1F35F}', category: 'care', xpReward: 50, unlocked: false, unlockedAt: null },
  { id: 'caretaker', title: 'Caretaker', description: 'Feed your pet 50 times', icon: '\u{1F37D}\uFE0F', category: 'care', xpReward: 100, unlocked: false, unlockedAt: null },
  { id: 'play-date', title: 'Play Date', description: 'Play 25 times', icon: '\u{1F3AE}', category: 'care', xpReward: 75, unlocked: false, unlockedAt: null },
  { id: 'full-charge', title: 'Full Charge', description: 'Get all stats to 100%', icon: '\u{26A1}', category: 'care', xpReward: 100, unlocked: false, unlockedAt: null },
  // Streaks
  { id: 'day-one', title: 'Day One', description: 'Login for the first time', icon: '\u{1F31F}', category: 'streak', xpReward: 25, unlocked: false, unlockedAt: null },
  { id: 'week-warrior', title: 'Week Warrior', description: '7-day streak', icon: '\u{1F525}', category: 'streak', xpReward: 100, unlocked: false, unlockedAt: null },
  { id: 'monthly-master', title: 'Monthly Master', description: '30-day streak', icon: '\u{1F3C6}', category: 'streak', xpReward: 200, unlocked: false, unlockedAt: null },
  // Style
  { id: 'fashionista', title: 'Fashionista', description: 'Own 5 items', icon: '\u{1F457}', category: 'style', xpReward: 75, unlocked: false, unlockedAt: null },
  { id: 'collector', title: 'Collector', description: 'Own all shop items', icon: '\u{1F48E}', category: 'style', xpReward: 200, unlocked: false, unlockedAt: null },
  // Milestones
  { id: 'level-10', title: 'Rising Star', description: 'Reach level 10', icon: '\u{2B50}', category: 'milestone', xpReward: 100, unlocked: false, unlockedAt: null },
  { id: 'level-25', title: 'Veteran', description: 'Reach level 25', icon: '\u{1F31F}', category: 'milestone', xpReward: 150, unlocked: false, unlockedAt: null },
  { id: 'level-50', title: 'Maxed Out', description: 'Reach level 50', icon: '\u{1F451}', category: 'milestone', xpReward: 200, unlocked: false, unlockedAt: null },
];

// ── Lifetime counters (for achievement tracking) ──
interface LifetimeCounters {
  feedCount: number;
  playCount: number;
  restCount: number;
  reflectCount: number;
  equipCount: number;
}

// ── Store ──
interface XpState {
  totalXp: number;
  level: number;
  xpInCurrentLevel: number;
  dailyQuests: DailyQuest[];
  questDate: string; // ISO date string YYYY-MM-DD
  weeklyQuests: WeeklyQuest[];
  weeklyQuestDate: string; // Monday ISO date string
  achievements: Achievement[];
  counters: LifetimeCounters;
  lastWellnessXpAt: number; // timestamp for passive "all stats >80%" XP
  pendingLevelUp: number | null; // level we just reached — triggers modal
}

interface XpActions {
  addXp: (amount: number, source: string) => void;
  updateQuestProgress: (type: QuestType, amount?: number) => void;
  updateWeeklyQuestProgress: (type: WeeklyQuestType, amount?: number) => void;
  checkAndRefreshQuests: () => void;
  checkAndRefreshWeeklyQuests: () => void;
  incrementCounter: (key: keyof LifetimeCounters) => void;
  checkAchievements: (context?: { streakDays?: number; ownedCount?: number; totalItems?: number; hunger?: number; happiness?: number; energy?: number }) => void;
  clearPendingLevelUp: () => void;
  checkWellnessXp: (hunger: number, happiness: number, energy: number) => void;
  hydrateXp: () => Promise<void>;
  getXpToNextLevel: () => number;
  getLevelProgress: () => number;
  getCurrentMultiplier: () => number;
}

type XpStore = XpState & XpActions;

function saveXpState(state: XpState) {
  const data = {
    totalXp: state.totalXp,
    level: state.level,
    xpInCurrentLevel: state.xpInCurrentLevel,
    dailyQuests: state.dailyQuests,
    questDate: state.questDate,
    weeklyQuests: state.weeklyQuests,
    weeklyQuestDate: state.weeklyQuestDate,
    achievements: state.achievements,
    counters: state.counters,
    lastWellnessXpAt: state.lastWellnessXpAt,
  };
  AsyncStorage.setItem(XP_STORAGE_KEY, JSON.stringify(data)).catch(() => {});
}

export const useXpStore = create<XpStore>((set, get) => ({
  totalXp: 0,
  level: 1,
  xpInCurrentLevel: 0,
  dailyQuests: [],
  questDate: '',
  weeklyQuests: [],
  weeklyQuestDate: '',
  achievements: DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
  counters: { feedCount: 0, playCount: 0, restCount: 0, reflectCount: 0, equipCount: 0 },
  lastWellnessXpAt: 0,
  pendingLevelUp: null,

  addXp: (amount, _source) => {
    const state = get();
    if (state.level >= MAX_LEVEL) return;

    // Apply 2x XP buff from spin wheel (if active)
    let buffedAmount = amount;
    try {
      const { doubleXpUntil } = require('./adventureStore').useAdventureStore.getState();
      if (doubleXpUntil && Date.now() < doubleXpUntil) {
        buffedAmount = amount * 2;
      }
    } catch {}

    // Apply XP multiplier (needs pet stats — import dynamically to avoid circular)
    const multiplier = get().getCurrentMultiplier();
    const scaledAmount = Math.round(buffedAmount * multiplier);

    let xp = state.xpInCurrentLevel + scaledAmount;
    let level = state.level;
    let pendingLevelUp: number | null = null;

    // Check for level ups (could be multiple)
    while (level < MAX_LEVEL && xp >= xpRequiredForLevel(level)) {
      xp -= xpRequiredForLevel(level);
      level++;
      pendingLevelUp = level;
    }

    set({
      totalXp: state.totalXp + scaledAmount,
      level,
      xpInCurrentLevel: xp,
      pendingLevelUp: pendingLevelUp ?? state.pendingLevelUp,
    });
    saveXpState(get());
  },

  updateQuestProgress: (type, amount = 1) => {
    const { dailyQuests } = get();
    let xpGained = 0;

    const updated = dailyQuests.map(q => {
      if (q.type !== type || q.completed) return q;

      const newProgress = type === 'allStats'
        ? (amount! >= q.target ? q.target : q.progress)
        : q.progress + amount;

      const completed = newProgress >= q.target;
      if (completed && !q.completed) {
        xpGained += q.xpReward;
      }
      return { ...q, progress: Math.min(newProgress, q.target), completed };
    });

    set({ dailyQuests: updated });

    if (xpGained > 0) {
      get().addXp(xpGained, 'quest');
    }

    saveXpState(get());
  },

  checkAndRefreshQuests: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { questDate } = get();

    if (questDate !== today) {
      const seed = getDaySeed();
      const newQuests = generateDailyQuestsFromSeed(seed);
      set({ dailyQuests: newQuests, questDate: today });
      saveXpState(get());
    }
  },

  updateWeeklyQuestProgress: (type, amount = 1) => {
    const { weeklyQuests } = get();
    let xpGained = 0;

    const updated = weeklyQuests.map(q => {
      if (q.type !== type || q.completed) return q;
      const newProgress = q.progress + amount;
      const completed = newProgress >= q.target;
      if (completed && !q.completed) {
        xpGained += q.xpReward;
      }
      return { ...q, progress: Math.min(newProgress, q.target), completed };
    });

    set({ weeklyQuests: updated });
    if (xpGained > 0) {
      get().addXp(xpGained, 'weekly-quest');
    }
    saveXpState(get());
  },

  checkAndRefreshWeeklyQuests: () => {
    const monday = getMondayDateString();
    const { weeklyQuestDate } = get();
    if (weeklyQuestDate !== monday) {
      const seed = getWeekSeed();
      const newQuests = generateWeeklyQuests(seed);
      set({ weeklyQuests: newQuests, weeklyQuestDate: monday });
      saveXpState(get());
    }
  },

  incrementCounter: (key) => {
    const { counters } = get();
    set({ counters: { ...counters, [key]: counters[key] + 1 } });
    saveXpState(get());
  },

  checkAchievements: (context) => {
    const state = get();
    const { achievements, counters, level } = state;
    let xpGained = 0;

    const updated = achievements.map(a => {
      if (a.unlocked) return a;

      let shouldUnlock = false;

      switch (a.id) {
        case 'first-feed': shouldUnlock = counters.feedCount >= 1; break;
        case 'caretaker': shouldUnlock = counters.feedCount >= 50; break;
        case 'play-date': shouldUnlock = counters.playCount >= 25; break;
        case 'full-charge':
          shouldUnlock = !!(context?.hunger && context.hunger >= 100 && context?.happiness && context.happiness >= 100 && context?.energy && context.energy >= 100);
          break;
        case 'day-one': shouldUnlock = true; break; // unlocked on first tick
        case 'week-warrior': shouldUnlock = !!(context?.streakDays && context.streakDays >= 7); break;
        case 'monthly-master': shouldUnlock = !!(context?.streakDays && context.streakDays >= 30); break;
        case 'fashionista': shouldUnlock = !!(context?.ownedCount && context.ownedCount >= 5); break;
        case 'collector': shouldUnlock = !!(context?.ownedCount && context?.totalItems && context.ownedCount >= context.totalItems); break;
        case 'level-10': shouldUnlock = level >= 10; break;
        case 'level-25': shouldUnlock = level >= 25; break;
        case 'level-50': shouldUnlock = level >= 50; break;
      }

      if (shouldUnlock) {
        xpGained += a.xpReward;
        return { ...a, unlocked: true, unlockedAt: new Date().toISOString() };
      }
      return a;
    });

    if (xpGained > 0) {
      set({ achievements: updated });
      get().addXp(xpGained, 'achievement');
    } else if (updated !== achievements) {
      set({ achievements: updated });
    }

    // Grant free shop items: 1 per 3 achievements unlocked
    try {
      const unlockedCount = updated.filter((a) => a.unlocked).length;
      const { useShopStore } = require('./shopStore');
      useShopStore.getState().grantAchievementUnlocks(unlockedCount);
    } catch (err: any) {
      console.warn('[xpStore] grantAchievementUnlocks failed:', err?.message);
    }
    saveXpState(get());
  },

  clearPendingLevelUp: () => {
    set({ pendingLevelUp: null });
  },

  checkWellnessXp: (hunger, happiness, energy) => {
    const { lastWellnessXpAt } = get();
    const now = Date.now();
    // Max once per 30 minutes
    if (now - lastWellnessXpAt < 30 * 60 * 1000) return;

    if (hunger >= 80 && happiness >= 80 && energy >= 80) {
      set({ lastWellnessXpAt: now });
      get().addXp(5, 'wellness');
      saveXpState(get());
    }
  },

  hydrateXp: async () => {
    try {
      const raw = await AsyncStorage.getItem(XP_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      // Merge achievements — keep new ones from DEFAULT_ACHIEVEMENTS
      const storedAchievements: Achievement[] = data.achievements ?? [];
      const merged = DEFAULT_ACHIEVEMENTS.map(def => {
        const stored = storedAchievements.find(a => a.id === def.id);
        return stored ? { ...def, unlocked: stored.unlocked, unlockedAt: stored.unlockedAt } : { ...def };
      });

      set({
        totalXp: data.totalXp ?? 0,
        level: data.level ?? 1,
        xpInCurrentLevel: data.xpInCurrentLevel ?? 0,
        dailyQuests: data.dailyQuests ?? [],
        questDate: data.questDate ?? '',
        weeklyQuests: data.weeklyQuests ?? [],
        weeklyQuestDate: data.weeklyQuestDate ?? '',
        achievements: merged,
        counters: data.counters ?? { feedCount: 0, playCount: 0, restCount: 0, reflectCount: 0, equipCount: 0 },
        lastWellnessXpAt: data.lastWellnessXpAt ?? 0,
      });

      // Refresh quests if it's a new day/week
      get().checkAndRefreshQuests();
      get().checkAndRefreshWeeklyQuests();
    } catch {
      // First launch
    }
  },

  getXpToNextLevel: () => {
    const { level } = get();
    if (level >= MAX_LEVEL) return 0;
    return xpRequiredForLevel(level);
  },

  getLevelProgress: () => {
    const { level, xpInCurrentLevel } = get();
    if (level >= MAX_LEVEL) return 1;
    return xpInCurrentLevel / xpRequiredForLevel(level);
  },

  getCurrentMultiplier: () => {
    // Lazy import to avoid circular dependency
    let base = 1.0;
    try {
      const petStore = require('./petStore').usePetStore;
      const { hunger, happiness, energy } = petStore.getState();
      base = getXpMultiplier(hunger, happiness, energy);
    } catch {}
    // Premium bonus
    try {
      const { getPremiumXpBonus } = require('./premiumStore');
      base += getPremiumXpBonus();
    } catch {}
    // Level perk XP bonus
    const { level } = get();
    const perks = getPerksForLevel(level);
    base += perks.xpMultiplierBonus;
    return base;
  },
}));
