import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PremiumTier, type TierCurrency, TIER_CONFIGS, TIER_ORDER, getTierOrdinal } from '../data/premiumTiers';

const PREMIUM_STORAGE_KEY = 'oracle-pet-premium';

export interface PremiumState {
  tier: PremiumTier;
  isPremium: boolean;          // derived: tier !== 'none' — kept for backward compat
  purchaseDate: string | null;
  /** Snapshot of shop item IDs that are FREE for this user as part of their
   *  tier perks. Captured at purchase time. Items added to the catalog after
   *  this snapshot remain paid even for premium users — that's the whole
   *  point. Empty array = no perked items (e.g. tier='none', or
   *  pre-snapshot legacy users not yet migrated). */
  perkedItemIds: string[];
}

interface PremiumActions {
  /** Purchase a tier. If `useCurrency` is omitted, the tier's primary currency
   *  is used. Pass the alternative currency (when one is configured on the
   *  tier) to charge the alt price instead — e.g. Pro is primarily 1799 SKR
   *  but accepts 0.99 SOL as an alternative. */
  purchaseTier: (targetTier: PremiumTier, useCurrency?: TierCurrency) => Promise<string>;
  hydratePremium: () => Promise<void>;
  restoreFromChain: (tier: PremiumTier) => void;
  /** Privacy reset for shared devices. If the persisted premium cache is
   *  owner-tagged for a DIFFERENT wallet than `wallet`, clear premium in
   *  memory and rewrite the cache for the new wallet. The new wallet's real
   *  entitlement (if any) is then restored by the upgrade-only
   *  restoreFromChain that runs right after. Caches with no owner tag
   *  (legacy) are left intact — we can't prove they're the wrong user, and
   *  wrongly nuking a legitimately-paid tier is exactly the bug being fixed. */
  reconcileForWallet: (wallet: string) => Promise<void>;
  /** Take a snapshot of the current shop catalog and store it as the user's
   *  perked items. Called automatically on Pro purchase + restore; can also
   *  be called manually if needed. No-op when shopStore not available. */
  snapshotPerkedItems: () => void;
}

type PremiumStore = PremiumState & PremiumActions;

function savePremiumState(state: PremiumState): Promise<void> {
  // Tag the cache with the wallet it belongs to. Premium is
  // chain-authoritative (lives in oracle-pet:premium|* memos forever); this
  // cache is the durable safety net so a paying user keeps Pro through
  // app-update / disconnect / RPC outage WITHOUT waiting on a slow memo scan.
  // The owner tag lets a shared device reset premium for a *different*
  // wallet without nuking the real owner's paid tier (the bug we hit:
  // disconnect deleted this cache, then chain restore couldn't refill fast
  // enough and Pro vanished — same failure shopStore already fixed).
  let walletAddress: string | null = null;
  try {
    walletAddress = require('./walletStore').useWalletStore.getState().address || null;
  } catch {}
  return AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
    tier: state.tier,
    purchaseDate: state.purchaseDate,
    perkedItemIds: state.perkedItemIds,
    walletAddress,
  })).catch((err) => {
    console.warn('[premiumStore] savePremiumState failed:', err?.message ?? err);
  });
}

function snapshotCatalog(): string[] {
  try {
    const shopStore = require('./shopStore').useShopStore;
    const { items } = shopStore.getState();
    return items.map((i: any) => i.id);
  } catch {
    return [];
  }
}

export const usePremiumStore = create<PremiumStore>((set, get) => ({
  tier: 'none',
  isPremium: false,
  purchaseDate: null,
  perkedItemIds: [],

  snapshotPerkedItems: () => {
    const ids = snapshotCatalog();
    if (ids.length === 0) return; // shop not ready / empty — try later
    set({ perkedItemIds: ids });
    savePremiumState(get());
    console.log('[premiumStore] snapshotted perked items:', ids.length);
  },

  purchaseTier: async (targetTier: PremiumTier, useCurrency?: TierCurrency) => {
    const current = get().tier;
    if (getTierOrdinal(targetTier) <= getTierOrdinal(current)) {
      // Previously returned '' — caller's success-toast block then fired a
      // "Welcome to Plus!" notification for a no-op no-charge. Now we throw
      // a clear, parseable error so the caller catches it like any other
      // failure.
      throw new Error(`You're already at ${current.toUpperCase()} tier or above.`);
    }

    const config = TIER_CONFIGS[targetTier];
    // Pick primary vs. alternative pricing based on caller's currency choice.
    const useAlt =
      useCurrency != null &&
      config.alternativeCurrency != null &&
      useCurrency === config.alternativeCurrency &&
      useCurrency !== config.currency;
    const cost = useAlt ? config.alternativePrice! : config.price;
    const currency: TierCurrency = useAlt ? config.alternativeCurrency! : config.currency;
    const walletStore = require('./walletStore').useWalletStore.getState();
    if (!walletStore.authToken) throw new Error('Wallet not connected');

    let txSig: string;
    const memo = `oracle-pet:premium|${targetTier}|${currency}`;

    if (currency === 'SKR') {
      // SKR token transfer
      if (walletStore.skrBalance < cost) {
        throw new Error(`Not enough SKR. Need ${cost} but have ${walletStore.skrBalance.toFixed(2)}.`);
      }
      const { transferSkr } = require('../lib/skrToken');
      const { SHOP_TREASURY } = require('../lib/solanaClient');
      txSig = await transferSkr(walletStore.authToken, SHOP_TREASURY, cost, memo);
    } else {
      // SOL transfer
      if (walletStore.balance < cost) {
        throw new Error(`Not enough SOL. Need ${cost} but have ${walletStore.balance.toFixed(2)}.`);
      }
      const { transferSOL } = require('../lib/solanaTransactions');
      const { SHOP_TREASURY } = require('../lib/solanaClient');
      txSig = await transferSOL(walletStore.authToken, SHOP_TREASURY, cost, memo);
    }

    // Fire-and-forget finalization check. The user's tier is activated
    // immediately on 'confirmed' (below) so UX stays fast — this just
    // logs/analytics whether the purchase made it to 'finalized' commitment
    // (eliminates reorg-rollback risk for the audit log).
    try {
      const { awaitFinalizedRaw } = require('../lib/solanaClient');
      awaitFinalizedRaw(txSig).then(() => {
        console.log('[premiumStore] Pro purchase finalized:', txSig);
      }).catch((e: any) => {
        try {
          const { captureError } = require('../lib/analytics');
          captureError(new Error('premium tx did not finalize: ' + (e?.message ?? e)), {
            surface: 'premium_finalize', signature: txSig, tier: targetTier,
          });
        } catch {}
      });
    } catch {}

    // CRITICAL: activate the tier the moment the transfer succeeds, BEFORE
    // any other awaits or side-effects. Previously the deductBalance +
    // refreshBalance/refreshSkrBalance + labelTransaction calls happened
    // first, and any failure between them and the tier-set (network drop,
    // wallet timeout) would leave the user with money sent and no Pro tier
    // active. A real v1.1 user reported exactly this. Now: chain says yes →
    // tier is on, immediately. Everything below is housekeeping.
    const now = new Date().toISOString();
    const perkedItemIds = TIER_CONFIGS[targetTier].allShopItemsFree
      ? snapshotCatalog()
      : [];
    set({ tier: targetTier, isPremium: true, purchaseDate: now, perkedItemIds });

    // Persist the paid tier. Three layers of defense:
    //   1. Primary save (resolves immediately even if AsyncStorage write is
    //      still in flight — savePremiumState returns the underlying promise).
    //   2. Retry after a tick if first save threw.
    //   3. Mirror to a fallback `oracle-pet-premium-fallback` key keyed by
    //      tx signature, so even if the main premium key is corrupted /
    //      truncated, hydratePremium can recover from the fallback.
    //   4. If BOTH fail, surface a visible notification so the user knows
    //      to force-close and reopen (chain memo restore will pick it up).
    let primarySaveOk = false;
    try {
      await savePremiumState(get());
      primarySaveOk = true;
    } catch {
      await new Promise(r => setTimeout(r, 50));
      try {
        await savePremiumState(get());
        primarySaveOk = true;
      } catch {}
    }

    // Fallback record keyed by tx signature — non-fatal if it fails.
    try {
      await AsyncStorage.setItem(
        'oracle-pet-premium-fallback',
        JSON.stringify({ tier: targetTier, signature: txSig, savedAt: Date.now() }),
      );
    } catch {}

    if (!primarySaveOk) {
      try {
        const { notify } = require('../lib/notify');
        notify.warning(
          'Premium activated but not saved',
          'Your purchase went through on chain. Force-close and reopen the app — your tier will restore automatically.',
          { category: 'premium' },
        );
        const { captureError } = require('../lib/analytics');
        captureError(new Error('premium persist failed after 2 attempts'), {
          surface: 'premium_persist',
          tier: targetTier,
          signature: txSig,
        });
      } catch {}
    }

    // Record the purchase with the server ledger. Fire-and-forget — the
    // ledger is a FAST PATH for next-launch restore, not the source of
    // truth. Chain memo is still authoritative; if this fails the user's
    // tier still restores via the slow memo-scan fallback.
    try {
      const { confirmPurchase } = require('../lib/purchasesService');
      confirmPurchase({
        wallet: walletStore.address,
        kind: 'premium',
        payload: targetTier,
        signature: txSig,
        currency,
        amount: cost,
      }).catch(() => {});
    } catch {}

    // Log to the local pending-tx queue so the user has a permanent audit
    // entry visible in the Profile screen, even after a reinstall takes
    // away the success toast.
    try {
      const { usePendingTxStore } = require('./pendingTxStore');
      usePendingTxStore.getState().addEntry({
        kind: 'premium',
        label: `${TIER_CONFIGS[targetTier].label} tier`,
        amountDisplay: `${cost} ${currency}`,
        signature: txSig,
        status: 'confirmed',
      });
      const { awaitFinalizedRaw } = require('../lib/solanaClient');
      awaitFinalizedRaw(txSig)
        .then(() => usePendingTxStore.getState().promoteToFinalized(txSig))
        .catch(() => {});
    } catch {}

    // Housekeeping below — wrapped so failures here can't undo the tier
    // activation above.
    try {
      if (currency === 'SKR') {
        walletStore.deductSkr(cost);
        await walletStore.refreshSkrBalance();
      } else {
        walletStore.deductBalance(cost);
        await walletStore.refreshBalance();
      }
    } catch (err: any) {
      console.warn('[premiumStore] balance refresh failed (non-fatal):', err?.message ?? err);
    }

    try {
      const { labelTransaction } = require('./txHistoryStore');
      labelTransaction(txSig, `Premium ${targetTier.charAt(0).toUpperCase() + targetTier.slice(1)} Upgrade`);
    } catch {}

    // Award XP scaled by tier
    const xpByTier: Record<PremiumTier, number> = { none: 0, plus: 75, pro: 200 };
    try {
      const xpStore = require('./xpStore').useXpStore.getState();
      xpStore.addXp(xpByTier[targetTier], 'premium-purchase');
    } catch {}

    return txSig;
  },

  restoreFromChain: (tier: PremiumTier) => {
    // Never downgrade. Previously this unconditionally `set({ tier })` —
    // if a stale chain scan handed us a lower tier than what's already in
    // memory (e.g., legacy "plus" memo found before the newer "pro" memo),
    // the user would be silently downgraded.
    const currentTier = get().tier;
    if (getTierOrdinal(tier) < getTierOrdinal(currentTier)) {
      console.log('[premiumStore] restoreFromChain — skipping downgrade from', currentTier, 'to', tier);
      return;
    }
    // For Pro/allShopItemsFree tiers, ALWAYS refresh the perked-items snapshot
    // against the current catalog on restore. Previously this only ran when
    // perkedItemIds was empty — so a user who restored Pro with a partial
    // snapshot from a previous build stayed stuck with that partial subset.
    const existing = get().perkedItemIds;
    const config = TIER_CONFIGS[tier];
    let perkedItemIds = existing;
    if (config.allShopItemsFree) {
      const fresh = snapshotCatalog();
      if (fresh.length > 0) perkedItemIds = fresh;
      else if (existing.length === 0) perkedItemIds = []; // shop not hydrated; will be refreshed by next snapshotPerkedItems call
    }
    set({ tier, isPremium: true, purchaseDate: get().purchaseDate, perkedItemIds });
    savePremiumState(get());
    console.log('[premiumStore] restoreFromChain — restored tier:', tier, 'perked:', perkedItemIds.length);
  },

  reconcileForWallet: async (wallet: string) => {
    try {
      const raw = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      // Cache is owner-tagged for a DIFFERENT wallet → privacy reset. The
      // new wallet's real entitlement is restored by the upgrade-only
      // restoreFromChain that runs right after this.
      if (data.walletAddress && wallet && data.walletAddress !== wallet) {
        console.log('[premiumStore] cache owned by different wallet — privacy reset');
        set({ tier: 'none', isPremium: false, purchaseDate: null, perkedItemIds: [] });
        await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
          tier: 'none',
          purchaseDate: null,
          perkedItemIds: [],
          walletAddress: wallet,
        })).catch(() => {});
        return;
      }

      // Same wallet (or legacy untagged cache): re-apply the cached tier if
      // it outranks what's in memory. This is what makes a same-session
      // disconnect→reconnect (and the wallet-adapter reauth cycle, which
      // calls disconnectWallet) restore Pro INSTANTLY from the durable
      // cache, with zero dependence on a slow/rate-limited memo scan. The
      // chain restore still runs afterward and can only upgrade further.
      if (data.tier && TIER_ORDER.includes(data.tier)) {
        const cached = data.tier as PremiumTier;
        if (getTierOrdinal(cached) > getTierOrdinal(get().tier)) {
          const config = TIER_CONFIGS[cached];
          const perkedItemIds = Array.isArray(data.perkedItemIds) && data.perkedItemIds.length > 0
            ? data.perkedItemIds
            : (config.allShopItemsFree ? snapshotCatalog() : []);
          set({
            tier: cached,
            isPremium: cached !== 'none',
            purchaseDate: data.purchaseDate ?? null,
            perkedItemIds,
          });
          console.log('[premiumStore] reconcileForWallet — re-applied cached tier:', cached);
        }
      }
    } catch {}
  },

  hydratePremium: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const perkedItemIds = Array.isArray(data.perkedItemIds) ? data.perkedItemIds : [];
        // Premium is chain-authoritative. AsyncStorage is just a cache so the
        // user doesn't see a tier flicker between app open and chain restore
        // completing. We ONLY trust the cache when the saved tier is one of
        // the valid current tier names — every other branch (the legacy
        // `isPremium: true` migration, the silver/gold/diamond → plus/pro
        // migrations) was a false-positive risk: any stale dev/test
        // AsyncStorage row would silently grant premium without a real
        // purchase. If the user genuinely owned premium, the on-chain memo
        // restore in restorePurchases() will populate it correctly.
        if (data.tier && TIER_ORDER.includes(data.tier)) {
          set({
            tier: data.tier,
            isPremium: data.tier !== 'none',
            purchaseDate: data.purchaseDate ?? null,
            perkedItemIds,
          });
          return; // primary cache hit, done.
        }
      }
    } catch {}

    // Primary cache missing or corrupted. Try the fallback record written by
    // `purchaseTier` immediately after a successful payment — this is the
    // safety net for the rare "primary AsyncStorage save failed" case.
    try {
      const fallbackRaw = await AsyncStorage.getItem('oracle-pet-premium-fallback');
      if (!fallbackRaw) return;
      const fallback = JSON.parse(fallbackRaw);
      if (fallback?.tier && TIER_ORDER.includes(fallback.tier)) {
        console.log('[premiumStore] hydrating from fallback (primary missing):', fallback.tier);
        const config = TIER_CONFIGS[fallback.tier as PremiumTier];
        const perkedItemIds = config.allShopItemsFree ? snapshotCatalog() : [];
        set({
          tier: fallback.tier,
          isPremium: fallback.tier !== 'none',
          purchaseDate: null,
          perkedItemIds,
        });
        // Re-write primary so future hydrates take the fast path.
        await savePremiumState(get()).catch(() => {});
      }
    } catch {}
  },
}));

/**
 * Returns true when this item is free for the user as part of their tier
 * perks (i.e. it was in the shop catalog at the time they purchased their
 * tier). New items added to the catalog after purchase return false.
 */
export function isItemFreeForCurrentTier(itemId: string): boolean {
  const { perkedItemIds } = usePremiumStore.getState();
  return perkedItemIds.includes(itemId);
}

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
    paidSpinCost: config.tier === 'pro' ? 0 : 0.002,
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
