import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOP_STORAGE_KEY = 'oracle-pet-shop';

export type ShopCategory = 'All' | 'Hats' | 'Shirts' | 'Shoes' | 'Accessories';

export interface ShopItem {
  id: string;
  name: string;
  category: Exclude<ShopCategory, 'All'>;
  price: number;
  image: string;
  owned: boolean;
  /** Skin key used by petStore when equipped */
  skinKey: string;
}

interface ShopState {
  items: ShopItem[];
  selectedCategory: ShopCategory;
  equippedItemId: string | null;
}

interface ShopActions {
  setCategory: (category: ShopCategory) => void;
  buyItem: (id: string) => void;
  equipItem: (id: string) => void;
  unequipItem: () => void;
  hydrateShop: () => Promise<void>;
}

type ShopStore = ShopState & ShopActions;

const SHOP_ITEMS: ShopItem[] = [
  { id: 'headphones', name: 'Headphones', category: 'Accessories', price: 0.5, image: '\u{1F3A7}', owned: false, skinKey: 'headphones' },
  { id: 'party-hat', name: 'Party Hat', category: 'Hats', price: 0.5, image: '\u{1F389}', owned: false, skinKey: 'party-hat' },
  { id: 'crown', name: 'Crown', category: 'Hats', price: 2.0, image: '\u{1F451}', owned: false, skinKey: 'crown' },
  { id: 'beanie', name: 'Beanie', category: 'Hats', price: 0.7, image: '\u{1F9E2}', owned: false, skinKey: 'beanie' },
  { id: 'hoodie', name: 'Hoodie', category: 'Shirts', price: 0.8, image: '\u{1F455}', owned: false, skinKey: 'hoodie' },
  { id: 'tuxedo', name: 'Tuxedo', category: 'Shirts', price: 1.5, image: '\u{1F3BD}', owned: false, skinKey: 'tuxedo' },
  { id: 'jersey', name: 'Jersey', category: 'Shirts', price: 1.0, image: '\u{1F454}', owned: false, skinKey: 'jersey' },
  { id: 'sneakers', name: 'Sneakers', category: 'Shoes', price: 0.6, image: '\u{1F45F}', owned: false, skinKey: 'sneakers' },
  { id: 'boots', name: 'Boots', category: 'Shoes', price: 1.2, image: '\u{1F462}', owned: false, skinKey: 'boots' },
  { id: 'flip-flops', name: 'Flip Flops', category: 'Shoes', price: 0.3, image: '\u{1FA74}', owned: false, skinKey: 'flip-flops' },
  { id: 'gold-chain', name: 'Gold Chain', category: 'Accessories', price: 3.0, image: '\u{1F4FF}', owned: false, skinKey: 'gold-chain' },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Accessories', price: 0.9, image: '\u{1F576}\uFE0F', owned: false, skinKey: 'sunglasses' },
];

async function saveShopState(ownedIds: string[], equippedItemId: string | null) {
  try {
    await AsyncStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify({ ownedIds, equippedItemId }));
  } catch {}
}

export const useShopStore = create<ShopStore>((set, get) => ({
  items: SHOP_ITEMS.map((i) => ({ ...i })),
  selectedCategory: 'All',
  equippedItemId: null,

  setCategory: (category) => set({ selectedCategory: category }),

  buyItem: (id) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item || item.owned) return;

    // Deduct balance from wallet store
    const walletStore = require('./walletStore').useWalletStore.getState();
    if (walletStore.balance < item.price) return;
    walletStore.deductBalance(item.price);

    const updated = items.map((i) => (i.id === id ? { ...i, owned: true } : i));
    set({ items: updated });

    const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
    saveShopState(ownedIds, get().equippedItemId);

    // XP for buying
    const xpStore = require('./xpStore').useXpStore.getState();
    xpStore.addXp(30, 'buy');
    xpStore.checkAchievements({ ownedCount: ownedIds.length, totalItems: updated.length });
  },

  equipItem: (id) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item || !item.owned) return;

    set({ equippedItemId: id });
    saveShopState(
      items.filter((i) => i.owned).map((i) => i.id),
      id
    );

    // XP for equipping
    const xpStore = require('./xpStore').useXpStore.getState();
    xpStore.addXp(5, 'equip');
    xpStore.incrementCounter('equipCount');
    xpStore.updateQuestProgress('equip');
  },

  unequipItem: () => {
    const { items } = get();
    set({ equippedItemId: null });
    saveShopState(
      items.filter((i) => i.owned).map((i) => i.id),
      null
    );
  },

  hydrateShop: async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOP_STORAGE_KEY);
      if (!stored) return;
      const { ownedIds, equippedItemId } = JSON.parse(stored) as {
        ownedIds: string[];
        equippedItemId: string | null;
      };
      const { items } = get();
      const updated = items.map((i) => ({
        ...i,
        owned: ownedIds.includes(i.id),
      }));
      set({ items: updated, equippedItemId });
    } catch {}
  },
}));
