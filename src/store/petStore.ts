import { create } from 'zustand';

export type PetMood = 'happy' | 'content' | 'tired' | 'hungry' | 'sad';
export type PetSkin = 'default' | 'headphones';

interface PetState {
  id: string | null;
  name: string;
  mintAddress: string;
  hunger: number;
  happiness: number;
  energy: number;
  skin: PetSkin;
  hasPet: boolean;
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

function computeMood(hunger: number, happiness: number, energy: number): PetMood {
  if (hunger < 30) return 'hungry';
  if (energy < 30) return 'tired';
  if (happiness < 30) return 'sad';
  if (happiness >= 70 && energy >= 50 && hunger >= 50) return 'happy';
  return 'content';
}

function getMoodTextFromMood(name: string, mood: PetMood): string {
  const moodTexts: Record<PetMood, string> = {
    happy: `${name} feels happy`,
    content: `${name} feels content`,
    tired: `${name} feels tired`,
    hungry: `${name} feels hungry`,
    sad: `${name} feels sad`,
  };
  return moodTexts[mood];
}

export const usePetStore = create<PetStore>((set, get) => ({
  id: null,
  name: 'Nomi',
  mintAddress: '',
  hunger: 70,
  happiness: 70,
  energy: 70,
  skin: 'default',
  hasPet: false,

  mintPet: () => {
    set({
      id: `pet_${Date.now()}`,
      mintAddress: generateMintAddress(),
      hasPet: true,
      hunger: 80,
      happiness: 80,
      energy: 80,
    });
  },

  feedPet: () => {
    set((state) => ({
      hunger: clamp(state.hunger + 25, 0, 100),
      happiness: clamp(state.happiness + 5, 0, 100),
    }));
  },

  playWithPet: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 20, 0, 100),
      energy: clamp(state.energy - 15, 0, 100),
      hunger: clamp(state.hunger - 10, 0, 100),
    }));
  },

  restPet: () => {
    set((state) => ({
      energy: clamp(state.energy + 30, 0, 100),
      happiness: clamp(state.happiness + 5, 0, 100),
    }));
  },

  reflectProductiveDay: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 15, 0, 100),
      energy: clamp(state.energy + 5, 0, 100),
    }));
  },

  reflectNeedRest: () => {
    set((state) => ({
      energy: clamp(state.energy + 20, 0, 100),
      happiness: clamp(state.happiness + 10, 0, 100),
    }));
  },

  reflectFeelGood: () => {
    set((state) => ({
      happiness: clamp(state.happiness + 20, 0, 100),
      energy: clamp(state.energy + 10, 0, 100),
    }));
  },

  setSkin: (skin: PetSkin) => {
    set({ skin });
  },

  getMood: () => {
    const { hunger, happiness, energy } = get();
    return computeMood(hunger, happiness, energy);
  },

  getMoodText: () => {
    const { name, hunger, happiness, energy } = get();
    const mood = computeMood(hunger, happiness, energy);
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
    });
  },
}));
