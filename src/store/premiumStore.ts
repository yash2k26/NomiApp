import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PremiumTier, TIER_CONFIGS, TIER_ORDER, getTierOrdinal, getUpgradeCost } from '../data/premiumTiers';

const PREMIUM_STORAGE_KEY = 'oracle-pet-premium';

export interface PremiumState {
  tier: PremiumTier;
  isPremium: boolean;          // derived: tier !== 'none' — kept for backward compat
  purchaseDate: string | null;
}

interface PremiumActions {
  purchaseTier: (targetTier: PremiumTier) => Promise<string>;
  hydratePremium: () => Promise<void>;
}

type PremiumStore = PremiumState & PremiumActions;

function savePremiumState(state: PremiumState) {
  AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
    tier: state.tier,
    purchaseDate: state.purchaseDate,
  })).catch(() => {});
}

export const usePremiumStore = create<PremiumStore>((set, get) => ({
  tier: 'none',
  isPremium: false,
  purchaseDate: null,

  purchaseTier: async (targetTier: PremiumTier) => {
    const current = get().tier;
    if (getTierOrdinal(targetTier) <= getTierOrdinal(current)) return ''; // already at or above

    const cost = getUpgradeCost(current, targetTier);
    const walletStore = require('./walletStore').useWalletStore.getState();
    if (walletStore.balance < cost) throw new Error(`Not enough SOL. Need ${cost} but have ${walletStore.balance.toFixed(2)}.`);
    if (!walletStore.authToken) throw new Error('Wallet not connected');

    // On-chain SOL transfer to treasury
    const { transferSOL } = require('../lib/solanaTransactions');
    const { SHOP_TREASURY } = require('../lib/solanaClient');
    const txSig = await transferSOL(walletStore.authToken, SHOP_TREASURY, cost);

    // Label the transaction
    try {
      const { labelTransaction } = require('./txHistoryStore');
      labelTransaction(txSig, `Premium ${targetTier.charAt(0).toUpperCase() + targetTier.slice(1)} Upgrade`);
    } catch {}

    // Optimistic balance deduction + refresh
    walletStore.deductBalance(cost);
    await walletStore.refreshBalance();

    const now = new Date().toISOString();
    set({ tier: targetTier, isPremium: true, purchaseDate: now });
    savePremiumState(get());

    // Diamond unlocks all shop items
    const config = TIER_CONFIGS[targetTier];
    if (config.allShopItemsFree) {
      const shopStore = require('./shopStore').useShopStore;
      const { items } = shopStore.getState();
      const updated = items.map((i: any) => ({ ...i, owned: true }));
      shopStore.setState({ items: updated });
      const ownedIds = updated.map((i: any) => i.id);
      AsyncStorage.setItem('oracle-pet-shop', JSON.stringify({
        ownedIds,
        equippedItemId: shopStore.getState().equippedItemId,
        equippedAnimationId: shopStore.getState().equippedAnimationId,
      })).catch(() => {});
    }

    // Award XP scaled by tier
    const xpByTier: Record<PremiumTier, number> = { none: 0, silver: 50, gold: 100, diamond: 200 };
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(xpByTier[targetTier], 'premium-purchase');
    } catch {}

    return txSig;
  },

  hydratePremium: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      // Migration: old format had isPremium boolean, no tier
      if (data.tier && TIER_ORDER.includes(data.tier)) {
        set({
          tier: data.tier,
          isPremium: data.tier !== 'none',
          purchaseDate: data.purchaseDate ?? null,
        });
      } else if (data.isPremium) {
        // Old 2 SOL users → gold tier (closest perk match)
        set({ tier: 'gold', isPremium: true, purchaseDate: data.purchaseDate ?? null });
      }
    } catch {}
  },
}));

// ── Tier config helper ──

function getTierConfig(): (typeof TIER_CONFIGS)[PremiumTier] {
  return TIER_CONFIGS[usePremiumStore.getState().tier];
}

// ── Exported helpers (consumed by other stores via lazy require) ──

export function isPremium(): boolean {
  return usePremiumStore.getState().tier !== 'none';
}

export function getCurrentTier(): PremiumTier {
  return usePremiumStore.getState().tier;
}

export function getPremiumRegenRate(): number {
  return getTierConfig().staminaRegenPerHour;
}

export function getPremiumCooldownMultiplier(action: string): number {
  const config = getTierConfig();
  if (config.tier === 'none') return 1;
  if (action.startsWith('miniGame') && !config.miniGameCooldown) return 0;
  return config.cooldownMultiplier;
}

export function getPremiumSpinConfig() {
  const config = getTierConfig();
  return {
    maxFreeSpins: config.freeSpinsPerDay,
    maxPaidSpins: config.freeSpinsPerDay + 2,
    paidSpinCost: config.tier === 'diamond' ? 0 : 0.2,
  };
}

export function getPremiumLootBonus(): number {
  return getTierConfig().lootBonus;
}

export function getPremiumXpBonus(): number {
  return getTierConfig().xpBonus;
}

export function getPremiumCalendarMultiplier(): number {
  return getTierConfig().calendarXpMultiplier;
}

// Re-export for backward compat
export { type PremiumTier, TIER_CONFIGS, isAtLeastTier, getUpgradeCost } from '../data/premiumTiers';
