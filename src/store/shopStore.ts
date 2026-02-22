import { create } from 'zustand';

export type ShopCategory = 'All' | 'Hats' | 'Shirts' | 'Shoes' | 'Accessories';

export interface ShopItem {
  id: string;
  name: string;
  category: Exclude<ShopCategory, 'All'>;
  price: number;
  image: string;
  owned: boolean;
}

interface ShopState {
  items: ShopItem[];
  selectedCategory: ShopCategory;
  isLoading: boolean;
}

interface ShopActions {
  loadShopItems: () => Promise<void>;
  setCategory: (category: ShopCategory) => void;
}

type ShopStore = ShopState & ShopActions;

const MOCK_ITEMS: ShopItem[] = [
  { id: '1', name: 'Party Hat', category: 'Hats', price: 0.5, image: '🎩', owned: false },
  { id: '2', name: 'Crown', category: 'Hats', price: 2.0, image: '👑', owned: false },
  { id: '3', name: 'Hoodie', category: 'Shirts', price: 0.8, image: '👕', owned: false },
  { id: '4', name: 'Tuxedo', category: 'Shirts', price: 1.5, image: '🎽', owned: false },
  { id: '5', name: 'Sneakers', category: 'Shoes', price: 0.6, image: '👟', owned: false },
  { id: '6', name: 'Boots', category: 'Shoes', price: 1.2, image: '👢', owned: false },
  { id: '7', name: 'Gold Chain', category: 'Accessories', price: 3.0, image: '📿', owned: false },
  { id: '8', name: 'Sunglasses', category: 'Accessories', price: 0.9, image: '🕶️', owned: false },
  { id: '9', name: 'Bow Tie', category: 'Accessories', price: 0.4, image: '🎀', owned: false },
  { id: '10', name: 'Beanie', category: 'Hats', price: 0.7, image: '🧢', owned: false },
  { id: '11', name: 'Jersey', category: 'Shirts', price: 1.0, image: '👔', owned: false },
  { id: '12', name: 'Flip Flops', category: 'Shoes', price: 0.3, image: '🩴', owned: false },
];

export const useShopStore = create<ShopStore>((set) => ({
  items: [],
  selectedCategory: 'All',
  isLoading: false,

  loadShopItems: async () => {
    set({ isLoading: true });
    await new Promise((r) => setTimeout(r, 800));
    set({ items: MOCK_ITEMS, isLoading: false });
  },

  setCategory: (category) => set({ selectedCategory: category }),
}));
