import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PetMood = 'excited' | 'happy' | 'content' | 'tired' | 'hungry' | 'sad';
export type PetSkin = 'default' | 'headphones';

// --- Mood-to-Model mapping ---
// breathing.glb = default idle model, Sad.glb = any stat < 50%
// Excited.glb = burst at 95%+, fallingdown.glb = double-tap easter egg
// Model switching is handled in PetRenderer via activeModel prop.
const DEFAULT_MODEL = require('../../assets/pets/breathing.glb');

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
  mintAddress: string;
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
}

interface PetActions {
  mintPet: () => void;
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
  'id', 'name', 'mintAddress', 'hunger', 'happiness', 'energy',
  'skin', 'hasPet', 'lastTickAt', 'lastActiveDate', 'streakDays',
];

function savePetState(state: PetState) {
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

// Triggers excited burst when all three stats are nearly maxed (95%+).
function checkExcitedTrigger(state: PetStore) {
  if (
    !state.isExcitedBurst &&
    state.hunger >= 95 &&
    state.happiness >= 95 &&
    state.energy >= 95
  ) {
    state.triggerExcitedBurst();
  }
}

// --- Store ---

export const usePetStore = create<PetStore>((set, get) => ({
  id: null,
  name: 'Nomi',
  mintAddress: '',
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

  triggerExcitedBurst: () => {
    set({ isExcitedBurst: true, excitedPlayedAt: Date.now() });
  },

  clearExcitedBurst: () => {
    set({ isExcitedBurst: false });
  },

  mintPet: () => {
    set({
      id: `pet_${Date.now()}`,
      mintAddress: generateMintAddress(),
      hasPet: true,
      hunger: 80,
      happiness: 80,
      energy: 80,
    });
    savePetState(get());
  },

  feedPet: () => {
    set((state) => ({
      hunger: clamp(state.hunger + 25, 0, 100),
      happiness: clamp(state.happiness + 5, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
  },

  playWithPet: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 20, 0, 100),
      energy: clamp(state.energy - 15, 0, 100),
      hunger: clamp(state.hunger - 10, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
  },

  restPet: () => {
    set((state) => ({
      energy: clamp(state.energy + 30, 0, 100),
      happiness: clamp(state.happiness + 5, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
  },

  reflectProductiveDay: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 15, 0, 100),
      energy: clamp(state.energy + 5, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
  },

  reflectNeedRest: () => {
    set((state) => ({
      energy: clamp(state.energy + 20, 0, 100),
      happiness: clamp(state.happiness + 10, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
  },

  reflectFeelGood: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 20, 0, 100),
      energy: clamp(state.energy + 10, 0, 100),
    }));
    savePetState(get());
    checkExcitedTrigger(get());
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
      mintAddress: '',
      hasPet: false,
      hunger: 70,
      happiness: 70,
      energy: 70,
      skin: 'default',
      lastTickAt: Date.now(),
      lastActiveDate: '',
      streakDays: 0,
      isExcitedBurst: false,
      excitedPlayedAt: 0,
    });
    savePetState(get());
  },

  tick: () => {
    const now = Date.now();
    const { lastTickAt, lastActiveDate, streakDays } = get();
    const elapsedMs = now - lastTickAt;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Skip tiny intervals (< 6 minutes)
    if (elapsedHours < 0.1) return;

    // Stat decay: happiness drops FASTEST (loneliness), hunger next, energy slowest
    // ~8 pts/hr happiness, ~5 pts/hr hunger, ~3 pts/hr energy
    // Capped at 50 max decay so the pet is never completely zeroed after a long absence
    const happinessDecay = Math.min(elapsedHours * 8, 50);
    const hungerDecay = Math.min(elapsedHours * 5, 50);
    const energyDecay = Math.min(elapsedHours * 3, 50);

    set((state) => ({
      hunger: clamp(state.hunger - hungerDecay, 0, 100),
      happiness: clamp(state.happiness - happinessDecay, 0, 100),
      energy: clamp(state.energy - energyDecay, 0, 100),
      lastTickAt: now,
    }));

    // Daily streak tracking
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastActiveDate) {
      const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
      const newStreak = lastActiveDate === yesterday ? streakDays + 1 : 1;
      const streakBonus = Math.min(newStreak * 2, 10);

      set((state) => ({
        lastActiveDate: today,
        streakDays: newStreak,
        happiness: clamp(state.happiness + streakBonus, 0, 100),
      }));
    }

    savePetState(get());
  },
}));
