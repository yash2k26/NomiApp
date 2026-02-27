import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENT_STORAGE_KEY = 'oracle-pet-events';

// ── Types ──

export type EventInteraction = 'tap' | 'swipe' | 'wait' | 'multi_tap';
export type EventRarity = 'common' | 'uncommon' | 'rare';
export type EventCategory = 'creature' | 'treasure' | 'weather' | 'visitor' | 'discovery';

export interface EventReward {
  xp: number;
  coins: number;
  staminaRefill: number;
  happiness: number;
  shards: number;
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: EventCategory;
  interaction: EventInteraction;
  interactionHint: string;
  reward: EventReward;
  rarity: EventRarity;
  durationMs: number; // how long event stays before expiring
}

export interface ActiveEvent {
  event: RandomEvent;
  startedAt: number;
  resolved: boolean;
}

interface EventState {
  activeEvent: ActiveEvent | null;
  lastEventAt: number;
  eventsSeenToday: number;
  lastEventDate: string;
  eventHistory: string[]; // ids of seen events (for collection)
}

interface EventActions {
  checkAndTriggerEvent: (statsAbove70: boolean, evolutionStage: number) => void;
  resolveEvent: () => EventReward | null;
  dismissEvent: () => void;
  hydrateEvents: () => Promise<void>;
}

type EventStore = EventState & EventActions;

// ── Event Pool ──

const EVENT_POOL: RandomEvent[] = [
  // Creatures (common)
  { id: 'butterfly', title: 'A butterfly landed on Nomi!', description: 'A beautiful butterfly is resting on your pet.', emoji: '\u{1F98B}', category: 'creature', interaction: 'tap', interactionHint: 'Tap gently to catch it!', reward: { xp: 15, coins: 0, staminaRefill: 0, happiness: 5, shards: 0 }, rarity: 'common', durationMs: 30000 },
  { id: 'ladybug', title: 'A ladybug appeared!', description: 'A tiny ladybug is crawling near Nomi.', emoji: '\u{1F41E}', category: 'creature', interaction: 'tap', interactionHint: 'Tap to say hello!', reward: { xp: 10, coins: 0, staminaRefill: 0, happiness: 3, shards: 0 }, rarity: 'common', durationMs: 25000 },
  { id: 'bird', title: 'A bird is singing!', description: 'A little bird perched nearby and started singing.', emoji: '\u{1F426}', category: 'creature', interaction: 'wait', interactionHint: 'Wait and listen...', reward: { xp: 20, coins: 0, staminaRefill: 0, happiness: 8, shards: 0 }, rarity: 'common', durationMs: 35000 },
  { id: 'frog', title: 'A frog hopped by!', description: 'A curious frog is looking at Nomi.', emoji: '\u{1F438}', category: 'creature', interaction: 'tap', interactionHint: 'Tap to pet the frog!', reward: { xp: 12, coins: 0, staminaRefill: 0, happiness: 4, shards: 0 }, rarity: 'common', durationMs: 20000 },
  { id: 'bunny', title: 'A bunny is visiting!', description: 'A fluffy bunny hopped over to say hi.', emoji: '\u{1F430}', category: 'creature', interaction: 'tap', interactionHint: 'Tap to give it a carrot!', reward: { xp: 18, coins: 0, staminaRefill: 0, happiness: 6, shards: 0 }, rarity: 'common', durationMs: 30000 },

  // Creatures (uncommon)
  { id: 'cat', title: 'A mysterious cat appeared!', description: 'A sleek cat is watching Nomi with curious eyes.', emoji: '\u{1F408}', category: 'visitor', interaction: 'tap', interactionHint: 'Tap to pet it!', reward: { xp: 25, coins: 0.02, staminaRefill: 0, happiness: 10, shards: 0 }, rarity: 'uncommon', durationMs: 25000 },
  { id: 'owl', title: 'A wise owl appeared!', description: 'An owl with ancient knowledge landed nearby.', emoji: '\u{1F989}', category: 'visitor', interaction: 'wait', interactionHint: 'Listen to its wisdom...', reward: { xp: 30, coins: 0, staminaRefill: 10, happiness: 8, shards: 0 }, rarity: 'uncommon', durationMs: 30000 },
  { id: 'fox', title: 'A fox is sneaking around!', description: 'A playful fox wants to be friends.', emoji: '\u{1F98A}', category: 'visitor', interaction: 'tap', interactionHint: 'Tap quickly before it runs!', reward: { xp: 22, coins: 0.03, staminaRefill: 0, happiness: 7, shards: 0 }, rarity: 'uncommon', durationMs: 20000 },

  // Creatures (rare)
  { id: 'unicorn', title: 'A unicorn appeared!', description: 'A magical unicorn is glowing with rainbow light!', emoji: '\u{1F984}', category: 'visitor', interaction: 'tap', interactionHint: 'Tap to make a wish!', reward: { xp: 50, coins: 0.1, staminaRefill: 20, happiness: 15, shards: 1 }, rarity: 'rare', durationMs: 20000 },
  { id: 'dragon_baby', title: 'A baby dragon appeared!', description: 'A tiny dragon is breathing sparkles!', emoji: '\u{1F409}', category: 'visitor', interaction: 'multi_tap', interactionHint: 'Tap 5 times to play with it!', reward: { xp: 45, coins: 0.08, staminaRefill: 15, happiness: 12, shards: 1 }, rarity: 'rare', durationMs: 25000 },

  // Treasure
  { id: 'coin_small', title: 'Nomi found a shiny coin!', description: 'Something sparkly is on the ground!', emoji: '\u{1FA99}', category: 'treasure', interaction: 'swipe', interactionHint: 'Swipe to pick it up!', reward: { xp: 10, coins: 0.05, staminaRefill: 0, happiness: 3, shards: 0 }, rarity: 'common', durationMs: 25000 },
  { id: 'gem', title: 'A sparkling gem appeared!', description: 'Is that... a precious gem?!', emoji: '\u{1F48E}', category: 'treasure', interaction: 'swipe', interactionHint: 'Swipe to grab it!', reward: { xp: 20, coins: 0.08, staminaRefill: 0, happiness: 5, shards: 0 }, rarity: 'uncommon', durationMs: 20000 },
  { id: 'treasure_chest', title: 'A treasure chest appeared!', description: 'Nomi found a mysterious chest!', emoji: '\u{1F4E6}', category: 'treasure', interaction: 'multi_tap', interactionHint: 'Tap 5 times to open it!', reward: { xp: 35, coins: 0.1, staminaRefill: 10, happiness: 8, shards: 0 }, rarity: 'uncommon', durationMs: 30000 },

  // Weather
  { id: 'rainbow', title: 'A rainbow appeared!', description: 'The sky lit up with beautiful colors!', emoji: '\u{1F308}', category: 'weather', interaction: 'wait', interactionHint: 'Enjoy the view...', reward: { xp: 25, coins: 0, staminaRefill: 0, happiness: 12, shards: 0 }, rarity: 'uncommon', durationMs: 30000 },
  { id: 'rain', title: 'It started raining!', description: 'Nomi needs an umbrella!', emoji: '\u{1F327}\u{FE0F}', category: 'weather', interaction: 'tap', interactionHint: 'Tap to give Nomi an umbrella!', reward: { xp: 15, coins: 0, staminaRefill: 0, happiness: 8, shards: 0 }, rarity: 'common', durationMs: 25000 },
  { id: 'shooting_star', title: 'A shooting star!', description: 'Quick, make a wish!', emoji: '\u{1F320}', category: 'weather', interaction: 'tap', interactionHint: 'Tap to make a wish!', reward: { xp: 30, coins: 0, staminaRefill: 15, happiness: 10, shards: 0 }, rarity: 'uncommon', durationMs: 15000 },
  { id: 'aurora', title: 'Northern lights!', description: 'The sky is dancing with magical colors!', emoji: '\u{1F30C}', category: 'weather', interaction: 'wait', interactionHint: 'Watch in awe...', reward: { xp: 40, coins: 0.05, staminaRefill: 0, happiness: 15, shards: 1 }, rarity: 'rare', durationMs: 25000 },

  // Discovery
  { id: 'stargazing', title: 'Nomi is stargazing!', description: 'Nomi found a perfect spot to watch the stars.', emoji: '\u{1F52D}', category: 'discovery', interaction: 'wait', interactionHint: 'Wait 10 seconds...', reward: { xp: 20, coins: 0, staminaRefill: 0, happiness: 8, shards: 0 }, rarity: 'common', durationMs: 30000 },
  { id: 'flower', title: 'Nomi found a flower!', description: 'A beautiful flower is blooming nearby.', emoji: '\u{1F33A}', category: 'discovery', interaction: 'tap', interactionHint: 'Tap to pick it!', reward: { xp: 12, coins: 0, staminaRefill: 0, happiness: 6, shards: 0 }, rarity: 'common', durationMs: 25000 },
  { id: 'fossil', title: 'Nomi dug up something!', description: 'Is that a tiny fossil?!', emoji: '\u{1F9B4}', category: 'discovery', interaction: 'multi_tap', interactionHint: 'Tap 5 times to dig it out!', reward: { xp: 28, coins: 0.04, staminaRefill: 0, happiness: 5, shards: 0 }, rarity: 'uncommon', durationMs: 30000 },
  { id: 'magic_mushroom', title: 'A glowing mushroom!', description: 'Nomi found a mushroom that glows in the dark!', emoji: '\u{1F344}', category: 'discovery', interaction: 'tap', interactionHint: 'Tap to investigate!', reward: { xp: 22, coins: 0, staminaRefill: 20, happiness: 5, shards: 0 }, rarity: 'uncommon', durationMs: 25000 },
  { id: 'ancient_rune', title: 'An ancient rune appeared!', description: 'Mysterious symbols are glowing on the ground!', emoji: '\u{1F52E}', category: 'discovery', interaction: 'wait', interactionHint: 'Let the magic flow...', reward: { xp: 40, coins: 0, staminaRefill: 25, happiness: 10, shards: 1 }, rarity: 'rare', durationMs: 20000 },
];

const BASE_MAX_EVENTS_PER_DAY = 4;
const MIN_EVENT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes minimum between events

function getMaxEventsPerDay(): number {
  try {
    const { getPerksForLevel } = require('./xpStore');
    const level = require('./xpStore').useXpStore.getState().level;
    return BASE_MAX_EVENTS_PER_DAY + getPerksForLevel(level).extraEventsPerDay;
  } catch {
    return BASE_MAX_EVENTS_PER_DAY;
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function saveEventState(state: EventState) {
  AsyncStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify({
    lastEventAt: state.lastEventAt,
    eventsSeenToday: state.eventsSeenToday,
    lastEventDate: state.lastEventDate,
    eventHistory: state.eventHistory,
  })).catch(() => {});
}

// ── Store ──

export const useEventStore = create<EventStore>((set, get) => ({
  activeEvent: null,
  lastEventAt: 0,
  eventsSeenToday: 0,
  lastEventDate: '',
  eventHistory: [],

  checkAndTriggerEvent: (statsAbove70: boolean, evolutionStage: number) => {
    const state = get();
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    // Reset daily count if new day
    if (state.lastEventDate !== today) {
      set({ eventsSeenToday: 0, lastEventDate: today });
    }

    // Don't trigger if already active
    if (state.activeEvent && !state.activeEvent.resolved) return;

    // Check daily limit
    if (state.eventsSeenToday >= getMaxEventsPerDay()) return;

    // Check minimum interval
    if (now - state.lastEventAt < MIN_EVENT_INTERVAL_MS) return;

    // Random chance: base 15%, +10% if stats good, +5% per evolution stage
    let chance = 0.15;
    if (statsAbove70) chance += 0.10;
    chance += evolutionStage * 0.05;
    chance = Math.min(chance, 0.5);

    if (Math.random() > chance) return;

    // Pick an event weighted by rarity
    const rarityWeights: Record<EventRarity, number> = {
      common: 60,
      uncommon: 30,
      rare: 10,
    };

    // Better stats = slightly better rarity chances
    if (statsAbove70) {
      rarityWeights.uncommon += 5;
      rarityWeights.rare += 5;
      rarityWeights.common -= 10;
    }

    const totalWeight = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    let selectedRarity: EventRarity = 'common';
    for (const [rarity, weight] of Object.entries(rarityWeights) as [EventRarity, number][]) {
      roll -= weight;
      if (roll <= 0) {
        selectedRarity = rarity;
        break;
      }
    }

    const candidates = EVENT_POOL.filter(e => e.rarity === selectedRarity);
    if (candidates.length === 0) return;

    const event = pick(candidates);

    set({
      activeEvent: { event, startedAt: now, resolved: false },
      lastEventAt: now,
      eventsSeenToday: get().eventsSeenToday + 1,
    });
    saveEventState(get());
  },

  resolveEvent: () => {
    const { activeEvent, eventHistory } = get();
    if (!activeEvent || activeEvent.resolved) return null;

    const reward = activeEvent.event.reward;

    // Apply rewards
    try {
      // XP
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(reward.xp, 'event');

      // Coins
      if (reward.coins > 0) {
        const walletStore = require('./walletStore').useWalletStore.getState();
        walletStore.addBalance(reward.coins);
      }

      // Stamina
      if (reward.staminaRefill > 0) {
        const petMod = require('./petStore');
        const petStore = petMod.usePetStore.getState();
        const current = petStore.getStamina();
        const maxStam = petMod.getEffectiveStaminaMax();
        const newStamina = Math.min(maxStam, current + reward.staminaRefill);
        petMod.usePetStore.setState({ stamina: newStamina, lastStaminaRegenAt: Date.now() });
      }

      // Happiness
      if (reward.happiness > 0) {
        const petStore = require('./petStore').usePetStore;
        petStore.setState((s: any) => ({
          happiness: Math.min(100, s.happiness + reward.happiness),
        }));
      }

      // Shards
      if (reward.shards > 0) {
        const adventureStore = require('./adventureStore').useAdventureStore;
        adventureStore.setState((s: any) => ({
          evolutionShards: s.evolutionShards + reward.shards,
        }));
      }

      // Record in personality
      const ps = require('./personalityStore').usePersonalityStore.getState();
      ps.recordMemory('event', activeEvent.event.title);
    } catch {}

    // Update history
    const newHistory = [...new Set([activeEvent.event.id, ...eventHistory])].slice(0, 50);
    set({
      activeEvent: { ...activeEvent, resolved: true },
      eventHistory: newHistory,
    });
    saveEventState(get());

    return reward;
  },

  dismissEvent: () => {
    set({ activeEvent: null });
  },

  hydrateEvents: async () => {
    try {
      const raw = await AsyncStorage.getItem(EVENT_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set({
        lastEventAt: data.lastEventAt ?? 0,
        eventsSeenToday: data.eventsSeenToday ?? 0,
        lastEventDate: data.lastEventDate ?? '',
        eventHistory: data.eventHistory ?? [],
      });
    } catch {}
  },
}));
