import { getOraclePetPurchases } from './transactionHistory';
import { useShopStore } from '../store/shopStore';
import { usePremiumStore } from '../store/premiumStore';
import { usePetStore } from '../store/petStore';
import { type PremiumTier, TIER_ORDER } from '../data/premiumTiers';

function getTierOrdinal(tier: PremiumTier): number {
  return TIER_ORDER.indexOf(tier);
}

export interface RestoreResult {
  shopItemsRestored: string[];
  premiumTierRestored: PremiumTier | null;
  streakRestored: number | null;
  totalFound: number;
}

/**
 * Restore purchases and pet state from on-chain memo records.
 * Reads all oracle-pet:* memos from the user's transaction history.
 */
export async function restorePurchases(userAddress: string): Promise<RestoreResult> {
  const purchases = await getOraclePetPurchases(userAddress);

  const shopPurchases = purchases.filter((p) => p.type === 'shop');
  const premiumPurchases = purchases.filter((p) => p.type === 'premium');
  const syncMemos = purchases.filter((p) => p.type === 'sync');

  // Restore shop items
  const shopItemIds = [...new Set(shopPurchases.map((p) => p.itemId))];
  if (shopItemIds.length > 0) {
    useShopStore.getState().restoreFromChain(shopItemIds);
  }

  // Determine highest premium tier
  let highestTier: PremiumTier = 'none';
  for (const p of premiumPurchases) {
    const tier = p.itemId as PremiumTier;
    if (TIER_ORDER.includes(tier) && getTierOrdinal(tier) > getTierOrdinal(highestTier)) {
      highestTier = tier;
    }
  }
  if (highestTier !== 'none') {
    usePremiumStore.getState().restoreFromChain(highestTier);
  }

  // Restore pet state from most recent sync memo
  let streakRestored: number | null = null;
  if (syncMemos.length > 0) {
    // Sort by timestamp descending, take most recent
    const sorted = syncMemos
      .filter((s) => s.timestamp !== null)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    const latest = sorted[0] ?? syncMemos[0];

    try {
      const data = JSON.parse(latest.itemId);
      if (data.streak !== undefined) {
        usePetStore.getState().restoreFromChain({
          streak: data.streak,
          name: data.name ?? 'Nomi',
          lastActive: data.lastActive ?? '',
        });
        streakRestored = data.streak;
      }
    } catch {
      console.warn('[purchaseRestore] Failed to parse sync memo:', latest.itemId);
    }
  }

  console.log('[purchaseRestore] Restored — shop:', shopItemIds.length, 'premium:', highestTier, 'streak:', streakRestored);

  return {
    shopItemsRestored: shopItemIds,
    premiumTierRestored: highestTier !== 'none' ? highestTier : null,
    streakRestored,
    totalFound: purchases.length,
  };
}
