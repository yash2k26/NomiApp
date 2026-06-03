import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalance, getBalanceSafe } from '../lib/solanaClient';
import { getSkrBalance, getSkrBalanceSafe } from '../lib/skrToken';
import {
  connectMobileWallet,
  reauthorizeMobileWallet,
  disconnectMobileWallet,
} from '../lib/mobileWalletAdapter';

const WALLET_STORAGE_KEY = 'oracle-pet-wallet';
const APP_COINS_STORAGE_KEY = 'oracle-pet-app-coins';
const COIN_CAPS_STORAGE_KEY = 'oracle-pet-coin-caps';

// Daily caps per reward source (UTC date reset). Sources without a key here
// are uncapped — e.g. one-time referral bonus, once-per-day login.
//
// Bumped from 50/30/30 → 250/150/100 in v1.1.1 after real users reported
// "rewards still vanish" — the cause was caps clipping after only a few
// adventures/events. The previous numbers were tuned for an anti-farming
// concern that hadn't materialized; what DID materialize was players hitting
// the cap during normal play and assuming the bug from v1.0 was still alive.
const DAILY_COIN_CAPS: Record<string, number> = {
  adventure: 250,
  event: 150,
  spin: 100,
};

// Cap toast throttle — show at most once per (source, UTC day) per session.
// Persisted "we already showed this cap toast today" tracking. Was previously
// in-memory only, which meant force-close + reopen on the same UTC day would
// re-show the toast — users mistook the duplicate toast for "coins vanishing
// again." Now persisted to AsyncStorage, hydrated at boot, reset only on UTC
// date rollover.
const CAP_TOAST_STORAGE_KEY = 'oracle-pet-cap-toast-shown';
const capToastShownToday: { date: string; sources: Set<string> } = {
  date: '',
  sources: new Set<string>(),
};

function saveCapToastShown() {
  AsyncStorage.setItem(
    CAP_TOAST_STORAGE_KEY,
    JSON.stringify({ date: capToastShownToday.date, sources: Array.from(capToastShownToday.sources) }),
  ).catch(() => {});
}

export async function hydrateCapToastShown(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CAP_TOAST_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    // If the persisted date isn't today, leave the state empty — the UTC day
    // has rolled over and the user should see fresh cap toasts.
    if (typeof data.date === 'string' && data.date === today && Array.isArray(data.sources)) {
      capToastShownToday.date = data.date;
      capToastShownToday.sources = new Set<string>(data.sources);
    }
  } catch {}
}

const SOURCE_LABELS: Record<string, string> = {
  adventure: 'Adventure',
  event: 'Event',
  spin: 'Spin',
};

interface WalletState {
  connected: boolean;
  address: string;
  /** Best-effort brand of the wallet that authorized us (Phantom, Seeker,
   *  Solflare, Backpack). Used purely for UX surfacing — never for
   *  security-sensitive decisions. Persisted alongside auth so it survives
   *  reauth. */
  walletBrand: string;
  balance: number;       // on-chain SOL — chain truth, refreshed by refreshBalance
  skrBalance: number;    // on-chain SKR — chain truth, refreshed by refreshSkrBalance
  // True when the last `refreshBalance` call succeeded. False means we don't
  // actually know the balance (RPC failed / rate-limited / network down).
  // UI MUST show "balance unavailable" rather than "0 SOL" when this is false,
  // otherwise users misread RPC failures as "I'm broke."
  balanceLoadOk: boolean;
  skrBalanceLoadOk: boolean;
  // In-app wallet — game-earned currency. Persisted to AsyncStorage at the
  // device level. Never written to by chain refresh; never reflected on-chain.
  // Adventures, mini-games, daily logins, spin wheel, referral bonuses pay into
  // this field instead of the chain-backed balances.
  appCoins: number;
  // Anti-farm: per-source running totals for the current UTC day. addAppCoins
  // looks these up against DAILY_COIN_CAPS and clips overage. Resets when the
  // UTC date changes.
  coinsEarnedToday: Record<string, number>;
  coinsEarnedDate: string;
  authToken: string;
  isConnecting: boolean;
  error: string | null;
}

interface WalletActions {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  refreshSkrBalance: () => Promise<void>;
  hydrateWallet: () => Promise<void>;
  deductBalance: (amount: number) => void;
  addBalance: (amount: number) => void;
  deductSkr: (amount: number) => void;
  addSkr: (amount: number) => void;
  // In-app wallet actions. `source` is used for daily-cap accounting; pass it
  // for any reward path that should be capped (adventure/event/spin). Omit
  // for one-shot bonuses (referral/login) that don't need a cap.
  addAppCoins: (amount: number, source?: string) => void;
  deductAppCoins: (amount: number) => boolean;
}

type WalletStore = WalletState & WalletActions;

async function saveWalletState(address: string, authToken: string, walletBrand: string) {
  try {
    await AsyncStorage.setItem(
      WALLET_STORAGE_KEY,
      // `lastReauthAt` enables the 24h cached-auth path in hydrateWallet:
      // every app launch within the TTL skips the MWA reauth call entirely,
      // which removes the "wallet prompt every time I open the app" UX bug
      // that users were misreading as a gas fee.
      JSON.stringify({ address, authToken, walletBrand, lastReauthAt: Date.now() }),
    );
  } catch {}
}

// 24 hours. After this, hydrateWallet falls back to a full reauthorize. We
// also reauthorize on any signing failure (existing fallback path) so a
// stale-but-still-valid cached token is self-correcting.
const REAUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function saveAppCoins(amount: number) {
  try {
    await AsyncStorage.setItem(APP_COINS_STORAGE_KEY, String(amount));
  } catch {}
}

interface CoinCapState {
  earnedToday: Record<string, number>;
  earnedDate: string;
}

async function saveCoinCaps(state: CoinCapState) {
  try {
    await AsyncStorage.setItem(COIN_CAPS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export async function hydrateAppCoins(): Promise<{ amount: number; caps: CoinCapState }> {
  let amount = 0;
  try {
    const raw = await AsyncStorage.getItem(APP_COINS_STORAGE_KEY);
    if (raw != null) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0) amount = n;
    }
  } catch {}

  let caps: CoinCapState = { earnedToday: {}, earnedDate: '' };
  try {
    const raw = await AsyncStorage.getItem(COIN_CAPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.earnedDate === 'string' && parsed.earnedToday && typeof parsed.earnedToday === 'object') {
        caps = { earnedToday: parsed.earnedToday, earnedDate: parsed.earnedDate };
      }
    }
  } catch {}

  return { amount, caps };
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  connected: false,
  address: '',
  walletBrand: '',
  balance: 0,
  skrBalance: 0,
  // Default to true so first-launch (no calls made yet) doesn't show
  // "balance unavailable." We set false only on a confirmed RPC failure.
  balanceLoadOk: true,
  skrBalanceLoadOk: true,
  appCoins: 0,
  coinsEarnedToday: {},
  coinsEarnedDate: '',
  authToken: '',
  isConnecting: false,
  error: null,

  connectWallet: async () => {
    set({ isConnecting: true, error: null });
    // Safety timeout: if MWA hangs (Phantom not responding, OS killed the
    // intent, etc.) the user otherwise sees a frozen "Connecting…" forever
    // with no recovery path. After 30s, force-clear the connecting state and
    // surface an error so they can retry. Cleared on success/error below.
    const safetyTimeout = setTimeout(() => {
      const { isConnecting, connected } = get();
      if (isConnecting && !connected) {
        set({
          isConnecting: false,
          error: 'Wallet didn\'t respond. Make sure Phantom or Seeker is installed and try again.',
        });
      }
    }, 30000);
    try {
      const result = await connectMobileWallet();
      clearTimeout(safetyTimeout);

      // Connect immediately — don't wait for balance fetches
      set({
        connected: true,
        address: result.address,
        walletBrand: result.brand,
        authToken: result.authToken,
        isConnecting: false,
      });

      saveWalletState(result.address, result.authToken, result.brand);

      // Fetch balances in background (UI updates reactively via Zustand)
      getBalanceSafe(result.address).then(({ value, ok }) => {
        if (ok) set({ balance: value, balanceLoadOk: true });
        else set({ balanceLoadOk: false });
      }).catch(() => set({ balanceLoadOk: false }));
      getSkrBalanceSafe(result.address).then(({ value, ok }) => {
        if (ok) set({ skrBalance: value, skrBalanceLoadOk: true });
        else set({ skrBalanceLoadOk: false });
      }).catch(() => set({ skrBalanceLoadOk: false }));
    } catch (error: any) {
      clearTimeout(safetyTimeout);
      const code = error?.code;
      let message = 'Failed to connect wallet';

      if (code === 'ERROR_WALLET_NOT_FOUND') {
        message = 'No Solana wallet found. Install Phantom or Solflare.';
      } else if (code === 'ERROR_AUTHORIZATION_FAILED' || code === -1) {
        message = 'Connection rejected by wallet.';
      } else if (code === 'ERROR_SESSION_TIMEOUT') {
        message = 'Wallet connection timed out. Try again.';
      } else if (error?.message) {
        message = error.message;
      }

      set({ isConnecting: false, error: message });
    }
  },

  disconnectWallet: () => {
    const { authToken, address } = get();
    if (authToken) {
      disconnectMobileWallet(authToken).catch(() => {});
    }
    // Drop server-side push registration so the previous user's pushes don't
    // follow the device. Best-effort; failures are silently logged.
    try {
      const { clearPushToken } = require('../lib/pushService');
      clearPushToken().catch(() => {});
    } catch {}
    // Best-effort: push the latest local state to cloud BEFORE wiping local.
    // If the user reconnects with the same wallet later, pullState will
    // recover their data. If we deleted the cloud row here (as we used to),
    // accidental disconnect = unrecoverable data loss. The cloud row is
    // wallet-keyed, not device-keyed, so leaving it doesn't hurt other users.
    try {
      const { pushState, resetSyncSessionState } = require('../lib/stateSyncService');
      pushState(address, { bypassDebounce: true }).catch(() => {});
      // Reset per-session sync flags so the next user on this device gets a
      // clean slate (e.g., the "cloud has newer data" warning fires for them
      // independently — without this it could be suppressed by user A's state).
      resetSyncSessionState();
    } catch {}
    // Cascade-clear every per-user store. Without this, the next wallet to
    // connect on the same device sees the previous user's pet name, XP,
    // streak, adventure progress and premium tier for ~3s until auto-restore
    // overwrites them — a privacy + confusion issue. Each store is reset to
    // its initial state and its AsyncStorage row is removed; on the next
    // connect, hydration finds nothing and auto-restore populates fresh data.
    try {
      const { usePetStore } = require('./petStore');
      usePetStore.getState().clearPet();
      AsyncStorage.removeItem('oracle-pet-state').catch(() => {});
    } catch {}
    try {
      // Reset via the store's own action so the CORRECT shape is written.
      // The previous inline setState wrote phantom keys (feedCount/playCount/
      // achievements:{}/completedQuests) that don't exist on XpState — it set
      // `achievements` to an object, so the next user's first feed/play call
      // hit `achievements.map(...)` and threw, AND the lifetime counters never
      // actually reset (privacy leak). resetForDisconnect writes the real
      // shape (counters object + achievements array).
      const { useXpStore } = require('./xpStore');
      useXpStore.getState().resetForDisconnect();
      AsyncStorage.removeItem('oracle-pet-xp').catch(() => {});
    } catch {}
    try {
      const { useAdventureStore } = require('./adventureStore');
      useAdventureStore.setState({
        evolutionShards: 0,
        freeItemTokens: 0,
        completedAdventures: 0,
        miniGamesWon: 0,
        currentLoginDay: 0,
        totalLoginDays: 0,
        lastLoginClaimDate: '',
        doubleXpUntil: 0,
        activeAdventure: null,
        pendingLoot: null,
        pendingLootCreatedAt: null,
        lastSpinDate: '',
        extraSpinsToday: 0,
      });
      AsyncStorage.removeItem('oracle-pet-adventure').catch(() => {});
    } catch {}
    try {
      // In-memory reset only for the brief privacy window (next user on a
      // shared device shouldn't see the prior user's tier before reconnect).
      // The durable `oracle-pet-premium` cache is intentionally NOT deleted
      // anymore — same reasoning as shopStore above: premium is
      // chain-authoritative and the cache is owner-tagged, so a same-wallet
      // reconnect / app-update / RPC outage instantly re-applies the paid
      // tier via premiumStore.reconcileForWallet, and a *different* wallet's
      // reconcileForWallet does the privacy reset. Deleting the cache here
      // was the root cause of "paid 1799 SKR, after update Pro still not
      // active": disconnect wiped it, then a slow/deep memo scan couldn't
      // refill before the user gave up.
      const { usePremiumStore } = require('./premiumStore');
      usePremiumStore.setState({
        tier: 'none',
        isPremium: false,
        purchaseDate: null,
        perkedItemIds: [],
      });
    } catch {}
    try {
      const { usePersonalityStore } = require('./personalityStore');
      usePersonalityStore.getState().clearPersonality();
      AsyncStorage.removeItem('oracle-pet-personality').catch(() => {});
    } catch {}
    // NOTE: shopStore is intentionally NOT cleared here anymore.
    //
    // Real v1.1 users reported their bought items disappearing after an
    // update / disconnect — the cause was this clear running and then chain
    // restore not refilling fast enough (RPC slow, memo paginated scan).
    // Items are chain-authoritative anyway: they live in oracle-pet:shop|*
    // memos forever. Clearing locally only creates a "missing items" gap.
    //
    // For cross-user privacy when the device user actually changes: the
    // shopStore.restoreFromChain action handles this by tracking
    // lastConnectedWallet — when a different wallet connects, items reset
    // before being repopulated from that wallet's memos. Same wallet
    // reconnect just re-confirms what's already there.
    // Reset the cloud-sync version counter so the next connect starts a fresh
    // push lineage rather than colliding with the prior wallet's version.
    AsyncStorage.removeItem('oracle-pet-state-sync-version').catch(() => {});
    // Note: appCoins is intentionally NOT cleared — it's device-level game
    // currency, not wallet-bound. Reinstalling the app wipes it; disconnect
    // alone does not.
    set({ connected: false, address: '', walletBrand: '', balance: 0, skrBalance: 0, balanceLoadOk: true, skrBalanceLoadOk: true, authToken: '', isConnecting: false, error: null });
    AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(() => {});
  },

  refreshBalance: async () => {
    const { connected, address } = get();
    if (!connected || !address) return;
    const { value, ok } = await getBalanceSafe(address);
    // Always update the load-ok flag; only overwrite the balance when the
    // call actually succeeded. This preserves the last-known good balance
    // when RPC fails — UI can show stale-with-warning rather than zero.
    if (ok) {
      set({ balance: value, balanceLoadOk: true });
    } else {
      set({ balanceLoadOk: false });
    }
  },

  refreshSkrBalance: async () => {
    const { connected, address } = get();
    if (!connected || !address) return;
    const { value, ok } = await getSkrBalanceSafe(address);
    if (ok) {
      set({ skrBalance: value, skrBalanceLoadOk: true });
    } else {
      set({ skrBalanceLoadOk: false });
    }
  },

  deductBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.max(0, balance - amount) });
  },

  addBalance: (amount: number) => {
    const { balance } = get();
    set({ balance: Math.round((balance + amount) * 10000) / 10000 });
  },

  deductSkr: (amount: number) => {
    const { skrBalance } = get();
    set({ skrBalance: Math.max(0, Math.round((skrBalance - amount) * 1000000) / 1000000) });
  },

  addSkr: (amount: number) => {
    const { skrBalance } = get();
    set({ skrBalance: Math.round((skrBalance + amount) * 1000000) / 1000000 });
  },

  addAppCoins: (amount: number, source?: string) => {
    if (amount <= 0) return;

    // UTC date roll-over: clear the running totals when the day changes.
    const today = new Date().toISOString().slice(0, 10);
    let earnedToday = get().coinsEarnedToday;
    let earnedDate = get().coinsEarnedDate;
    if (earnedDate !== today) {
      earnedToday = {};
      earnedDate = today;
    }

    // Apply the cap if this source is in the cap table.
    let actual = amount;
    let cap: number | undefined;
    if (source && DAILY_COIN_CAPS[source] != null) {
      cap = DAILY_COIN_CAPS[source];
      const already = earnedToday[source] ?? 0;
      const remaining = Math.max(0, cap - already);
      actual = Math.min(amount, remaining);
    }

    // Tell PostHog whenever the cap clips an earn — informs cap tuning.
    if (cap != null && actual < amount) {
      try {
        const { events } = require('../lib/analytics');
        events.coinCapHit({
          source: source ?? 'unknown',
          amount_requested: amount,
          amount_granted: actual,
          daily_total: (earnedToday[source!] ?? 0) + actual,
          cap_value: cap,
          fully_capped: actual === 0,
        });
      } catch {}

      // Surface the cap to the user — once per (source, UTC day), persisted.
      if (source) {
        if (capToastShownToday.date !== today) {
          capToastShownToday.date = today;
          capToastShownToday.sources = new Set<string>();
        }
        if (!capToastShownToday.sources.has(source)) {
          capToastShownToday.sources.add(source);
          saveCapToastShown();
          const label = SOURCE_LABELS[source] ?? source;
          try {
            const { notify } = require('../lib/notify');
            const title = actual === 0
              ? `Daily ${label} cap reached`
              : `${label} cap hit (${cap}/day)`;
            notify.info(title, 'Resets at midnight UTC.', { category: 'cap' });
          } catch {}
        }
      }
    }

    if (actual <= 0) {
      // Persist the date roll-over even if we're at cap, so the reset is durable.
      if (earnedDate !== get().coinsEarnedDate) {
        set({ coinsEarnedToday: earnedToday, coinsEarnedDate: earnedDate });
        saveCoinCaps({ earnedToday, earnedDate });
      }
      return;
    }

    const nextAmount = Math.round((get().appCoins + actual) * 1000000) / 1000000;
    const nextEarnedToday = source
      ? { ...earnedToday, [source]: (earnedToday[source] ?? 0) + actual }
      : earnedToday;

    set({
      appCoins: nextAmount,
      coinsEarnedToday: nextEarnedToday,
      coinsEarnedDate: earnedDate,
    });
    saveAppCoins(nextAmount);
    saveCoinCaps({ earnedToday: nextEarnedToday, earnedDate });
  },

  deductAppCoins: (amount: number) => {
    if (amount <= 0) return true;
    const current = get().appCoins;
    if (current < amount) return false;
    const next = Math.max(0, Math.round((current - amount) * 1000000) / 1000000);
    set({ appCoins: next });
    saveAppCoins(next);
    return true;
  },

  hydrateWallet: async () => {
    let stored: string | null = null;
    try {
      stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
    } catch {
      return; // benign storage read failure
    }
    if (!stored) return;

    let parsed: { address?: string; authToken?: string; walletBrand?: string; lastReauthAt?: number };
    try { parsed = JSON.parse(stored); } catch { return; }
    if (!parsed.address || !parsed.authToken) return;

    // Cached-auth fast path. If we successfully reauthorized within the last
    // 24h, skip the MWA reauth call entirely — the cached authToken stays
    // valid for signing on most wallets, and if it has been revoked
    // server-side (rare), the next sign attempt fails and the existing
    // catch-reauth fallback in withWallet handles it. This is the single
    // biggest UX fix for the "wallet prompt every app open feels like gas"
    // complaint — Phantom/Seeker show a confirmation UI on every reauth,
    // and we were calling reauth on every cold start.
    const reauthAge = Date.now() - (parsed.lastReauthAt ?? 0);
    if (parsed.lastReauthAt && reauthAge < REAUTH_CACHE_TTL_MS) {
      console.log('[walletStore] hydrate via cached auth (age:', Math.round(reauthAge / 60000), 'min)');
      set({
        connected: true,
        address: parsed.address,
        walletBrand: parsed.walletBrand || '',
        authToken: parsed.authToken,
        error: null,
      });
      // Don't reset lastReauthAt — that would shift the TTL forward forever.
      // Just refresh balances in the background.
      getBalanceSafe(parsed.address).then(({ value, ok }) => {
        if (ok) set({ balance: value, balanceLoadOk: true });
        else set({ balanceLoadOk: false });
      }).catch(() => set({ balanceLoadOk: false }));
      getSkrBalanceSafe(parsed.address).then(({ value, ok }) => {
        if (ok) set({ skrBalance: value, skrBalanceLoadOk: true });
        else set({ skrBalanceLoadOk: false });
      }).catch(() => set({ skrBalanceLoadOk: false }));
      return;
    }

    try {
      const result = await reauthorizeMobileWallet(parsed.authToken);
      set({
        connected: true,
        address: result.address,
        walletBrand: result.brand || parsed.walletBrand || '',
        authToken: result.authToken,
        error: null,
      });
      saveWalletState(result.address, result.authToken, result.brand || parsed.walletBrand || '');
      getBalanceSafe(result.address).then(({ value, ok }) => {
        if (ok) set({ balance: value, balanceLoadOk: true });
        else set({ balanceLoadOk: false });
      }).catch(() => set({ balanceLoadOk: false }));
      getSkrBalanceSafe(result.address).then(({ value, ok }) => {
        if (ok) set({ skrBalance: value, skrBalanceLoadOk: true });
        else set({ skrBalanceLoadOk: false });
      }).catch(() => set({ skrBalanceLoadOk: false }));
    } catch {
      // Reauth failed — token may be expired, wallet uninstalled, or user
      // revoked. Clear stored creds AND set connected: false so the App
      // gate routes the user BACK to the connect screen instead of leaving
      // them in a "connected but every action fails" zombie state. Also
      // surface a visible warning notification.
      await AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(() => {});
      set({
        connected: false,
        address: '',
        walletBrand: '',
        balance: 0,
        skrBalance: 0,
        balanceLoadOk: true,
        skrBalanceLoadOk: true,
        authToken: '',
        error: 'Your previous session expired. Please reconnect your wallet.',
      });
      try {
        const { notify } = require('../lib/notify');
        notify.warning('Session expired', 'Reconnect your wallet to continue.');
      } catch {}
    }
  },
}));
