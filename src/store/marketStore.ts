import { create } from 'zustand';

export interface MarketPet {
  id: string;
  name: string;
  owner: string;
  price: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  image: string;
}

interface MarketState {
  pets: MarketPet[];
  isLoading: boolean;
}

interface MarketActions {
  loadMarketPets: () => Promise<void>;
}

type MarketStore = MarketState & MarketActions;

const MOCK_PETS: MarketPet[] = [
  { id: '1', name: 'Blueberry', owner: '7xKs...3mNp', price: 5.2, rarity: 'Rare', image: '🐾' },
  { id: '2', name: 'Shadow', owner: '9pLm...8wQr', price: 12.5, rarity: 'Epic', image: '🐾' },
  { id: '3', name: 'Fluffy', owner: '3nKj...5vBx', price: 2.1, rarity: 'Common', image: '🐾' },
  { id: '4', name: 'Sparkle', owner: '6tRw...2mNz', price: 45.0, rarity: 'Legendary', image: '🐾' },
  { id: '5', name: 'Misty', owner: '1qAs...9kLp', price: 3.8, rarity: 'Common', image: '🐾' },
  { id: '6', name: 'Thunder', owner: '8wXc...4jHm', price: 8.9, rarity: 'Rare', image: '🐾' },
];

export const useMarketStore = create<MarketStore>((set) => ({
  pets: [],
  isLoading: false,

  loadMarketPets: async () => {
    set({ isLoading: true });
    await new Promise((r) => setTimeout(r, 1000));
    set({ pets: MOCK_PETS, isLoading: false });
  },
}));
