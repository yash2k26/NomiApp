import AsyncStorage from '@react-native-async-storage/async-storage';
import { useXpStore, saveXpState } from '../store/xpStore';
import { usePetStore, savePetState } from '../store/petStore';
import { useAdventureStore, saveAdventureState } from '../store/adventureStore';
import { useWalletStore, hydrateAppCoins } from '../store/walletStore';

/*
 * Backend state sync.
 *
 * Backs up everything that's local-only on device (XP, streak, in-app coins,
 * shards, login progress, etc.) so users don't lose progress on reinstall,
 * wallet disconnect, or device swap. Items + premium tier stay
 * chain-authoritative — they're not in this payload.
 *
 * Sync triggers (wired in App.tsx):
 *   - On wallet connect/reconnect → pull from backend (after on-chain restore)
 *   - On app foreground/background transitions → push current state
 *
 * Endpoint: EXPO_PUBLIC_STATE_API_URL. If unset, all calls become no-ops —
 * the app still works, just without cloud backup.
 */

const VERSION_STORAGE_KEY = 'oracle-pet-state-sync-version';
const PUSH_DEBOUNCE_MS = 1500;
// Hard ceiling on any sync HTTP call. Without this, a slow worker on a
// foreground transition would stall the splash screen indefinitely (the 8s
// RPC safety timer in App.tsx doesn't cover sync calls). 15s is generous —
// the worker is small and Cloudflare-edge so anything past this is a hung
// connection, not normal latency.
const SYNC_TIMEOUT_MS = 15000;
// Tracks whether we've already nagged the user about a sync conflict in this
// session. We surface a one-time warning so they understand cloud isn't
// overwriting their newer local data; spamming on every push retry would be
// annoying.
let conflictNoticeShown = false;

function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  // RN doesn't reliably ship AbortSignal.timeout — manual controller is safer.
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  // Attach the shared app-token header so the state worker accepts the call.
  // Worker treats this as advisory until APP_TOKEN secret is set there — once
  // set, missing/wrong header returns 401. Token is read from .env at build
  // Prefer wallet-signed session (cryptographic) over the legacy shared
  // secret. getApiAuthHeaders attaches whichever is available.
  const { getApiAuthHeaders } = require('../store/walletStore');
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...getApiAuthHeaders(),
  };
  return fetch(input, { ...init, headers, signal: controller.signal }).finally(() => clearTimeout(id));
}

let lastPushAt = 0;

interface SyncedState {
  xp: {
    level: number;
    totalXp: number;
    xpInCurrentLevel: number;
    doubleXpUntil: number;
  };
  pet: {
    name: string;
    ownerName: string;
    streakDays: number;
    streakFreezes: number;
    lastFreezeRefillDate: string;
    lastActiveDate: string;
    lastBrokenStreak: number;
    streakBrokenAt: number;
    welcomeBackBonusAppliedAt: number;
  };
  adventure: {
    evolutionShards: number;
    freeItemTokens: number;
    completedAdventures: number;
    miniGamesWon: number;
    currentLoginDay: number;
    totalLoginDays: number;
    lastLoginClaimDate: string;
    doubleXpUntil: number;
  };
  wallet: {
    appCoins: number;
    coinsEarnedToday: Record<string, number>;
    coinsEarnedDate: string;
  };
}

function snapshot(): SyncedState {
  const xp = useXpStore.getState();
  const pet = usePetStore.getState();
  const adv = useAdventureStore.getState();
  const wallet = useWalletStore.getState();
  return {
    xp: {
      level: xp.level,
      totalXp: xp.totalXp,
      xpInCurrentLevel: xp.xpInCurrentLevel,
      doubleXpUntil: (adv as any).doubleXpUntil ?? 0,
    },
    pet: {
      name: pet.name,
      ownerName: pet.ownerName,
      streakDays: pet.streakDays,
      streakFreezes: pet.streakFreezes,
      lastFreezeRefillDate: pet.lastFreezeRefillDate,
      lastActiveDate: pet.lastActiveDate,
      lastBrokenStreak: pet.lastBrokenStreak,
      streakBrokenAt: pet.streakBrokenAt,
      welcomeBackBonusAppliedAt: pet.welcomeBackBonusAppliedAt,
    },
    adventure: {
      evolutionShards: adv.evolutionShards,
      freeItemTokens: adv.freeItemTokens,
      completedAdventures: adv.completedAdventures,
      miniGamesWon: adv.miniGamesWon,
      currentLoginDay: adv.currentLoginDay,
      totalLoginDays: adv.totalLoginDays,
      lastLoginClaimDate: adv.lastLoginClaimDate,
      doubleXpUntil: adv.doubleXpUntil,
    },
    wallet: {
      appCoins: wallet.appCoins,
      coinsEarnedToday: wallet.coinsEarnedToday,
      coinsEarnedDate: wallet.coinsEarnedDate,
    },
  };
}

async function readVersion(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(VERSION_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeVersion(v: number): Promise<void> {
  try {
    await AsyncStorage.setItem(VERSION_STORAGE_KEY, String(v));
  } catch {}
}

export interface PushStateResult {
  ok: boolean;
  firstPush: boolean; // true when this was the very first successful push
}

/**
 * Push current state to the backend. Debounced — repeated calls within
 * PUSH_DEBOUNCE_MS resolve immediately without hitting the network. Returns
 * { ok, firstPush }. firstPush=true lets the caller surface a one-time
 * "cloud backup activated" notice the first time a user's data is uploaded.
 *
 * Pass `bypassDebounce: true` to force a push regardless of the throttle
 * window — used by the immediate-on-first-launch path so existing users
 * don't have to wait for an AppState transition to be backed up.
 */
export async function pushState(
  walletAddress: string | null | undefined,
  opts: { bypassDebounce?: boolean } = {},
): Promise<PushStateResult> {
  // Strip trailing slashes from the base URL — `${base}/sync` with a
  // trailing slash produces `//sync` which CF Workers route as 404.
  const base = process.env.EXPO_PUBLIC_STATE_API_URL?.replace(/\/+$/, '');
  if (!base || !walletAddress) return { ok: false, firstPush: false };

  const now = Date.now();
  if (!opts.bypassDebounce && now - lastPushAt < PUSH_DEBOUNCE_MS) {
    return { ok: false, firstPush: false };
  }
  lastPushAt = now;

  const state = snapshot();
  const priorVersion = await readVersion();
  const version = priorVersion + 1;
  const isFirstPush = priorVersion === 0;

  try {
    const res = await fetchWithTimeout(`${base}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, state, version }),
    });
    if (res.status === 409) {
      // Server has a newer version (e.g. user pushed from another device that
      // came online after this one). Bump local version past the server's so
      // the next push wins, but surface a one-time warning so the user
      // understands their pending local changes weren't accepted as truth and
      // a foreground pull will reconcile.
      const data = (await res.json().catch(() => ({}))) as { currentVersion?: number };
      if (typeof data.currentVersion === 'number') {
        await writeVersion(data.currentVersion);
      }
      if (!conflictNoticeShown) {
        conflictNoticeShown = true;
        try {
          const { notify } = require('./notify');
          notify.warning(
            'Cloud has newer data',
            'Your progress from another device was kept. We\'ll sync from it on next foreground.',
            { category: 'sync' },
          );
        } catch {}
      }
      return { ok: false, firstPush: false };
    }
    if (!res.ok) {
      console.warn('[stateSync] push failed:', res.status);
      return { ok: false, firstPush: false };
    }
    await writeVersion(version);
    return { ok: true, firstPush: isFirstPush };
  } catch (err: any) {
    // AbortError = our timeout fired. Treat as a benign no-op; the next
    // AppState transition will retry. We don't surface this — sync failures
    // are noise to users; only conflicts (above) are worth telling them about.
    console.warn('[stateSync] push error:', err?.name === 'AbortError' ? 'timeout' : err?.message ?? err);
    return { ok: false, firstPush: false };
  }
}

/**
 * Result of a pull. `outcome` distinguishes:
 *   - `'applied'`   — cloud had newer state, we applied it locally
 *   - `'not_found'` — cloud confirmed no record exists (404). Safe to treat
 *                     the wallet as a fresh user (welcome-back, etc.)
 *   - `'local_newer'` — cloud had older state, we kept local. Not a fresh user.
 *   - `'failed'`    — couldn't reach cloud (timeout, network, 5xx). Treat
 *                     cloud answer as UNKNOWN — do NOT make irreversible
 *                     decisions like granting the welcome-back bonus.
 */
export type PullStateOutcome = 'applied' | 'not_found' | 'local_newer' | 'failed';

export interface PullStateResult {
  outcome: PullStateOutcome;
  /** True when we either applied or confirmed not_found — i.e., the cloud
   *  answer is reliable. Use this to gate first-time-only side effects. */
  cloudAnswerKnown: boolean;
}

/**
 * Pull state from the backend and overlay it onto the local Zustand stores.
 * Use on wallet connect/reconnect — the app can call this after the on-chain
 * restore so backend state lands on top of the chain-restored items/premium.
 *
 * Returns a discriminated result so callers can distinguish "cloud says no
 * record" (404, safe to apply welcome-back bonus) from "cloud is unreachable"
 * (timeout, must NOT apply welcome-back lest we double-pay).
 *
 * For back-compat with the previous boolean return, see `pullStateBool`.
 */
export async function pullStateDetailed(walletAddress: string | null | undefined): Promise<PullStateResult> {
  const base = process.env.EXPO_PUBLIC_STATE_API_URL?.replace(/\/+$/, '');
  if (!base || !walletAddress) return { outcome: 'failed', cloudAnswerKnown: false };

  try {
    const res = await fetchWithTimeout(`${base}/state?wallet=${encodeURIComponent(walletAddress)}`);
    if (res.status === 404) {
      // Cloud is reachable and definitively says "no record for this wallet."
      return { outcome: 'not_found', cloudAnswerKnown: true };
    }
    if (!res.ok) {
      console.warn('[stateSync] pull failed:', res.status);
      return { outcome: 'failed', cloudAnswerKnown: false };
    }
    const data = (await res.json()) as { state?: SyncedState; version?: number };
    if (!data.state || typeof data.version !== 'number') {
      return { outcome: 'failed', cloudAnswerKnown: false };
    }

    const localVersion = await readVersion();
    if (data.version <= localVersion) {
      console.log('[stateSync] pull skipped — local is at or ahead of cloud', {
        local: localVersion,
        cloud: data.version,
      });
      return { outcome: 'local_newer', cloudAnswerKnown: true };
    }

    applyState(data.state);
    await writeVersion(data.version);
    return { outcome: 'applied', cloudAnswerKnown: true };
  } catch (err: any) {
    console.warn('[stateSync] pull error:', err?.name === 'AbortError' ? 'timeout' : err?.message ?? err);
    return { outcome: 'failed', cloudAnswerKnown: false };
  }
}

/**
 * Backward-compatible boolean wrapper around pullStateDetailed.
 * Returns true only when we actually applied newer cloud state.
 */
export async function pullState(walletAddress: string | null | undefined): Promise<boolean> {
  const result = await pullStateDetailed(walletAddress);
  return result.outcome === 'applied';
}

/**
 * Reset per-session in-memory flags so user B (next connect on same device)
 * doesn't inherit user A's "I've already shown the conflict warning" state.
 * Safe to call from the wallet disconnect path even when we don't actually
 * `unregisterState` on the server (we keep the cloud row so accidental
 * disconnect doesn't lose data).
 */
export function resetSyncSessionState(): void {
  conflictNoticeShown = false;
  lastPushAt = 0;
}

/**
 * Best-effort delete the user's row on the backend (used on wallet
 * disconnect). Silently no-ops on any failure.
 */
export async function unregisterState(walletAddress: string | null | undefined): Promise<void> {
  const base = process.env.EXPO_PUBLIC_STATE_API_URL?.replace(/\/+$/, '');
  if (!base || !walletAddress) return;
  try {
    await fetchWithTimeout(`${base}/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress }),
    });
  } catch {}
  await writeVersion(0);
  // Reset the in-process conflict notice so a re-connect doesn't carry over
  // a "shown already" flag from the prior wallet.
  conflictNoticeShown = false;
}

function applyState(s: SyncedState): void {
  // Each store is updated in isolation, then explicitly saved so AsyncStorage
  // matches the pulled cloud state. Without these saves, a subsequent app
  // restart would re-hydrate the OLD local values and silently discard
  // whatever we just pulled.
  if (s.xp) {
    // Never REGRESS XP/level. The pull only runs when cloud's version counter
    // is higher — but version doesn't reflect who has more progress. A user
    // who earned XP offline (pushes failed, so local version didn't advance)
    // would otherwise have those gains wiped by an older-but-higher-version
    // snapshot from another device. totalXp only ever increases, so keep
    // whichever side is ahead and apply the matching level triple.
    const localXp = useXpStore.getState();
    if (s.xp.totalXp > localXp.totalXp) {
      useXpStore.setState({
        level: s.xp.level,
        totalXp: s.xp.totalXp,
        xpInCurrentLevel: s.xp.xpInCurrentLevel,
      });
      saveXpState(useXpStore.getState());
    }
  }

  if (s.pet) {
    const existing = usePetStore.getState();
    usePetStore.setState({
      // Don't overwrite name if local already has one (chain-restore may have
      // set it more authoritatively).
      name: existing.name || s.pet.name,
      ownerName: existing.ownerName || s.pet.ownerName,
      streakDays: s.pet.streakDays,
      streakFreezes: s.pet.streakFreezes,
      lastFreezeRefillDate: s.pet.lastFreezeRefillDate,
      lastActiveDate: s.pet.lastActiveDate,
      lastBrokenStreak: s.pet.lastBrokenStreak,
      streakBrokenAt: s.pet.streakBrokenAt,
      welcomeBackBonusAppliedAt: s.pet.welcomeBackBonusAppliedAt,
    });
    savePetState(usePetStore.getState());
  }

  if (s.adventure) {
    // Lifetime counters only ever go up — take the max so offline gains
    // aren't lost to an older snapshot. Spendable/resettable fields
    // (shards, freeItemTokens, login day/date, doubleXp) keep cloud's value
    // (last-writer-wins) since maxing them would be wrong (they can decrease).
    const localAdv = useAdventureStore.getState();
    useAdventureStore.setState({
      evolutionShards: s.adventure.evolutionShards,
      freeItemTokens: s.adventure.freeItemTokens,
      completedAdventures: Math.max(localAdv.completedAdventures, s.adventure.completedAdventures),
      miniGamesWon: Math.max(localAdv.miniGamesWon, s.adventure.miniGamesWon),
      currentLoginDay: s.adventure.currentLoginDay,
      totalLoginDays: Math.max(localAdv.totalLoginDays, s.adventure.totalLoginDays),
      lastLoginClaimDate: s.adventure.lastLoginClaimDate,
      doubleXpUntil: s.adventure.doubleXpUntil,
    });
    saveAdventureState(useAdventureStore.getState());
  }

  if (s.wallet) {
    useWalletStore.setState({
      appCoins: s.wallet.appCoins,
      coinsEarnedToday: s.wallet.coinsEarnedToday,
      coinsEarnedDate: s.wallet.coinsEarnedDate,
    });
    // Persist appCoins to AsyncStorage too — pullState should leave the app in
    // the same state as a fresh hydration would.
    hydrateAppCoins; // referenced to keep the import live for clarity
    AsyncStorage.setItem('oracle-pet-app-coins', String(s.wallet.appCoins)).catch(() => {});
    AsyncStorage.setItem('oracle-pet-coin-caps', JSON.stringify({
      earnedToday: s.wallet.coinsEarnedToday,
      earnedDate: s.wallet.coinsEarnedDate,
    })).catch(() => {});
  }
}
