import { getOraclePetPurchases } from './transactionHistory';
import { useShopStore } from '../store/shopStore';
import { usePremiumStore } from '../store/premiumStore';
import { usePetStore } from '../store/petStore';
import { type PremiumTier, TIER_ORDER } from '../data/premiumTiers';
import { detectNomiNftHolding } from './nftDetection';
import { listPurchases } from './purchasesService';

function getTierOrdinal(tier: PremiumTier): number {
  return TIER_ORDER.indexOf(tier);
}

export interface RestoreResult {
  shopItemsRestored: string[];
  premiumTierRestored: PremiumTier | null;
  streakRestored: number | null;
  petRestored: boolean;
  /** True when pet identity came from on-chain NFT scan (Helius/RPC) rather
   *  than a memo. Useful for analytics + telling users "we found your old
   *  pet on chain even though there was no purchase record". */
  petRestoredFromHoldings: boolean;
  /** Earliest oracle-pet:* memo timestamp (unix seconds). Proxy for "how long
   *  this user has been engaged" — used by the legacy welcome-back bonus to
   *  scale the level/coins grant by their actual on-chain footprint. Null
   *  if no memos at all (brand new mint with no further activity). */
  earliestMemoTimestamp: number | null;
  totalFound: number;
  /** True iff the server ledger has a `welcome-back` row for this wallet —
   *  i.e. the legacy-user bonus was already granted at some point. Used
   *  server-side as the authoritative idempotency check so a reinstall
   *  whose post-bonus state-push failed can't re-grant the bonus. */
  welcomeBackEverGranted: boolean;
}

/**
 * Restore purchases and pet state from on-chain memo records.
 * Reads all oracle-pet:* memos from the user's transaction history.
 */
export async function restorePurchases(userAddress: string): Promise<RestoreResult> {
  // Wallet-aware premium reconcile FIRST. For a different wallet on a shared
  // device this clears the prior owner's tier (privacy). For the SAME wallet
  // it instantly re-applies the durable owner-tagged cache — so a paid user
  // keeps Pro through app-update / disconnect / RPC outage without waiting
  // on the (possibly slow, possibly deep) memo scan below. The chain restore
  // still runs afterward and can only upgrade further, never downgrade.
  try {
    await usePremiumStore.getState().reconcileForWallet(userAddress);
  } catch (e) {
    console.warn('[purchaseRestore] reconcileForWallet failed (non-fatal):', e);
  }

  // FAST PATH: hit the server ledger first. If it returns records, we can
  // skip the slow on-chain memo scan for those rows. The chain scan still
  // runs for cases where the ledger hasn't seen everything yet (legacy
  // pre-v1.2 purchases, missed POSTs due to network issues), so this is
  // strictly additive — never less authoritative than the old flow.
  const ledger = await listPurchases(userAddress);
  const ledgerSignatures = new Set<string>();
  const ledgerPurchases: { type: 'shop' | 'premium' | 'mint' | 'sync'; itemId: string; timestamp: number | null; signature: string }[] = [];
  if (ledger && ledger.length > 0) {
    console.log(`[purchaseRestore] server ledger returned ${ledger.length} purchases`);
    for (const row of ledger) {
      const t = row.kind === 'mint' ? 'mint' : row.kind === 'premium' ? 'premium' : 'shop';
      // Wrap the mint payload as JSON so the existing mint-memo parser
      // downstream works unchanged. Other kinds keep raw payload.
      const itemId = row.kind === 'mint'
        ? JSON.stringify({ mintAddress: row.payload, name: 'Nomi', ownerName: '', source: 'ledger' })
        : row.payload;
      ledgerPurchases.push({
        type: t,
        itemId,
        timestamp: Math.floor(row.created_at / 1000),
        signature: row.signature,
      });
      ledgerSignatures.add(row.signature);
    }
  }

  // Slow path: scan the chain. Merge with the ledger results, deduping by
  // signature so we don't double-count a purchase that's in both sources.
  const chainPurchases = await getOraclePetPurchases(userAddress);
  const dedupedChainPurchases = chainPurchases.filter((p) => !ledgerSignatures.has(p.signature));
  let purchases = [...ledgerPurchases, ...dedupedChainPurchases];

  // Deep rescue. The fast scan only covers the most recent ~1000 signatures.
  // A user who bought Pro (or minted) BEFORE the server ledger existed, and
  // whose AsyncStorage cache was later wiped (reinstall / sideloaded APK),
  // has ONLY the chain memo to restore from. If they've transacted heavily
  // since, that memo scrolled past the fast window.
  //
  // BUG FIX: this used to gate on `!hasPremium && !hasMint` (only deep-scan
  // when the wallet looked totally empty). But a real user who reinstalled
  // would have their RECENT mint memo found in the fast scan (hasMint=true)
  // while their OLDER premium-purchase memo sat deeper than 1000 sigs — so
  // the deep scan was skipped and Pro never restored even though the memo
  // existed on chain. (m7ou: "Welcome Back applied but Premium is not.")
  // Now: deep-scan whenever the thing we most need — premium — is missing
  // (or mint is missing), since premium is the paid entitlement worth the
  // extra RPC cost. Paying users whose premium was already found in the fast
  // scan skip this entirely.
  // Gate ONLY on premium. The original `!hasPremium && !hasMint` failed m7ou
  // (mint recent, premium deep → no scan → Pro lost). The `!hasPremium ||
  // !hasMint` fix that followed over-triggered for legitimate premium-without-
  // mint users on heavy wallets (full 6000-sig scan every reconnect).
  // `!hasPremium` covers the real failure mode (paid premium that didn't
  // appear in the fast window) without penalizing users who already have
  // their premium in fast-scan range. Mint-recovery is still covered by the
  // holdings-scan fallback in `restorePurchases` further below.
  const hasPremium = purchases.some((p) => p.type === 'premium');
  if (!hasPremium) {
    try {
      // No stopWhenFound: when a deep rescue is warranted we scan the full
      // window and collect EVERY oracle-pet memo. Shop-item purchases also
      // scroll past the fast 1000-sig window, so an early-exit on
      // premium/mint would still drop a reinstalled user's older shop items.
      // (Wallets with little history hit end-of-history and return early
      // anyway; the full cost is only paid by very active wallets, once, on
      // reconnect — worth it to never silently drop a paid purchase.)
      const deep = await getOraclePetPurchases(userAddress, { maxPages: 30 });
      const known = new Set(purchases.map((p) => p.signature));
      const extra = deep.filter((p) => !known.has(p.signature));
      if (extra.length > 0) {
        console.log(`[purchaseRestore] deep rescue recovered ${extra.length} memo(s)`);
        purchases = [...purchases, ...extra];
      }
    } catch (e) {
      console.warn('[purchaseRestore] deep rescue scan failed (non-fatal):', e);
    }
  }

  const shopPurchases = purchases.filter((p) => p.type === 'shop');
  const premiumPurchases = purchases.filter((p) => p.type === 'premium');
  const syncMemos = purchases.filter((p) => p.type === 'sync');
  const mintMemos = purchases.filter((p) => p.type === 'mint');

  // Restore shop items. Pass the wallet address so shopStore can detect a
  // wallet-change scenario and reset items before applying — prevents
  // cross-user item leakage on shared devices, while keeping items visible
  // through a normal same-wallet reconnect.
  const shopItemIds = [...new Set(shopPurchases.map((p) => p.itemId))];
  if (shopItemIds.length > 0) {
    useShopStore.getState().restoreFromChain(shopItemIds, userAddress);
  } else {
    // Even when chain returns no items (brand new wallet), call this so
    // lastConnectedWallet is updated and a future swap correctly detects
    // the wallet change.
    useShopStore.getState().restoreFromChain([], userAddress);
  }

  // Streak-freeze recovery from chain memos. Freezes are consumable — they
  // don't carry an `owned` flag — so they were previously lost on reinstall
  // even though the chain memos prove the user paid for them. We can't
  // perfectly reconstruct "how many were left when you stopped playing"
  // from chain alone (the consumption isn't on-chain), but we CAN
  // conservatively grant the lifetime purchase count when local state is
  // clearly fresh (current count == 0). Subsequent reconnects from the
  // same wallet keep the local count (no re-grant).
  try {
    const freezeMemos = shopPurchases.filter((p) => p.itemId === 'streak-freeze');
    const freezePurchaseCount = freezeMemos.length;
    const petState = usePetStore.getState();
    if (freezePurchaseCount > 0 && petState.streakFreezes === 0) {
      // Cap the grant at a sensible value (10) — wallets with dozens of
      // freeze memos likely used most of them between reinstalls; granting
      // 50 freezes at once would be the wrong correction.
      const grant = Math.min(freezePurchaseCount, 10);
      const { savePetState } = require('../store/petStore');
      usePetStore.setState({ streakFreezes: grant });
      await savePetState(usePetStore.getState());
      console.log(`[purchaseRestore] streak-freezes restored from chain memos: ${grant} (of ${freezePurchaseCount} lifetime purchases)`);
    }
  } catch (err) {
    console.warn('[purchaseRestore] streak-freeze chain restore failed (non-fatal):', err);
  }

  // Determine highest premium tier. The new memo format is
  // `oracle-pet:premium|<tier>|<currency>` (post dual-currency change), the
  // old format was `oracle-pet:premium|<tier>`. The parser hands us
  // `payload = "<tier>" or "<tier>|<currency>"`, so split on `|` and take
  // the first segment to be safe across both formats.
  let highestTier: PremiumTier = 'none';
  let highestTierSignature: string | null = null;
  for (const p of premiumPurchases) {
    // Defensive: trim + lowercase before tier lookup. Real memos seen in
    // the wild include stray whitespace and case variations from older
    // mint flows; skipping a legit purchase because of " Pro " vs "pro"
    // would be exactly the class of bug we keep finding.
    const firstSegment = p.itemId.split('|')[0].trim().toLowerCase() as PremiumTier;
    if (TIER_ORDER.includes(firstSegment) && getTierOrdinal(firstSegment) > getTierOrdinal(highestTier)) {
      highestTier = firstSegment;
      highestTierSignature = p.signature;
    }
  }
  if (highestTier !== 'none') {
    // Log the memo source so users questioning "why am I premium" can verify
    // by looking up this signature on Solscan. This is a real on-chain
    // record — if it's there, it was bought (test or real) at some point.
    console.log(`[purchaseRestore] Premium tier "${highestTier}" restored from on-chain memo signature: ${highestTierSignature}`);
    usePremiumStore.getState().restoreFromChain(highestTier);
  }

  // Restore pet from mint memo (oracle-pet:mint|<JSON>) — covers reinstall
  // when the user never wrote a sync memo. Mint memo includes name + mint
  // address; pet starts at fresh stats but the identity persists.
  let petRestored = false;
  if (mintMemos.length > 0) {
    const sortedMint = mintMemos
      .filter((m) => m.timestamp !== null)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    const latestMint = sortedMint[0] ?? mintMemos[0];
    try {
      const data = JSON.parse(latestMint.itemId);
      if (data.mintAddress) {
        usePetStore.getState().restoreFromMint({
          mintAddress: data.mintAddress,
          mintTxSignature: data.txSignature ?? latestMint.signature,
          name: data.name ?? 'Nomi',
          ownerName: data.ownerName ?? '',
        });
        petRestored = true;
      }
    } catch {
      console.warn('[purchaseRestore] Failed to parse mint memo:', latestMint.itemId);
    }
  }

  // Fallback: scan on-chain NFT holdings if memo-based restore didn't find a
  // pet. Catches every Nomi NFT minted before the oracle-pet:mint memo write
  // was added — i.e. all existing users from before today.
  //
  // CRITICAL BUG GUARD: previously the retroactive memo write fired on every
  // app open whenever the memo-lookup RPC call silently returned empty
  // (which happened constantly on public RPC under rate limiting). We saw
  // users in the wild with 7+ duplicate `oracle-pet:mint` memos on chain
  // because of this — real tx fees, real wallet prompts every launch. Now
  // gated by THREE checks:
  //   (a) hasPet already true locally → user already has identity, no need
  //       to scan holdings or write a memo at all
  //   (b) retroactiveMintMemoWrittenFor matches the detected NFT → memo
  //       already written for this NFT in a prior session, never re-write
  //   (c) memo-lookup actually returned ZERO oracle-pet memos of any kind,
  //       not just zero mint memos — if the lookup returned other memos
  //       (sync/shop/premium), it succeeded and a missing mint memo is real
  let petRestoredFromHoldings = false;
  const petAlreadyLocal = usePetStore.getState().hasPet;
  if (!petRestored && !petAlreadyLocal) {
    try {
      const detected = await detectNomiNftHolding(userAddress);
      if (detected) {
        usePetStore.getState().restoreFromMint({
          mintAddress: detected.mintAddress,
          mintTxSignature: '',
          name: detected.name,
          ownerName: '',
        });
        petRestored = true;
        petRestoredFromHoldings = true;
        console.log('[purchaseRestore] Pet restored from on-chain holdings:', detected.mintAddress);

        // NOTE: we deliberately do NOT write a retroactive `oracle-pet:mint`
        // memo here anymore. Restore must be 100% READ-ONLY. The pet's
        // identity is already fully recovered above via the holdings scan,
        // so the memo write was pure optimization for *future* restore speed
        // — at the cost of an unexplained wallet-signature + gas-fee prompt
        // popping up during "Restoring from chain…". Real users (Gary,
        // May 2026: "What's this? Why I need to pay gas fee?") were rightly
        // alarmed and declined it, which — given the unrelated pump.fun
        // impersonation making users hyper-suspicious — actively fed a "this
        // app is trying to scam me" narrative. New users already get this
        // memo for free at mint time (MintScreen). Legacy pre-memo users
        // simply keep restoring via the holdings scan every time: a touch
        // slower, but free, silent, and trustworthy.
      }
    } catch (err: any) {
      console.warn('[purchaseRestore] holdings detection failed:', err?.message ?? err);
    }
  }

  // Restore pet state from most recent sync memo (overlays mint-restore data
  // with the most up-to-date streak/name/lastActive the user pushed).
  let streakRestored: number | null = null;
  if (syncMemos.length > 0) {
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

  // Earliest memo timestamp = how long this wallet has been engaged with Nomi
  // on chain. Used as a fairness signal for the legacy welcome-back bonus.
  const memosWithTime = purchases.filter((p) => p.timestamp != null);
  const earliestMemoTimestamp = memosWithTime.length
    ? memosWithTime.reduce((min, p) => Math.min(min, p.timestamp!), memosWithTime[0].timestamp!)
    : null;

  console.log('[purchaseRestore] Restored — shop:', shopItemIds.length, 'premium:', highestTier, 'streak:', streakRestored, 'pet:', petRestored, 'fromHoldings:', petRestoredFromHoldings);

  return {
    shopItemsRestored: shopItemIds,
    premiumTierRestored: highestTier !== 'none' ? highestTier : null,
    streakRestored,
    petRestored,
    petRestoredFromHoldings,
    earliestMemoTimestamp,
    totalFound: purchases.length,
    // Ledger has the authoritative idempotency record. If the welcome-back
    // bonus was ever granted, a row with kind='welcome-back' is present.
    // `ledger` could be null (worker unreachable) — in that case we DON'T
    // claim it was granted (eligibility downstream will additionally check
    // the local `welcomeBackBonusAppliedAt`).
    welcomeBackEverGranted: (ledger ?? []).some((row) => row.kind === 'welcome-back'),
  };
}
