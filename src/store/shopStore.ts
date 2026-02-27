import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOP_STORAGE_KEY = 'oracle-pet-shop';

export type ShopCategory = 'All' | 'Hats' | 'Shirts' | 'Shoes' | 'Accessories';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemUnlockCondition {
  type: 'level' | 'streak' | 'adventures' | 'miniGames' | 'evolution';
  value: number;
  label: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: Exclude<ShopCategory, 'All'>;
  price: number;
  image: string;
  owned: boolean;
  /** Skin key used by petStore when equipped */
  skinKey: string;
  rarity: ItemRarity;
  /** If set, item only visible/purchasable for users at this tier tag level */
  tierTag?: string;
  /** If set, item requires meeting this condition before purchase */
  unlockCondition?: ItemUnlockCondition;
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
  // Common items
  { id: 'headphones', name: 'Headphones', category: 'Accessories', price: 0.5, image: '\u{1F3A7}', owned: false, skinKey: 'headphones', rarity: 'common' },
  { id: 'party-hat', name: 'Party Hat', category: 'Hats', price: 0.5, image: '\u{1F389}', owned: false, skinKey: 'party-hat', rarity: 'common' },
  { id: 'beanie', name: 'Beanie', category: 'Hats', price: 0.7, image: '\u{1F9E2}', owned: false, skinKey: 'beanie', rarity: 'common' },
  { id: 'flip-flops', name: 'Flip Flops', category: 'Shoes', price: 0.3, image: '\u{1FA74}', owned: false, skinKey: 'flip-flops', rarity: 'common' },
  { id: 'sneakers', name: 'Sneakers', category: 'Shoes', price: 0.6, image: '\u{1F45F}', owned: false, skinKey: 'sneakers', rarity: 'common' },
  // Rare items — require progression
  { id: 'hoodie', name: 'Hoodie', category: 'Shirts', price: 0.8, image: '\u{1F455}', owned: false, skinKey: 'hoodie', rarity: 'rare', unlockCondition: { type: 'level', value: 5, label: 'Reach Level 5' } },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Accessories', price: 0.9, image: '\u{1F576}\uFE0F', owned: false, skinKey: 'sunglasses', rarity: 'rare', unlockCondition: { type: 'streak', value: 3, label: '3-Day Login Streak' } },
  { id: 'jersey', name: 'Jersey', category: 'Shirts', price: 1.0, image: '\u{1F454}', owned: false, skinKey: 'jersey', rarity: 'rare', unlockCondition: { type: 'adventures', value: 5, label: 'Complete 5 Adventures' } },
  { id: 'boots', name: 'Boots', category: 'Shoes', price: 1.2, image: '\u{1F462}', owned: false, skinKey: 'boots', rarity: 'rare', unlockCondition: { type: 'level', value: 8, label: 'Reach Level 8' } },
  // Epic items — require mid-game progression
  { id: 'tuxedo', name: 'Tuxedo', category: 'Shirts', price: 1.5, image: '\u{1F3BD}', owned: false, skinKey: 'tuxedo', rarity: 'epic', unlockCondition: { type: 'level', value: 15, label: 'Reach Level 15' } },
  { id: 'crown', name: 'Crown', category: 'Hats', price: 2.0, image: '\u{1F451}', owned: false, skinKey: 'crown', rarity: 'epic', unlockCondition: { type: 'adventures', value: 10, label: 'Complete 10 Adventures' } },
  { id: 'gold-chain', name: 'Gold Chain', category: 'Accessories', price: 3.0, image: '\u{1F4FF}', owned: false, skinKey: 'gold-chain', rarity: 'epic', unlockCondition: { type: 'miniGames', value: 5, label: 'Win 5 Mini-Games' } },
  // Tier-exclusive items
  { id: 'neon-jacket', name: 'Neon Jacket', category: 'Shirts', price: 3.5, image: '\u{1F31F}', owned: false, skinKey: 'neon-jacket', rarity: 'epic', tierTag: 'gold_exclusive' },
  { id: 'gold-wings', name: 'Gold Wings', category: 'Accessories', price: 5.0, image: '\u2728', owned: false, skinKey: 'gold-wings', rarity: 'legendary', tierTag: 'gold_exclusive', unlockCondition: { type: 'level', value: 20, label: 'Reach Level 20' } },
  { id: 'diamond-halo', name: 'Diamond Halo', category: 'Accessories', price: 8.0, image: '\u{1F48E}', owned: false, skinKey: 'diamond-halo', rarity: 'legendary', tierTag: 'diamond_exclusive', unlockCondition: { type: 'level', value: 25, label: 'Reach Level 25' } },
];

export interface ItemLockState {
  locked: boolean;
  reason: string;
}

export function getItemLockState(item: ShopItem): ItemLockState {
  const cond = item.unlockCondition;
  if (!cond) return { locked: false, reason: '' };

  try {
    switch (cond.type) {
      case 'level': {
        const level = require('./xpStore').useXpStore.getState().level;
        if (level < cond.value) return { locked: true, reason: cond.label };
        break;
      }
      case 'streak': {
        const streak = require('./petStore').usePetStore.getState().streakDays;
        if (streak < cond.value) return { locked: true, reason: cond.label };
        break;
      }
      case 'adventures': {
        const completed = require('./adventureStore').useAdventureStore.getState().completedAdventures;
        if (completed < cond.value) return { locked: true, reason: cond.label };
        break;
      }
      case 'miniGames': {
        const won = require('./adventureStore').useAdventureStore.getState().miniGamesWon;
        if (won < cond.value) return { locked: true, reason: cond.label };
        break;
      }
      case 'evolution': {
        const stage = require('./adventureStore').useAdventureStore.getState().evolutionStage;
        if (stage < cond.value) return { locked: true, reason: cond.label };
        break;
      }
    }
  } catch {}

  return { locked: false, reason: '' };
}

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

    // Check unlock condition
    const lockState = getItemLockState(item);
    if (lockState.locked) return;

    // Premium users get all items free
    let premium = false;
    try {
      const { isPremium } = require('./premiumStore');
      premium = isPremium();
    } catch {}

    if (!premium) {
      // Apply level perk shop discount
      let discount = 0;
      try {
        const { getPerksForLevel } = require('./xpStore');
        const level = require('./xpStore').useXpStore.getState().level;
        discount = getPerksForLevel(level).shopDiscount;
      } catch {}
      const finalPrice = Math.round(item.price * (1 - discount) * 100) / 100;
      // Deduct balance from wallet store
      const walletStore = require('./walletStore').useWalletStore.getState();
      if (walletStore.balance < finalPrice) return;
      walletStore.deductBalance(finalPrice);
    }

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
