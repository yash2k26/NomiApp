import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOP_STORAGE_KEY = 'oracle-pet-shop';
const SHOP_LOG = '[shopPurchase]';

// Re-entrancy guard for buyItem — prevents double-tap from submitting two
// concurrent transfers for the same item. Module-level set; lifecycle is
// scoped to a single in-flight purchase per item id.
const purchasesInFlight = new Set<string>();

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
  /** If set, item can be bought with in-app Nomi coins (game-earned currency).
   *  Coin prices are intentionally high — earning coins is the slow path; users
   *  who want speed buy with SOL/SKR or upgrade to a Premium tier. */
  coinPrice?: number;
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
  /** If true, item is excluded from the shop UI entirely (kept in catalog so saved-state references don't break) */
  hidden?: boolean;
}

interface ShopState {
  items: ShopItem[];
  selectedCategory: ShopCategory;
  equippedItemId: string | null;
  equippedAnimationId: string | null;
  // How many free unlocks have been granted via achievement milestones (1 per 3 achievements)
  achievementUnlocksClaimed: number;
  /** Wallet address that last connected and ran restoreFromChain. When the
   *  next connect comes from a DIFFERENT wallet, restoreFromChain knows to
   *  reset all owned flags first (cross-user isolation). When it's the same
   *  wallet, items persist across the brief gap between connect and chain
   *  restore — no flicker, no "items missing" reports. */
  lastConnectedWallet: string | null;
}

interface ShopActions {
  setCategory: (category: ShopCategory) => void;
  // Returns the on-chain tx signature for SOL/SKR purchases (so UI can show
  // a "View on Solscan" link), null for in-game-coin purchases.
  buyItem: (id: string, payWithSkr?: boolean, payWithCoins?: boolean) => Promise<string | null>;
  equipItem: (id: string) => void;
  unequipItem: (id?: string) => void;
  hydrateShop: () => Promise<void>;
  /** Restore owned flags from on-chain memos. Pass walletAddress so we can
   *  detect a wallet-change scenario and reset items before applying. */
  restoreFromChain: (itemIds: string[], walletAddress?: string) => void;
  // Grant 1 free shop item per 3 achievements unlocked. Returns the items unlocked.
  grantAchievementUnlocks: (totalAchievementsUnlocked: number) => ShopItem[];
  /** Reset every per-user field (owned flags, equipped IDs, claimed unlock
   *  count) to a fresh-install state. Items are chain-authoritative so this
   *  is no longer called automatically on disconnect — kept available for
   *  manual use if needed. */
  clearShop: () => void;
}

type ShopStore = ShopState & ShopActions;

const SHOP_ITEMS: ShopItem[] = [
  // Common items
  { id: 'headphones', name: 'Headphones', category: 'Accessories', price: 0.01, coinPrice: 100, image: '\u{1F3A7}', owned: false, skinKey: 'headphones', rarity: 'common', comingSoon: true },
  // Streak freeze — consumable, increments streakFreezes counter on petStore each purchase
  { id: 'streak-freeze', name: 'Streak Freeze', category: 'Accessories', price: 0.01, skrPrice: 10, coinPrice: 50, image: '❄️', owned: false, skinKey: 'streak-freeze', rarity: 'common' },
  // Outfit (texture swap) — equipping repaints the body diffuse map
  { id: 'red-jersey', name: 'Red Jersey', category: 'Shirts', price: 0.01, coinPrice: 100, image: '\u{1F454}', owned: false, skinKey: 'red-jersey', rarity: 'common', comingSoon: true },
  { id: 'party-hat', name: 'Party Hat', category: 'Hats', price: 0.01, coinPrice: 100, image: '\u{1F389}', owned: false, skinKey: 'party-hat', rarity: 'common', comingSoon: true, hidden: true },
  { id: 'beanie', name: 'Beanie', category: 'Hats', price: 0.01, coinPrice: 100, image: '\u{1F9E2}', owned: false, skinKey: 'beanie', rarity: 'common', comingSoon: true, hidden: true },
  { id: 'flip-flops', name: 'Flip Flops', category: 'Shoes', price: 0.01, coinPrice: 100, image: '\u{1FA74}', owned: false, skinKey: 'flip-flops', rarity: 'common', comingSoon: true, hidden: true },
  { id: 'sneakers', name: 'Stylized Shoes', category: 'Shoes', price: 0.01, coinPrice: 100, image: '\u{1F45F}', owned: false, skinKey: 'shoes', rarity: 'common', comingSoon: true },
  // Rare items
  { id: 'hoodie', name: 'Hoodie', category: 'Shirts', price: 0.015, coinPrice: 250, image: '\u{1F455}', owned: false, skinKey: 'hoodie', rarity: 'rare', comingSoon: true, hidden: true },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Accessories', price: 0.015, coinPrice: 250, image: '\u{1F576}\uFE0F', owned: false, skinKey: 'sunglasses', rarity: 'rare', comingSoon: true, hidden: true },
  { id: 'jersey', name: 'Jersey', category: 'Shirts', price: 0.015, coinPrice: 250, image: '\u{1F454}', owned: false, skinKey: 'jersey', rarity: 'rare', comingSoon: true, hidden: true },
  { id: 'boots', name: 'Boots', category: 'Shoes', price: 0.015, coinPrice: 250, image: '\u{1F462}', owned: false, skinKey: 'boots', rarity: 'rare', comingSoon: true, hidden: true },
  // Epic items
  { id: 'tuxedo', name: 'Tuxedo', category: 'Shirts', price: 0.02, coinPrice: 500, image: '\u{1F3BD}', owned: false, skinKey: 'tuxedo', rarity: 'epic', comingSoon: true },
  { id: 'crown', name: 'Crown', category: 'Hats', price: 0.02, coinPrice: 500, image: '\u{1F451}', owned: false, skinKey: 'crown', rarity: 'epic' },
  { id: 'curly-hair', name: 'Curly Hair', category: 'Hats', price: 0.015, coinPrice: 250, image: '\u{1F487}', owned: false, skinKey: 'hair', rarity: 'rare' },
  { id: 'beatrice-hair', name: 'Beatrice Hair', category: 'Hats', price: 0.015, coinPrice: 250, image: '\u{1F9B1}', owned: false, skinKey: 'hair-beatrice', rarity: 'rare' },
  { id: 'kink-hair', name: 'Kink Hair', category: 'Hats', price: 0.015, coinPrice: 250, image: '\u{1F9D1}', owned: false, skinKey: 'hair-kink', rarity: 'rare' },
  { id: 'gold-chain', name: 'Gold Chain', category: 'Accessories', price: 0.02, skrPrice: 25, coinPrice: 500, image: '\u{1F4FF}', owned: false, skinKey: 'gold-chain', rarity: 'epic', comingSoon: true, hidden: true },
  // Tier-exclusive items
  { id: 'neon-jacket', name: 'Neon Jacket', category: 'Shirts', price: 0.02, skrPrice: 30, coinPrice: 500, image: '\u{1F31F}', owned: false, skinKey: 'neon-jacket', rarity: 'epic', tierTag: 'plus_exclusive', comingSoon: true, hidden: true },
  { id: 'gold-wings', name: 'Gold Wings', category: 'Accessories', price: 0.025, skrPrice: 50, coinPrice: 1000, image: '\u2728', owned: false, skinKey: 'gold-wings', rarity: 'legendary', tierTag: 'plus_exclusive', comingSoon: true, hidden: true },
  { id: 'diamond-halo', name: 'Diamond Halo', category: 'Accessories', price: 0.025, skrPrice: 80, coinPrice: 1000, image: '\u{1F48E}', owned: false, skinKey: 'diamond-halo', rarity: 'legendary', tierTag: 'pro_exclusive', comingSoon: true },
  // Animations
  { id: 'anim-backflip', name: 'Backflip', category: 'Animations', price: 0.015, coinPrice: 250, image: '\u{1F938}', owned: false, skinKey: 'anim-backflip', rarity: 'rare' },
  { id: 'anim-excited', name: 'Excited', category: 'Animations', price: 0.01, coinPrice: 100, image: '\u{1F929}', owned: false, skinKey: 'anim-excited', rarity: 'common' },
  { id: 'anim-dance', name: 'Dance', category: 'Animations', price: 0.01, coinPrice: 100, image: '\u{1F57A}', owned: false, skinKey: 'anim-dance', rarity: 'common' },
  { id: 'anim-punch', name: 'Punch', category: 'Animations', price: 0.015, coinPrice: 250, image: '\u{1F4A5}', owned: false, skinKey: 'anim-punch', rarity: 'rare', comingSoon: true, hidden: true },
  { id: 'anim-fallover', name: 'Fall Over', category: 'Animations', price: 0.01, coinPrice: 100, image: '\u{1F92A}', owned: false, skinKey: 'anim-fallover', rarity: 'common' },
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

async function saveShopState(
  ownedIds: string[],
  equippedItemId: string | null,
  equippedAnimationId: string | null,
  achievementUnlocksClaimed?: number,
  lastConnectedWallet?: string | null,
) {
  try {
    await AsyncStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify({
      ownedIds, equippedItemId, equippedAnimationId, achievementUnlocksClaimed, lastConnectedWallet,
    }));
  } catch {}
}

export const useShopStore = create<ShopStore>((set, get) => ({
  items: SHOP_ITEMS.map((i) => ({ ...i })),
  selectedCategory: 'All',
  equippedItemId: null,
  equippedAnimationId: null,
  achievementUnlocksClaimed: 0,
  lastConnectedWallet: null,

  setCategory: (category) => set({ selectedCategory: category }),

  buyItem: async (id, payWithSkr = false, payWithCoins = false) => {
    if (purchasesInFlight.has(id)) {
      console.warn(`${SHOP_LOG} abort: purchase already in flight`, { id });
      return null;
    }
    purchasesInFlight.add(id);
    // Captures the on-chain signature so the caller can render a "View on
    // Solscan" link. Null for coin/free paths.
    let chainTxSig: string | null = null;
    try {
    const startedAt = Date.now();
    console.log(`${SHOP_LOG} start`, { id, payWithSkr, payWithCoins });
    const { items } = get();
    const item = items.find((i) => i.id === id);
    if (!item) {
      console.warn(`${SHOP_LOG} abort: item not found`, { id });
      return null;
    }
    if (item.owned) {
      console.warn(`${SHOP_LOG} abort: item already owned`, { id, name: item.name });
      return null;
    }
    if (item.comingSoon) {
      console.warn(`${SHOP_LOG} abort: item coming soon`, { id, name: item.name });
      return null;
    }

    // Check unlock condition
    const lockState = getItemLockState(item);
    if (lockState.locked) {
      console.warn(`${SHOP_LOG} abort: item locked`, { id, reason: lockState.reason });
      return null;
    }

    // Premium users get items free ONLY if the item was in the catalog at
    // the time they purchased their tier. New items added later are paid for
    // everyone — that's the whole point of this gate.
    let premiumGivesFree = false;
    try {
      const { isItemFreeForCurrentTier } = require('./premiumStore');
      premiumGivesFree = isItemFreeForCurrentTier(item.id);
    } catch {}
    console.log(`${SHOP_LOG} premium status`, { premiumGivesFree, item: item.name, category: item.category });

    if (!premiumGivesFree) {
      const walletStore = require('./walletStore').useWalletStore.getState();
      console.log(`${SHOP_LOG} wallet snapshot`, {
        connected: walletStore.connected,
        address: walletStore.address,
        hasAuthToken: !!walletStore.authToken,
        balance: walletStore.balance,
        skrBalance: walletStore.skrBalance,
        appCoins: walletStore.appCoins,
      });

      // In-app coin payment path — game-earned currency, no on-chain tx.
      // Atomic deduct + ownership grant. Refunds coins if any downstream step
      // throws (defensive — current path is purely local so very unlikely).
      if (payWithCoins && item.coinPrice) {
        const ok = walletStore.deductAppCoins(item.coinPrice);
        if (!ok) {
          console.warn(`${SHOP_LOG} abort: insufficient coins`, {
            required: item.coinPrice,
            available: walletStore.appCoins,
          });
          return null;
        }
        // Grant ownership; refund the coins if anything downstream throws so
        // we never take coins without delivering the item. (The comment used
        // to promise this refund but there was no try/catch actually doing it.)
        try {
          const updated = items.map((i) => (i.id === id ? { ...i, owned: true } : i));
          set({ items: updated });
          const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
          saveShopState(ownedIds, get().equippedItemId, get().equippedAnimationId);
        } catch (e) {
          walletStore.addAppCoins(item.coinPrice);
          console.warn(`${SHOP_LOG} coin purchase failed after deduct — refunded`, e);
          return null;
        }
        console.log(`${SHOP_LOG} coin purchase completed`, {
          id,
          spent: item.coinPrice,
          remaining: walletStore.appCoins - item.coinPrice,
        });
        return null;
      }

      // SKR payment path
      if (payWithSkr && item.skrPrice) {
        if (walletStore.skrBalance < item.skrPrice) {
          console.warn(`${SHOP_LOG} abort: insufficient SKR`, {
            required: item.skrPrice,
            available: walletStore.skrBalance,
          });
          return null;
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
          chainTxSig = txSig;
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
          // Record with the server ledger so future restores resolve via
          // the fast path. Fire-and-forget — chain memo is still the audit
          // log if this call fails.
          try {
            const { confirmPurchase } = require('../lib/purchasesService');
            confirmPurchase({
              wallet: walletStore.address,
              kind: 'shop',
              payload: item.id,
              signature: txSig,
              currency: 'SKR',
              amount: item.skrPrice ?? 0,
            }).catch(() => {});
          } catch {}
          try {
            const { usePendingTxStore } = require('./pendingTxStore');
            usePendingTxStore.getState().addEntry({
              kind: 'shop',
              label: item.name,
              amountDisplay: `${item.skrPrice} SKR`,
              signature: txSig,
              status: 'confirmed',
            });
          } catch {}
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
          return null;
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
          const txSig = await transferSOL(authToken, SHOP_TREASURY, finalPrice, `oracle-pet:shop|${item.id}`);
          chainTxSig = txSig;
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
          // Server ledger fast path (see SKR branch comment).
          try {
            const { confirmPurchase } = require('../lib/purchasesService');
            confirmPurchase({
              wallet: walletStore.address,
              kind: 'shop',
              payload: item.id,
              signature: txSig,
              currency: 'SOL',
              amount: finalPrice,
            }).catch(() => {});
          } catch {}
          // Local pending-tx log for the user-facing audit trail.
          try {
            const { usePendingTxStore } = require('./pendingTxStore');
            usePendingTxStore.getState().addEntry({
              kind: 'shop',
              label: item.name,
              amountDisplay: `${finalPrice.toFixed(4)} SOL`,
              signature: txSig,
              status: 'confirmed',
            });
          } catch {}
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

    // Consumables (e.g. streak-freeze) — increment a counter on petStore instead of
    // marking the item as `owned`, so the user can re-buy. This runs after payment
    // succeeded above (or after the premium-fall-through).
    if (item.skinKey === 'streak-freeze') {
      try {
        const { usePetStore, savePetState } = require('./petStore');
        const cur = usePetStore.getState().streakFreezes ?? 0;
        usePetStore.setState({ streakFreezes: Math.min(99, cur + 1) });
        // CRITICAL: persist the new count immediately. setState alone does
        // NOT write to AsyncStorage — savePetState does. Without this, if
        // the app is force-closed in the window between grant and the next
        // auto-save trigger, the user loses the freeze they just paid for.
        savePetState(usePetStore.getState());
        console.log(`${SHOP_LOG} streak-freeze granted, total: ${cur + 1}`);
      } catch (err: any) {
        console.warn(`${SHOP_LOG} failed to grant streak-freeze:`, err?.message);
      }
      // Roll back any "owned" mutation the payment paths may have set — consumables
      // are never permanently owned.
      const itemsNow = get().items;
      if (itemsNow.find((i) => i.id === id)?.owned) {
        const reset = itemsNow.map((i) => (i.id === id ? { ...i, owned: false } : i));
        set({ items: reset });
        // Persist the rollback too — otherwise the inconsistency (item
        // appears owned to AsyncStorage but streakFreezes is incremented)
        // would survive a kill.
        saveShopState(
          reset.filter((i) => i.owned).map((i) => i.id),
          get().equippedItemId,
          get().equippedAnimationId,
          get().achievementUnlocksClaimed,
          get().lastConnectedWallet,
        );
      }
      return chainTxSig;
    }

    // For free items / premium fall-through, mark owned here (payment paths above
    // already marked owned inline).
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
    return chainTxSig;
    } finally {
      purchasesInFlight.delete(id);
    }
    // Unreachable in practice but TypeScript needs this to satisfy the
    // declared `Promise<string | null>` return type across all branches.
    return null;
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

    // Pet reacts to its new look
    try {
      const mod = require('./personalityStore');
      const ps = mod.usePersonalityStore.getState();
      const petStoreMod = require('./petStore');
      const ownerName = petStoreMod.usePetStore.getState().ownerName;
      ps.setCurrentDialogue(mod.getActionDialogue('equipped', ps.traits, ownerName));
    } catch {}

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

  restoreFromChain: (itemIds: string[], walletAddress?: string) => {
    const { items, lastConnectedWallet } = get();

    // If a different wallet is connecting than the one whose items are
    // currently flagged owned, reset all owned flags FIRST so we don't
    // leak items between users on the same device. Same-wallet reconnect
    // skips this reset and just re-confirms what was already there — no
    // visible flicker, no "items missing" reports.
    const walletChanged = walletAddress != null && lastConnectedWallet != null && lastConnectedWallet !== walletAddress;
    const startingItems = walletChanged
      ? items.map((i) => ({ ...i, owned: false }))
      : items;

    const updated = startingItems.map((i) => (itemIds.includes(i.id) ? { ...i, owned: true } : i));
    set({
      items: updated,
      lastConnectedWallet: walletAddress ?? lastConnectedWallet,
      // If the wallet changed, also clear equipped IDs — old user's equipped
      // crown shouldn't ride along on the new user's pet.
      ...(walletChanged ? { equippedItemId: null, equippedAnimationId: null } : {}),
    });
    const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
    saveShopState(
      ownedIds,
      walletChanged ? null : get().equippedItemId,
      walletChanged ? null : get().equippedAnimationId,
      get().achievementUnlocksClaimed,
      walletAddress ?? lastConnectedWallet,
    );
    console.log('[shopStore] restoreFromChain — restored:', itemIds.length, 'walletChanged:', walletChanged);
  },

  clearShop: () => {
    // Reset to fresh-install state. Items themselves come from the
    // SHOP_ITEMS catalog, so we map back to that pristine list (owned
    // flags off). Equipped IDs + claimed-unlock counter clear too.
    set({
      items: SHOP_ITEMS.map((i) => ({ ...i })),
      equippedItemId: null,
      equippedAnimationId: null,
      achievementUnlocksClaimed: 0,
    });
  },

  grantAchievementUnlocks: (totalAchievementsUnlocked: number) => {
    const { items, achievementUnlocksClaimed } = get();
    // 1 free shop item for every 3 achievements unlocked
    const earned = Math.floor(totalAchievementsUnlocked / 3);
    const owed = earned - achievementUnlocksClaimed;
    if (owed <= 0) return [];

    // Only unlock items whose assets have actually shipped — comingSoon items
    // have no accessory node / texture in PetRenderer, so equipping them renders nothing.
    const candidates = items.filter((i) => !i.owned && !i.comingSoon);
    const toUnlock = candidates.slice(0, owed);
    if (toUnlock.length === 0) return [];

    const unlockedIds = new Set(toUnlock.map((i) => i.id));
    const updated = items.map((i) =>
      unlockedIds.has(i.id) ? { ...i, owned: true } : i
    );
    const newClaimed = achievementUnlocksClaimed + toUnlock.length;
    set({ items: updated, achievementUnlocksClaimed: newClaimed });
    const ownedIds = updated.filter((i) => i.owned).map((i) => i.id);
    saveShopState(ownedIds, get().equippedItemId, get().equippedAnimationId, newClaimed);
    console.log(`[shopStore] grantAchievementUnlocks — unlocked ${toUnlock.length} item(s):`, toUnlock.map((i) => i.id));
    return toUnlock;
  },

  hydrateShop: async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOP_STORAGE_KEY);
      if (!stored) return;
      const { ownedIds, equippedItemId, equippedAnimationId, achievementUnlocksClaimed, lastConnectedWallet } = JSON.parse(stored) as {
        ownedIds: string[];
        equippedItemId: string | null;
        equippedAnimationId?: string | null;
        achievementUnlocksClaimed?: number;
        lastConnectedWallet?: string | null;
      };
      const { items } = get();
      // Strip owned IDs pointing to comingSoon items — those don't have
      // ready animations/assets yet, so showing them as owned would let
      // the user equip an item that renders broken or empty.
      //
      // The user's chain memo (oracle-pet:shop|<id>) is preserved on chain
      // forever. When the asset ships (item flipped to comingSoon: false in
      // a future release), chain restore re-applies owned=true automatically
      // on next reconnect — no manual provisioning needed.
      const validOwnedIds = ownedIds.filter((id) => {
        const def = items.find((i) => i.id === id);
        return def && !def.comingSoon;
      });
      const updated = items.map((i) => ({
        ...i,
        owned: validOwnedIds.includes(i.id),
      }));
      // If the equipped item got dropped, clear the slot so the renderer falls back to default.
      const validEquipped = equippedItemId && validOwnedIds.includes(equippedItemId) ? equippedItemId : null;
      const validEquippedAnim = equippedAnimationId && validOwnedIds.includes(equippedAnimationId) ? equippedAnimationId : null;
      set({
        items: updated,
        equippedItemId: validEquipped,
        equippedAnimationId: validEquippedAnim,
        achievementUnlocksClaimed: achievementUnlocksClaimed ?? 0,
        lastConnectedWallet: lastConnectedWallet ?? null,
      });
      // Persist the cleaned-up state so the next hydrate doesn't re-do this work.
      if (validOwnedIds.length !== ownedIds.length || validEquipped !== equippedItemId || validEquippedAnim !== (equippedAnimationId ?? null)) {
        saveShopState(validOwnedIds, validEquipped, validEquippedAnim, achievementUnlocksClaimed ?? 0, lastConnectedWallet ?? null);
      }
    } catch {}
  },
}));
