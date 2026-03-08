import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOP_STORAGE_KEY = 'oracle-pet-shop';
const SHOP_LOG = '[shopPurchase]';

export type ShopCategory = 'All' | 'Hats' | 'Shirts' | 'Shoes' | 'Accessories' | 'Animations';

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
  /** If set, item can be bought with SKR tokens instead of SOL */
  skrPrice?: number;
  image: string;
  owned: boolean;
  /** Skin key used by petStore when equipped */
  skinKey: string;
  rarity: ItemRarity;
  /** If set, item only visible/purchasable for users at this tier tag level */
  tierTag?: string;
  /** If set, item requires meeting this condition before purchase */
  unlockCondition?: ItemUnlockCondition;
  /** If true, item is teased but not yet available */
  comingSoon?: boolean;
}

interface ShopState {
  items: ShopItem[];
  selectedCategory: ShopCategory;
  equippedItemId: string | null;
  equippedAnimationId: string | null;
}

interface ShopActions {
  setCategory: (category: ShopCategory) => void;
  buyItem: (id: string, payWithSkr?: boolean) => Promise<void>;
  equipItem: (id: string) => void;
  unequipItem: (id?: string) => void;
  hydrateShop: () => Promise<void>;
}

type ShopStore = ShopState & ShopActions;

const SHOP_ITEMS: ShopItem[] = [
  // Common items
  { id: 'headphones', name: 'Headphones', category: 'Accessories', price: 0.001, image: '\u{1F3A7}', owned: false, skinKey: 'headphones', rarity: 'common' },
  { id: 'party-hat', name: 'Party Hat', category: 'Hats', price: 0.002, image: '\u{1F389}', owned: false, skinKey: 'party-hat', rarity: 'common', comingSoon: true },
  { id: 'beanie', name: 'Beanie', category: 'Hats', price: 0.002, image: '\u{1F9E2}', owned: false, skinKey: 'beanie', rarity: 'common', comingSoon: true },
  { id: 'flip-flops', name: 'Flip Flops', category: 'Shoes', price: 0.001, image: '\u{1FA74}', owned: false, skinKey: 'flip-flops', rarity: 'common', comingSoon: true },
  { id: 'sneakers', name: 'Sneakers', category: 'Shoes', price: 0.002, image: '\u{1F45F}', owned: false, skinKey: 'sneakers', rarity: 'common', comingSoon: true },
  // Rare items
  { id: 'hoodie', name: 'Hoodie', category: 'Shirts', price: 0.003, image: '\u{1F455}', owned: false, skinKey: 'hoodie', rarity: 'rare', comingSoon: true },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Accessories', price: 0.003, image: '\u{1F576}\uFE0F', owned: false, skinKey: 'sunglasses', rarity: 'rare', comingSoon: true },
  { id: 'jersey', name: 'Jersey', category: 'Shirts', price: 0.004, image: '\u{1F454}', owned: false, skinKey: 'jersey', rarity: 'rare', comingSoon: true },
  { id: 'boots', name: 'Boots', category: 'Shoes', price: 0.004, image: '\u{1F462}', owned: false, skinKey: 'boots', rarity: 'rare', comingSoon: true },
  // Epic items
  { id: 'tuxedo', name: 'Tuxedo', category: 'Shirts', price: 0.005, image: '\u{1F3BD}', owned: false, skinKey: 'tuxedo', rarity: 'epic', comingSoon: true },
  { id: 'crown', name: 'Crown', category: 'Hats', price: 0.001, image: '\u{1F451}', owned: false, skinKey: 'crown', rarity: 'epic' },
  { id: 'gold-chain', name: 'Gold Chain', category: 'Accessories', price: 0.005, skrPrice: 25, image: '\u{1F4FF}', owned: false, skinKey: 'gold-chain', rarity: 'epic', comingSoon: true },
  // Tier-exclusive items
  { id: 'neon-jacket', name: 'Neon Jacket', category: 'Shirts', price: 0.006, skrPrice: 30, image: '\u{1F31F}', owned: false, skinKey: 'neon-jacket', rarity: 'epic', tierTag: 'plus_exclusive', comingSoon: true },
  { id: 'gold-wings', name: 'Gold Wings', category: 'Accessories', price: 0.008, skrPrice: 50, image: '\u2728', owned: false, skinKey: 'gold-wings', rarity: 'legendary', tierTag: 'plus_exclusive', comingSoon: true },
  { id: 'diamond-halo', name: 'Diamond Halo', category: 'Accessories', price: 0.01, skrPrice: 80, image: '\u{1F48E}', owned: false, skinKey: 'diamond-halo', rarity: 'legendary', tierTag: 'pro_exclusive', comingSoon: true },
  // Animations
  { id: 'anim-backflip', name: 'Backflip', category: 'Animations', price: 0.002, image: '\u{1F938}', owned: false, skinKey: 'anim-backflip', rarity: 'rare', comingSoon: true },
  { id: 'anim-excited', name: 'Excited', category: 'Animations', price: 0.001, image: '\u{1F929}', owned: false, skinKey: 'anim-excited', rarity: 'common' },
  { id: 'anim-dance', name: 'Dance', category: 'Animations', price: 0.001, image: '\u{1F57A}', owned: false, skinKey: 'anim-dance', rarity: 'common' },
  { id: 'anim-punch', name: 'Punch', category: 'Animations', price: 0.002, image: '\u{1F4A5}', owned: false, skinKey: 'anim-punch', rarity: 'rare', comingSoon: true },
  { id: 'anim-fallover', name: 'Fall Over', category: 'Animations', price: 0.001, image: '\u{1F92A}', owned: false, skinKey: 'anim-fallover', rarity: 'common', comingSoon: true },
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

async function saveShopState(ownedIds: string[], equippedItemId: string | null, equippedAnimationId: string | null) {
  try {
    await AsyncStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify({ ownedIds, equippedItemId, equippedAnimationId }));
  } catch {}
}

export const useShopStore = create<ShopStore>((set, get) => ({
  items: SHOP_ITEMS.map((i) => ({ ...i })),
  selectedCategory: 'All',
  equippedItemId: null,
  equippedAnimationId: null,

  setCategory: (category) => set({ selectedCategory: category }),

  buyItem: async (id, payWithSkr = false) => {
    const startedAt = Date.now();
    console.log(`${SHOP_LOG} start`, { id, payWithSkr });
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item) {
      console.warn(`${SHOP_LOG} abort: item not found`, { id });
      return;
    }
    if (item.owned) {
      console.warn(`${SHOP_LOG} abort: item already owned`, { id, name: item.name });
      return;
    }
    if (item.comingSoon) {
      console.warn(`${SHOP_LOG} abort: item coming soon`, { id, name: item.name });
      return;
    }

    // Check unlock condition
    const lockState = getItemLockState(item);
    if (lockState.locked) {
      console.warn(`${SHOP_LOG} abort: item locked`, { id, reason: lockState.reason });
      return;
    }

    // Premium users get all items free
    let premium = false;
    try {
      const { isPremium } = require('./premiumStore');
      premium = isPremium();
    } catch {}
    console.log(`${SHOP_LOG} premium status`, { premium, item: item.name, category: item.category });

    if (!premium) {
      const walletStore = require('./walletStore').useWalletStore.getState();
      console.log(`${SHOP_LOG} wallet snapshot`, {
        connected: walletStore.connected,
        address: walletStore.address,
        hasAuthToken: !!walletStore.authToken,
        balance: walletStore.balance,
        skrBalance: walletStore.skrBalance,
      });

      // SKR payment path
      if (payWithSkr && item.skrPrice) {
        if (walletStore.skrBalance < item.skrPrice) {
          console.warn(`${SHOP_LOG} abort: insufficient SKR`, {
            required: item.skrPrice,
            available: walletStore.skrBalance,
          });
          return;
        }

        const authToken = walletStore.authToken;
        if (authToken) {
          const { transferSkr } = require('../lib/skrToken');
          const { SHOP_TREASURY } = require('../lib/solanaClient');
          console.log(`${SHOP_LOG} sending SKR tx`, {
            to: SHOP_TREASURY,
            amount: item.skrPrice,
            itemId: item.id,
            itemName: item.name,
          });
          const txSig = await transferSkr(authToken, SHOP_TREASURY, item.skrPrice);
          console.log(`${SHOP_LOG} SKR tx sent`, { txSig, itemId: item.id });

          try {
            const { labelTransaction } = require('./txHistoryStore');
            labelTransaction(txSig, `Bought ${item.name} (SKR)`);
          } catch {}

          // Mark owned BEFORE refresh — tx already succeeded on-chain
          const updated = items.map((i) => (i.id === id ? { ...i, owned: true } : i));
          set({ items: updated });
          const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
          saveShopState(ownedIds, get().equippedItemId, get().equippedAnimationId);

          try { await walletStore.refreshSkrBalance(); } catch {}
          try { await walletStore.refreshBalance(); } catch {}
          console.log(`${SHOP_LOG} SKR purchase completed`, {
            id,
            txSig,
            elapsedMs: Date.now() - startedAt,
          });
        } else {
          console.error(`${SHOP_LOG} missing auth token for SKR payment`, { id, item: item.name });
          throw new Error('Wallet not connected. Please reconnect to purchase.');
        }
      } else {
        // SOL payment path
        // Apply level perk shop discount
        let discount = 0;
        try {
          const { getPerksForLevel } = require('./xpStore');
          const level = require('./xpStore').useXpStore.getState().level;
          discount = getPerksForLevel(level).shopDiscount;
        } catch {}
        const finalPrice = Math.round(item.price * (1 - discount) * 1000000) / 1000000;
        console.log(`${SHOP_LOG} SOL pricing`, {
          itemId: item.id,
          itemName: item.name,
          basePrice: item.price,
          discount,
          finalPrice,
        });

        if (walletStore.balance < finalPrice) {
          console.warn(`${SHOP_LOG} abort: insufficient SOL`, {
            required: finalPrice,
            available: walletStore.balance,
          });
          return;
        }

        // On-chain SOL transfer to shop treasury
        const authToken = walletStore.authToken;
        if (authToken && finalPrice > 0) {
          const { transferSOL } = require('../lib/solanaTransactions');
          const { SHOP_TREASURY } = require('../lib/solanaClient');
          console.log(`${SHOP_LOG} sending SOL tx`, {
            to: SHOP_TREASURY,
            amountSOL: finalPrice,
            itemId: item.id,
            itemName: item.name,
          });
          const txSig = await transferSOL(authToken, SHOP_TREASURY, finalPrice);
          console.log(`${SHOP_LOG} SOL tx sent`, { txSig, itemId: item.id });

          try {
            const { labelTransaction } = require('./txHistoryStore');
            labelTransaction(txSig, `Bought ${item.name}`);
          } catch {}

          // Mark owned BEFORE refreshBalance — tx already succeeded on-chain
          const updated = items.map((i) => (i.id === id ? { ...i, owned: true } : i));
          set({ items: updated });
          const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
          saveShopState(ownedIds, get().equippedItemId, get().equippedAnimationId);

          try { await walletStore.refreshBalance(); } catch {}
          console.log(`${SHOP_LOG} SOL purchase completed`, {
            id,
            txSig,
            elapsedMs: Date.now() - startedAt,
          });
        } else if (finalPrice > 0) {
          console.error(`${SHOP_LOG} missing auth token for SOL payment`, { id, item: item.name });
          throw new Error('Wallet not connected. Please reconnect to purchase.');
        }
      }
    }

    // For free items or SKR path, mark owned here
    const { items: currentItems } = get();
    const alreadyOwned = currentItems.find((i) => i.id === id)?.owned;
    if (!alreadyOwned) {
      const updated = currentItems.map((i) => (i.id === id ? { ...i, owned: true } : i));
      set({ items: updated });
    }

    const finalItems = get().items;
    const ownedIds = finalItems.filter((i) => i.owned).map((i) => i.id);
    saveShopState(ownedIds, get().equippedItemId, get().equippedAnimationId);

    // XP for buying
    const xpStore = require('./xpStore').useXpStore.getState();
    xpStore.addXp(30, 'buy');
    xpStore.checkAchievements({ ownedCount: ownedIds.length, totalItems: finalItems.length });
    console.log(`${SHOP_LOG} done`, {
      id,
      payWithSkr,
      elapsedMs: Date.now() - startedAt,
      ownedCount: ownedIds.length,
    });
  },

  equipItem: (id) => {
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item || !item.owned) return;

    const isAnimation = item.category === 'Animations';
    if (isAnimation) {
      // Clear accessory when equipping animation
      set({ equippedAnimationId: id, equippedItemId: null });
    } else {
      // Clear animation when equipping accessory
      set({ equippedItemId: id, equippedAnimationId: null });
    }

    const ownedIds = items.filter((i) => i.owned).map((i) => i.id);
    saveShopState(
      ownedIds,
      isAnimation ? null : id,
      isAnimation ? id : null
    );

    // XP for equipping
    const xpStore = require('./xpStore').useXpStore.getState();
    xpStore.addXp(5, 'equip');
    xpStore.incrementCounter('equipCount');
    xpStore.updateQuestProgress('equip');
  },

  unequipItem: (id?: string) => {
    const { items, equippedItemId, equippedAnimationId } = get();
    // If an id is provided, figure out which slot to clear
    if (id) {
      const item = items.find((i) => i.id === id);
      if (item?.category === 'Animations') {
        set({ equippedAnimationId: null });
        saveShopState(items.filter((i) => i.owned).map((i) => i.id), equippedItemId, null);
        return;
      }
    }
    set({ equippedItemId: null });
    saveShopState(items.filter((i) => i.owned).map((i) => i.id), null, equippedAnimationId);
  },

  hydrateShop: async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOP_STORAGE_KEY);
      if (!stored) return;
      const { ownedIds, equippedItemId, equippedAnimationId } = JSON.parse(stored) as {
        ownedIds: string[];
        equippedItemId: string | null;
        equippedAnimationId?: string | null;
      };
      const { items } = get();
      const updated = items.map((i) => ({
        ...i,
        owned: ownedIds.includes(i.id),
      }));
      set({ items: updated, equippedItemId, equippedAnimationId: equippedAnimationId ?? null });
    } catch {}
  },
}));
