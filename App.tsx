// Polyfills MUST be imported before anything else
import './src/polyfills';

// Patch every <Text> / <TextInput> to default to Fredoka (with weight-aware
// variant lookup). Must run BEFORE any RN component is rendered.
import { applyDefaultFonts } from './src/lib/fontPatch';
applyDefaultFonts();

import React, { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, LogBox, AppState, BackHandler, Platform, Image, ActivityIndicator, Animated, StyleSheet, InteractionManager, type ImageSourcePropType } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useWalletStore, hydrateAppCoins, hydrateCapToastShown } from './src/store/walletStore';
import { usePetStore, hydratePetStore, STREAK_REPAIR_WINDOW_MS } from './src/store/petStore';
import { useShopStore } from './src/store/shopStore';
import { useXpStore } from './src/store/xpStore';
import { useAdventureStore } from './src/store/adventureStore';
import { usePremiumStore } from './src/store/premiumStore';
import { usePersonalityStore } from './src/store/personalityStore';
import { useEventStore } from './src/store/eventStore';
import { useNotificationStore } from './src/store/notificationStore';
import { useTxHistoryStore } from './src/store/txHistoryStore';
import { initSounds, hydrateMuteSetting } from './src/lib/soundManager';
import { initAnalytics, captureError, identify, events, screen as trackScreen } from './src/lib/analytics';
import { notify } from './src/lib/notify';
import { parseDeepLink, setPendingReferral } from './src/lib/deepLinks';
import { registerForServerPush, sendHeartbeat } from './src/lib/pushService';
import { pushState, pullStateDetailed } from './src/lib/stateSyncService';
import * as Linking from 'expo-linking';
import { WalletConnect, WelcomeIntro } from './src/components';
import { StreakRepairModal } from './src/components/StreakRepairModal';
import { WelcomeBackModal } from './src/components/WelcomeBackModal';
import { ToastHost } from './src/components/notifications/ToastHost';
import { useNotificationCenter } from './src/store/notificationCenterStore';
import { HomeScreen, ProfileScreen, MintScreen, ShopScreen, NameInputScreen } from './src/screens';
import { GamesScreen } from './src/screens/GamesScreen';
import { petTypography } from './src/theme/typography';
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

import './global.css';

// Error boundary to prevent white-screen crashes during demo
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    captureError(error, { component_stack: info.componentStack ?? undefined, surface: 'error_boundary' });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F4F8' }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>{'😵'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#2D6B90', marginBottom: 8 }}>Oops! Something went wrong</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#4FB0C6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Suppress EXGL warnings globally
LogBox.ignoreLogs([
  'EXGL: gl.pixelStorei()',
  'THREE.Clock',
  'THREE.WARNING',
  'authorization request failed',
]);

const originalLog = console.log;
console.log = (...args) => {
  const message = args[0]?.toString?.() || '';
  if (
    message.includes('EXGL: gl.pixelStorei') ||
    message.includes('THREE.Clock') ||
    message.includes('THREE.WARNING')
  ) {
    return;
  }
  originalLog.apply(console, args);
};

// Returning-user apology bonus floor — applied once per device when a pet is
// recovered from on-chain holdings (older mint, no local progress). The
// actual bonus scales UP from these floors based on the user's on-chain
// footprint (mint age, shop purchases, premium tier) — see
// computeLegacyBonus below.
const WELCOME_BACK_BASE_LEVEL = 5;
const WELCOME_BACK_BASE_COINS = 500;
const WELCOME_BACK_BASE_FREEZES = 3;
const WELCOME_BACK_BASE_FREE_ITEMS = 1;

interface LegacyBonus {
  level: number;
  streak: number;
  coins: number;
  freezes: number;
  freeItems: number;
}

/**
 * Scale the welcome-back bonus by what the user actually did on chain. A
 * brand-new mint that immediately re-installed gets the floor. A user who
 * minted a month ago and has 5 shop purchases + Pro tier gets a substantial
 * level/coin grant — closer to where they actually were before we lost
 * their data.
 */
function computeLegacyBonus(opts: {
  earliestMemoTs: number | null;
  shopCount: number;
  premiumTier: 'none' | 'plus' | 'pro';
  streakFromMemo: number | null;
}): LegacyBonus {
  const daysActive = opts.earliestMemoTs
    ? Math.max(0, Math.floor((Date.now() / 1000 - opts.earliestMemoTs) / 86400))
    : 7; // pre-memo users (oldest cohort) get a baseline 7-day credit

  // Level ladder: floor + time + activity + tier. Capped at 50 (game max).
  let level = WELCOME_BACK_BASE_LEVEL;
  level += Math.min(15, Math.floor(daysActive / 3));
  level += Math.min(10, opts.shopCount * 2);
  if (opts.premiumTier === 'plus') level += 5;
  if (opts.premiumTier === 'pro') level += 10;
  level = Math.min(50, level);

  // Streak: prefer the user's last on-chain sync if they ever pressed the
  // sync button. Otherwise estimate from engagement age, capped to a
  // believable number.
  const streak = opts.streakFromMemo != null
    ? opts.streakFromMemo
    : Math.min(7, Math.floor(daysActive / 2));

  // Coins / freezes / free items scale similarly.
  const coins = WELCOME_BACK_BASE_COINS
    + (opts.shopCount * 100)
    + (opts.premiumTier === 'plus' ? 500 : opts.premiumTier === 'pro' ? 2000 : 0);
  const freezes = WELCOME_BACK_BASE_FREEZES + (opts.premiumTier !== 'none' ? 2 : 0);
  const freeItems = WELCOME_BACK_BASE_FREE_ITEMS
    + (opts.premiumTier === 'plus' ? 1 : opts.premiumTier === 'pro' ? 2 : 0);

  return { level, streak, coins, freezes, freeItems };
}

type Tab = 'home' | 'games' | 'shop' | 'profile';

const TAB_ICONS: Record<Tab, ImageSourcePropType> = {
  home: require('./assets/Icons/Home.png'),
  games: require('./assets/Icons/Play.png'),
  shop: require('./assets/Icons/Shop.png'),
  profile: require('./assets/Icons/Me.png'),
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'HOME' },
  { key: 'games', label: 'GAMES' },
  { key: 'shop', label: 'SHOP' },
  { key: 'profile', label: 'ME' },
];

function TabBar({ activeTab, onTabPress, scrollPos }: { activeTab: Tab; onTabPress: (tab: Tab) => void; scrollPos: Animated.Value }) {
  return (
    <View
      className="flex-row bg-white pb-7 pt-4 border-t border-pet-blue-light/70"
      style={{
        borderTopLeftRadius: 38,
        borderTopRightRadius: 38,
        shadowColor: '#2D6B90',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 10,
      }}
    >
      {TABS.map((tab, i) => {
        const isActive = activeTab === tab.key;
        // Highlight strength tracks how close the pager is to this tab:
        // 1 when centered on it, fading to 0 at the neighbours. Driven by the
        // continuous pager position so the focus area follows the swipe.
        const focus = scrollPos.interpolate({
          inputRange: [i - 1, i, i + 1],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        const iconOpacity = scrollPos.interpolate({
          inputRange: [i - 1, i, i + 1],
          outputRange: [0.35, 1, 0.35],
          extrapolate: 'clamp',
        });
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.8}
            className="flex-1 items-center"
          >
            <View style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              marginBottom: 6,
              height: 60,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {/* Focus pill — fades in/out with the swipe instead of snapping. */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0, right: 0,
                  borderRadius: 18,
                  backgroundColor: 'rgba(79, 176, 198, 0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(167, 215, 230, 0.8)',
                  opacity: focus,
                }}
              />
              <Animated.Image
                source={TAB_ICONS[tab.key]}
                style={{ width: 60, height: 60, opacity: iconOpacity }}
                resizeMode="contain"
              />
            </View>
            <View className="items-center">
              <Text
                className={`text-[10px] font-black uppercase tracking-[1px] ${isActive ? 'text-pet-blue-dark' : 'text-gray-300'}`}
                style={{ fontFamily: petTypography.strong }}
              >
                {tab.label}
              </Text>
              <Animated.View style={{
                marginTop: 4,
                height: 6,
                borderRadius: 3,
                width: 28,
                backgroundColor: '#4FB0C6',
                opacity: focus,
              }} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Cross-fade between WelcomeIntro and WalletConnect.
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(welcomeOpacity, {
      toValue: showWelcomeIntro ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [showWelcomeIntro, welcomeOpacity]);

  // (walletConnectReady — WalletConnect mount is deferred. Defined after
  // `connected` is declared below since it depends on it.)
  const [walletConnectReady, setWalletConnectReady] = useState(false);

  // Single-family typography — every text in the app renders in Fredoka.
  // We use only 3 weights (Medium / SemiBold / Bold); fewer fonts = faster
  // useFonts resolution = snappier cold start.
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const connected = useWalletStore((s) => s.connected);
  const hasPet = usePetStore((s) => s.hasPet);
  const ownerName = usePetStore((s) => s.ownerName);

  // Pre-warm WalletConnect the instant we're hydrated. It used to wait
  // 1.2s post-mount to avoid blocking the welcome screen's interactivity,
  // then later we tried force-mounting on tap — but that made the Continue
  // tap laggy because mounting blocks the JS thread for ~200ms.
  // The cleanest path: mount it right after hydration completes. The 200ms
  // cost happens behind the WelcomeIntro fade, which is already on screen,
  // and by the time the user taps Continue (1+ seconds later), WalletConnect
  // is fully ready.
  useEffect(() => {
    if (!hydrated || connected || walletConnectReady) return;
    setWalletConnectReady(true);
  }, [hydrated, connected, walletConnectReady]);

  const hydrateWallet = useWalletStore((s) => s.hydrateWallet);
  const hydrateShop = useShopStore((s) => s.hydrateShop);
  const hydrateXp = useXpStore((s) => s.hydrateXp);
  const hydrateAdventure = useAdventureStore((s) => s.hydrateAdventure);
  const hydratePremium = usePremiumStore((s) => s.hydratePremium);
  const hydratePersonality = usePersonalityStore((s) => s.hydratePersonality);
  const hydrateEvents = useEventStore((s) => s.hydrateEvents);
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications);
  const hydrateTxLabels = useTxHistoryStore((s) => s.hydrateTxLabels);
  const refreshSkrBalance = useWalletStore((s) => s.refreshSkrBalance);
  const requestNotificationPermission = useNotificationStore((s) => s.requestPermission);
  const scheduleReturnNotifications = useNotificationStore((s) => s.scheduleReturnNotifications);

  useEffect(() => {
    initAnalytics();
    Promise.all([
      hydratePetStore(),
      hydrateShop(),
      hydrateXp(),
      hydrateAdventure(),
      hydratePremium(),
      hydratePersonality(),
      hydrateEvents(),
      hydrateNotifications(),
      hydrateTxLabels(),
      hydrateAppCoins().then(({ amount, caps }) => useWalletStore.setState({
        appCoins: amount,
        coinsEarnedToday: caps.earnedToday,
        coinsEarnedDate: caps.earnedDate,
      })),
      // Restore "we already showed today's cap toast" state so force-close
      // + reopen on the same UTC day doesn't re-trigger the toast users
      // misread as "coins vanishing."
      hydrateCapToastShown(),
      // Hydrate the local pending-tx log so the Profile screen shows the
      // user's tx history immediately on launch instead of an empty list.
      require('./src/store/pendingTxStore').usePendingTxStore.getState().hydrate(),
      useNotificationCenter.getState().hydrate(),
      // Just load the persisted mute flag here (a quick AsyncStorage read).
      // initSounds (decoding ~8 MP3s) is deliberately NOT awaited in this
      // Promise.all — doing so blocked `setHydrated` on the audio decode and
      // also made that decode compete with the heavy 3D GLB parse, slowing
      // "Preparing Nomi's world". It's deferred below to run once the UI is
      // idle; SFX aren't needed until the user interacts.
      hydrateMuteSetting(),
    ]).finally(() => {
      setHydrated(true);
      // Warm SFX off the critical path, after interactions/animations settle,
      // so it never competes with the model load or block boot.
      InteractionManager.runAfterInteractions(() => { initSounds(); });
    });

    // Wallet reauth runs in parallel but doesn't block the UI. The actual
    // chain restore is owned by the wallet-address-watch effect below — that
    // way it fires on every address change (fresh install, reconnect, swap to
    // a different wallet) instead of only on cold starts with empty local data.
    hydrateWallet()
      .then(async () => {
        try { await refreshSkrBalance(); } catch {}
      })
      .catch(() => {});
  }, [hydrateWallet, hydrateShop, hydrateXp, hydrateAdventure, hydratePremium, hydratePersonality, hydrateEvents, hydrateNotifications, hydrateTxLabels, refreshSkrBalance]);

  // Android system back gesture/button behavior for custom, non-stack navigation flow.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (!hydrated) return true;

      // Wallet flow: go back from wallet connect to intro page.
      if (!connected && !showWelcomeIntro) {
        setShowWelcomeIntro(true);
        return true;
      }

      // Main app: back from non-home tabs returns to Home first.
      if (connected && hasPet && activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }

      // Let Android handle default behavior (app background/exit).
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [hydrated, connected, hasPet, showWelcomeIntro, activeTab]);

  // Request notification permission after first pet mint, then register the
  // device with the push worker so server-side return pushes can fire even
  // after the OS kills the app.
  useEffect(() => {
    if (!hasPet) return;
    let cancelled = false;
    (async () => {
      const granted = await requestNotificationPermission();
      if (cancelled || !granted) return;
      const wallet = useWalletStore.getState().address;
      if (!wallet) return;
      const pet = usePetStore.getState();
      await registerForServerPush({
        wallet,
        pet_name: pet.name || undefined,
        owner_name: pet.ownerName || undefined,
      });
    })();
    return () => { cancelled = true; };
  }, [hasPet, requestNotificationPermission]);

  // Schedule return notifications when app goes to background, cancel when foreground.
  // Foreground transitions also push a heartbeat to the server so it knows this
  // device is "active" and skips the return-push for ~24h. Both transitions
  // push backed-up game state to the cloud so a sudden reinstall / wallet
  // disconnect / device swap doesn't lose progress.
  //
  // CRITICAL: empty dep array. Pulling scheduleReturnNotifications from the
  // store via a stable ref means we never re-subscribe — old listeners can't
  // accumulate. Previously `[scheduleReturnNotifications]` caused listener
  // stacking when Zustand re-created the function reference, so a single
  // foreground transition could fire pushState 5-10x, draining battery and
  // hammering the state-sync worker.
  const scheduleReturnNotificationsRef = useRef(scheduleReturnNotifications);
  scheduleReturnNotificationsRef.current = scheduleReturnNotifications;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      events.appState(state as 'active' | 'background' | 'inactive');
      const wallet = useWalletStore.getState().address;
      if (state === 'background' || state === 'inactive') {
        scheduleReturnNotificationsRef.current();
        if (wallet) pushState(wallet).catch(() => {});
      } else if (state === 'active') {
        // Catch up streak / stamina regen / stat decay for the time the app
        // was backgrounded. Without this the daily streak never advances.
        try { usePetStore.getState().tick(); } catch {}
        useNotificationStore.getState().cancelAll();
        if (wallet) {
          const pet = usePetStore.getState();
          const xp = require('./src/store/xpStore').useXpStore.getState();
          sendHeartbeat({
            wallet,
            hunger: pet.hunger,
            happiness: pet.happiness,
            energy: pet.energy,
            level: xp.level,
            streak_days: pet.streakDays,
          });
          pushState(wallet).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  // app_open fires once when boot completes (hydrated + fonts ready).
  // Also runs petStore.tick() here — tick was an orphan (never called from
  // anywhere) so the daily streak never advanced, the streak-break detection
  // never ran (which is why JG's streak was stuck at 5 + the broken-streak
  // modal kept re-firing from stale state), stamina regen + stat decay since
  // last open never ran. The AppState=active handler below also calls tick()
  // so foregrounding catches up.
  const appOpenFired = useRef(false);
  useEffect(() => {
    if (hydrated && fontsLoaded && !appOpenFired.current) {
      appOpenFired.current = true;
      events.appOpen({ cold_start: true });
      try { usePetStore.getState().tick(); } catch {}
    }
  }, [hydrated, fontsLoaded]);

  // Identify user by wallet address; track wallet_connected once per session.
  const walletAddress = useWalletStore((s) => s.address);
  const balance = useWalletStore((s) => s.balance);
  const skrBalance = useWalletStore((s) => s.skrBalance);
  const lastIdentifiedAddr = useRef<string | null>(null);
  useEffect(() => {
    if (connected && walletAddress && lastIdentifiedAddr.current !== walletAddress) {
      lastIdentifiedAddr.current = walletAddress;
      identify(walletAddress, { has_pet: hasPet, owner_name: ownerName ?? null });
      events.walletConnected({ address: walletAddress, balance_sol: balance, skr_balance: skrBalance });
    }
  }, [connected, walletAddress, hasPet, ownerName, balance, skrBalance]);

  // Auto-restore from chain whenever the connected wallet address changes.
  // Fires on: fresh install, app reinstall, wallet reconnect, swap to a
  // different wallet on the same device. Idempotent — the underlying
  // restoreFromChain calls just set owned=true / tier=X. Runs in background;
  // failures are logged. The "Restore Purchases" button in Profile remains
  // for manual retries.
  const lastRestoredAddr = useRef<string | null>(null);
  const [autoRestoring, setAutoRestoring] = useState(false);
  // Hard cap so a hung RPC doesn't trap the user on a loading screen forever.
  // After this fires we let MintScreen render even if restore is still going.
  const [restoreCheckExpired, setRestoreCheckExpired] = useState(false);
  // Welcome-back modal — shown once when a returning user is detected
  // (pet found via holdings scan, no local progress, no prior bonus).
  const [welcomeBackVisible, setWelcomeBackVisible] = useState(false);
  const [legacyBonus, setLegacyBonus] = useState<LegacyBonus | null>(null);
  useEffect(() => {
    if (!hydrated || !connected || !walletAddress) return;
    if (lastRestoredAddr.current === walletAddress) return;
    lastRestoredAddr.current = walletAddress;
    setAutoRestoring(true);
    setRestoreCheckExpired(false);
    (async () => {
      try {
        const { restorePurchases } = require('./src/lib/purchaseRestore');
        const result = await restorePurchases(walletAddress);
        if (result.totalFound > 0) {
          console.log('[App] auto-restore from chain:', result);
        }

        // Pull backed-up state from cloud after the on-chain restore lands.
        // Backend has XP/streak/coins/freezes/etc. that aren't on chain.
        // Order matters: chain restore sets pet identity + items + premium;
        // backend then overlays the per-device progress on top.
        //
        // Using the detailed variant so we can distinguish "cloud confirmed
        // no record exists" (safe for welcome-back) from "cloud is
        // unreachable" (do NOT grant welcome-back — we'd double-pay if cloud
        // actually has a record from another device).
        let pullOutcome: 'applied' | 'not_found' | 'local_newer' | 'failed' = 'failed';
        let cloudAnswerKnown = false;
        try {
          const result = await pullStateDetailed(walletAddress);
          pullOutcome = result.outcome;
          cloudAnswerKnown = result.cloudAnswerKnown;
          if (pullOutcome === 'applied') console.log('[App] cloud state pulled');
        } catch (err: any) {
          console.warn('[App] cloud state pull failed:', err?.message ?? err);
        }
        const pulled = pullOutcome === 'applied';

        // CRITICAL for users upgrading from the old version: if the backend
        // has no record yet, push the user's local state immediately. Without
        // this they'd have to background the app at least once before their
        // existing XP/streak/coins were safely backed up — and a reinstall
        // before that first transition would lose everything.
        if (!pulled) {
          try {
            const result = await pushState(walletAddress, { bypassDebounce: true });
            if (result.ok && result.firstPush) {
              // Only show this once — once the user has pushed, they're safe.
              notify.success(
                'Cloud backup active',
                "Your XP, streak and coins are now backed up. They'll survive reinstalls and wallet reconnects.",
                { category: 'system' },
              );
            }
          } catch (err: any) {
            console.warn('[App] initial push failed:', err?.message ?? err);
          }
        }

        // Returning user detected: pet was restored from on-chain holdings
        // (not a freshly-written memo) AND there's no local progress AND we
        // haven't previously gifted this device. Apply apology bonus + show
        // modal. All three checks needed so we don't pay out twice or to
        // brand-new mints that just happened to use the holdings path.
        // Welcome-back bonus eligibility — broadened in v1.1.1 to catch the
        // population we actually want to apologize to: existing v1.0 users
        // whose game-coin rewards were eaten by the bug. The original
        // criteria (xp.totalXp === 0) gated on "fresh install" but those
        // users WEREN'T affected by the bug. v1.0 → v1.1 updaters with
        // persisted XP > 0 are the actual victims.
        //
        // New eligibility:
        //   - Bonus not yet applied (welcomeBackBonusAppliedAt === 0)
        //   - Pet was found on chain (any path — memo OR holdings restore)
        //   - Their earliest oracle-pet:* memo is >24h old (proves they're
        //     a legacy user, not a brand-new minter who just installed)
        //   - Cloud answer is KNOWN (either pull succeeded or 404 confirmed).
        //     Without this gate: cloud might have welcomeBackBonusAppliedAt
        //     set from another device, but our pull timed out, so we'd grant
        //     the bonus a second time. Skipping when cloud is unreachable is
        //     the safe default — we'll try again on the next launch.
        if ((result.petRestored || result.petRestoredFromHoldings) && cloudAnswerKnown) {
          const xp = useXpStore.getState();
          const wallet = useWalletStore.getState();
          const pet = usePetStore.getState();
          const earliestMemoAge = result.earliestMemoTimestamp
            ? Date.now() - result.earliestMemoTimestamp * 1000
            : 0;
          const isLegacyUser = earliestMemoAge > 24 * 60 * 60 * 1000;
          const eligible =
            pet.welcomeBackBonusAppliedAt === 0
            && isLegacyUser;
          if (eligible) {
            console.log('[App] welcome-back bonus eligible — legacy user detected');
            const bonus = computeLegacyBonus({
              earliestMemoTs: result.earliestMemoTimestamp,
              shopCount: result.shopItemsRestored.length,
              premiumTier: (result.premiumTierRestored ?? 'none') as 'none' | 'plus' | 'pro',
              streakFromMemo: result.streakRestored,
            });
            console.log('[App] welcome-back bonus:', bonus);

            // Atomicity: all setState + persist calls below must complete
            // BEFORE the modal shows. Previously these were fire-and-forget,
            // so a crash mid-grant could leave the user with partial loot
            // (e.g., level bumped but coins lost) AND no second-chance gate
            // — welcomeBackBonusAppliedAt would already be set on retry.
            // Now we await every save, then flip the marker LAST.
            const xpMod = require('./src/store/xpStore');
            const targetLevel = Math.max(xp.level, bonus.level);
            const targetTotalXp = Math.max(xp.totalXp, xpMod.getCumulativeXpForLevel(targetLevel));
            useXpStore.setState({
              level: targetLevel,
              totalXp: targetTotalXp,
              xpInCurrentLevel: targetLevel > xp.level ? 0 : xp.xpInCurrentLevel,
            });

            if (bonus.streak > 0 && bonus.streak > pet.streakDays) {
              const today = new Date().toISOString().slice(0, 10);
              usePetStore.setState({
                streakDays: bonus.streak,
                lastActiveDate: today,
              });
            }

            // addAppCoins persists internally.
            wallet.addAppCoins(bonus.coins);

            usePetStore.setState({
              streakFreezes: pet.streakFreezes + bonus.freezes,
              // welcomeBackBonusAppliedAt set AFTER persists succeed below
            });

            const adv = useAdventureStore.getState();
            useAdventureStore.setState({
              freeItemTokens: adv.freeItemTokens + bonus.freeItems,
            });

            const petMod = require('./src/store/petStore');
            const advMod = require('./src/store/adventureStore');

            // Await all persists in parallel. If any throw (they shouldn't —
            // each catches internally — but defensive), we still mark applied
            // since in-memory state is already updated and the modal will show.
            try {
              await Promise.all([
                xpMod.saveXpState(useXpStore.getState()),
                petMod.savePetState(usePetStore.getState()),
                advMod.saveAdventureState(useAdventureStore.getState()),
              ]);
            } catch (err: any) {
              console.warn('[App] welcome-back save partial failure:', err?.message);
            }

            // NOW flip the gate marker so a re-entry can't double-pay even
            // if the modal display fails.
            usePetStore.setState({ welcomeBackBonusAppliedAt: Date.now() });
            await petMod.savePetState(usePetStore.getState());

            setLegacyBonus(bonus);
            setWelcomeBackVisible(true);

            // Push the bonus to cloud immediately so subsequent reinstalls
            // restore the granted level/streak/coins from backend, not from
            // the empty welcome-back-eligibility path again.
            pushState(walletAddress, { bypassDebounce: true }).catch(() => {});
          }
        }

        // Auto-restore visibility: fire a notification when something was
        // actually pulled off the chain or backend, so the user sees that
        // the connection silently extracted their data. Skip when:
        //   - nothing was found (brand new wallet — no point telling them)
        //   - the welcome-back modal already covers it (don't double-notify)
        // The notification persists in the bell so users can review what
        // came back later.
        const welcomeBackJustFired = result.petRestoredFromHoldings &&
          usePetStore.getState().welcomeBackBonusAppliedAt > 0 &&
          (Date.now() - usePetStore.getState().welcomeBackBonusAppliedAt) < 5000;
        const somethingRestored = result.shopItemsRestored.length > 0
          || result.premiumTierRestored
          || result.streakRestored !== null
          || result.petRestored
          || pulled;
        if (somethingRestored && !welcomeBackJustFired) {
          const parts: string[] = [];
          const details: { label: string; value: string }[] = [];
          if (result.petRestored) {
            parts.push('Pet identity');
            details.push({ label: 'Pet', value: result.petRestoredFromHoldings ? 'Found via on-chain holdings' : 'Found via memo' });
          }
          if (result.shopItemsRestored.length > 0) {
            parts.push(`${result.shopItemsRestored.length} item${result.shopItemsRestored.length === 1 ? '' : 's'}`);
            details.push({ label: 'Items', value: `${result.shopItemsRestored.length} restored` });
          }
          if (result.premiumTierRestored) {
            const label = result.premiumTierRestored.charAt(0).toUpperCase() + result.premiumTierRestored.slice(1);
            parts.push(`${label} tier`);
            details.push({ label: 'Premium', value: `${label} tier active` });
          }
          if (result.streakRestored !== null) {
            parts.push(`${result.streakRestored}-day streak`);
            details.push({ label: 'Streak', value: `${result.streakRestored} days` });
          }
          if (pulled) {
            parts.push('cloud progress');
            details.push({ label: 'Cloud', value: 'XP/coins synced from backup' });
          }
          notify.success(
            'Welcome back',
            `Restored ${parts.join(' · ')}`,
            { category: 'restore', details },
          );
        }
      } catch (err: any) {
        console.warn('[App] auto-restore failed:', err?.message ?? err);
        // Don't show this as an error if the user already has a pet — they
        // were probably already happy and don't need a scary notification.
        // Only surface when they're stuck on MintScreen because of it.
        const stuck = !usePetStore.getState().hasPet;
        if (stuck) {
          notify.warning(
            "Couldn't reach the chain",
            'Tap "Already minted? Restore from chain" on the mint screen to retry.',
            { category: 'restore' },
          );
        }
      } finally {
        setAutoRestoring(false);
      }
    })();
  }, [hydrated, connected, walletAddress]);

  // 15s safety net for the splash above MintScreen — see the !hasPet branch.
  // Bumped from 8s → 15s after real users on slow networks reported the
  // splash giving up while the chain scan was still in flight, then the
  // user mistakenly minting a duplicate (paying 0.15 SOL twice). 15s
  // covers nearly every realistic RPC latency. The splash also surfaces
  // a warning hint when this fires so the user knows to wait or check
  // chain rather than tap mint.
  useEffect(() => {
    if (!autoRestoring) return;
    const timer = setTimeout(() => setRestoreCheckExpired(true), 15000);
    return () => clearTimeout(timer);
  }, [autoRestoring]);

  // Screen view per tab change (only after main app is reachable).
  useEffect(() => {
    if (hydrated && connected && hasPet) trackScreen(activeTab);
  }, [activeTab, hydrated, connected, hasPet]);

  // Deep link handling — parse incoming oraclepet:// URLs (cold + warm) and
  // stash any pending referral so ReferralCard auto-fills it after wallet
  // connect. The on-chain redeem flow (separate H1 item) reads the same key.
  useEffect(() => {
    const handle = (url: string | null) => {
      const parsed = parseDeepLink(url);
      if (parsed.type === 'referral' && parsed.ref) {
        setPendingReferral(parsed.ref);
        events.referralLinkOpened({ referrer_address: parsed.ref });
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, []);

  // Streak repair offer — fire once per session if a recent break is recoverable.
  const lastBrokenStreak = usePetStore((s) => s.lastBrokenStreak);
  const streakBrokenAt = usePetStore((s) => s.streakBrokenAt);
  const [streakRepairVisible, setStreakRepairVisible] = useState(false);
  const streakRepairShownThisSession = useRef(false);
  useEffect(() => {
    if (!hydrated || !connected || !hasPet) return;
    if (streakRepairShownThisSession.current) return;
    if (lastBrokenStreak < 1) return;
    if (Date.now() - streakBrokenAt > STREAK_REPAIR_WINDOW_MS) return;
    streakRepairShownThisSession.current = true;
    setStreakRepairVisible(true);
  }, [hydrated, connected, hasPet, lastBrokenStreak, streakBrokenAt]);

  // Finger-following pager. Screens live side-by-side in a native PagerView;
  // swiping drags between them 1:1 and snaps on release. activeTab stays the
  // source of truth: a user swipe reports via onPageSelected → setActiveTab,
  // and any programmatic tab change (tab-bar tap, onNavigateGames, the
  // force-home effect) is mirrored onto the pager by the effect below.
  const pagerRef = useRef<PagerView>(null);
  const pagerPageRef = useRef(0); // last position the pager actually reported
  // Continuous pager position (0..N-1) driving the tab-bar highlight so the
  // "focus area" tracks the swipe smoothly instead of snapping.
  const tabScroll = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (idx >= 0 && idx !== pagerPageRef.current) {
      pagerRef.current?.setPage(idx);
    }
  }, [activeTab]);

  if (!hydrated || !fontsLoaded) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-pet-background items-center justify-center" edges={['top']}>
            <Image source={TAB_ICONS.profile} style={{ width: 220, height: 220, marginBottom: 24 }} resizeMode="contain" />
            <ActivityIndicator size="large" color="#4FB0C6" />
            <Text
              className="text-gray-400 text-xs mt-4"
              style={{ fontFamily: petTypography.body }}
            >
              Preparing Nomi's world...
            </Text>
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!connected) {
    return (
      <GestureHandlerRootView className="flex-1">
        <View className="flex-1">
          {/* WalletConnect mounts ~1.2s after welcome to pre-warm without
              blocking the welcome screen's interactivity. By the time user
              taps Continue, WalletConnect is rendered underneath. */}
          {walletConnectReady && <WalletConnect />}
          <Animated.View
            pointerEvents={showWelcomeIntro ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}
          >
            <WelcomeIntro onContinue={() => setShowWelcomeIntro(false)} />
          </Animated.View>
        </View>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    );
  }

  if (!ownerName) {
    return (
      <GestureHandlerRootView className="flex-1">
        <NameInputScreen onComplete={() => {}} />
        <StatusBar style="light" />
      </GestureHandlerRootView>
    );
  }

  if (!hasPet) {
    // Hold MintScreen render while auto-restore is still checking the chain
    // for an existing Nomi NFT (covers the "I already minted, why is the
    // app asking me to mint again?" bug). Cap at 8s via restoreCheckExpired
    // so a hung RPC never traps the user.
    if (autoRestoring && !restoreCheckExpired) {
      return (
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <SafeAreaView className="flex-1 bg-pet-background items-center justify-center" edges={['top']}>
              <Image source={TAB_ICONS.profile} style={{ width: 180, height: 180, marginBottom: 24 }} resizeMode="contain" />
              <ActivityIndicator size="large" color="#4FB0C6" />
              <Text
                className="text-gray-500 text-sm mt-4 font-semibold"
                style={{ fontFamily: petTypography.body }}
              >
                Checking for your existing pet…
              </Text>
              <Text
                className="text-gray-400 text-[11px] mt-1"
                style={{ fontFamily: petTypography.body }}
              >
                Reading on-chain NFTs in your wallet
              </Text>
              <StatusBar style="dark" />
            </SafeAreaView>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      );
    }
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-pet-background" edges={['top']}>
            <MintScreen />
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-pet-background" edges={['top']}>
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={0}
              // Move the tab highlight DURING the swipe (at the halfway point),
              // not just when it settles — otherwise the highlight lagged the
              // finger and only jumped at the end. We also advance
              // pagerPageRef here so the activeTab→setPage sync effect doesn't
              // fire setPage mid-drag and fight the in-progress swipe.
              onPageScroll={(e) => {
                const { position, offset } = e.nativeEvent;
                // Drive the smooth tab-highlight position.
                tabScroll.setValue(position + offset);
                const idx = Math.round(position + offset);
                if (idx >= 0 && idx < TABS.length && idx !== pagerPageRef.current) {
                  pagerPageRef.current = idx;
                  const key = TABS[idx].key;
                  if (key !== activeTab) {
                    if (welcomeBackVisible) setWelcomeBackVisible(false);
                    if (streakRepairVisible) setStreakRepairVisible(false);
                    setActiveTab(key);
                  }
                }
              }}
              onPageSelected={(e) => {
                const pos = e.nativeEvent.position;
                pagerPageRef.current = pos;
                const key = TABS[pos]?.key;
                if (key && key !== activeTab) {
                  if (welcomeBackVisible) setWelcomeBackVisible(false);
                  if (streakRepairVisible) setStreakRepairVisible(false);
                  setActiveTab(key);
                }
              }}
            >
              {/* collapsable={false} is required on Android so the native
                  view backing each page isn't optimized away by RN. */}
              <View key="home" style={{ flex: 1 }} collapsable={false}>
                <HomeScreen onNavigateGames={() => setActiveTab('games')} paused={activeTab !== 'home'} />
              </View>
              <View key="games" style={{ flex: 1 }} collapsable={false}>
                <GamesScreen />
              </View>
              <View key="shop" style={{ flex: 1 }} collapsable={false}>
                <ShopScreen />
              </View>
              <View key="profile" style={{ flex: 1 }} collapsable={false}>
                <ProfileScreen />
              </View>
            </PagerView>
            {/* Tab presses also dismiss any root-level modal currently open.
                Without this, a user could navigate behind a still-visible
                WelcomeBack/StreakRepair modal and see its dim overlay
                blocking the new tab's UI. */}
            <TabBar
              activeTab={activeTab}
              scrollPos={tabScroll}
              onTabPress={(tab) => {
                if (welcomeBackVisible) setWelcomeBackVisible(false);
                if (streakRepairVisible) setStreakRepairVisible(false);
                setActiveTab(tab);
              }}
            />
            {/* Modal priority: when the legacy welcome-back bonus modal is up,
                suppress the streak-repair modal — both render full-screen
                dim overlays and would otherwise stack with the second one
                completely unreachable. WelcomeBack wins because it's a
                one-time apology surface; the streak-repair offer stays
                pending and will fire on the next app open after dismiss. */}
            <StreakRepairModal
              visible={streakRepairVisible && !(welcomeBackVisible && legacyBonus !== null)}
              onDismiss={() => {
                setStreakRepairVisible(false);
                // Clear the broken-streak state on ANY dismiss path (outside
                // tap, back press, anywhere). Previously only the explicit
                // "No thanks, start over" button cleared it — so closing the
                // modal any other way left lastBrokenStreak/streakBrokenAt set
                // and the trigger re-fired on every app open (JG: "popup
                // happens every time I open the app").
                try { usePetStore.getState().dismissStreakRepair(); } catch {}
              }}
            />
            <WelcomeBackModal
              visible={welcomeBackVisible && legacyBonus !== null}
              petName={usePetStore.getState().name || 'Nomi'}
              bonusLevel={legacyBonus?.level ?? WELCOME_BACK_BASE_LEVEL}
              bonusStreak={legacyBonus?.streak ?? 0}
              bonusCoins={legacyBonus?.coins ?? WELCOME_BACK_BASE_COINS}
              bonusFreezes={legacyBonus?.freezes ?? WELCOME_BACK_BASE_FREEZES}
              bonusFreeItems={legacyBonus?.freeItems ?? WELCOME_BACK_BASE_FREE_ITEMS}
              onClose={() => setWelcomeBackVisible(false)}
            />
            <ToastHost />
            {autoRestoring && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 12,
                  alignSelf: 'center',
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(31,41,55,0.92)',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 8, fontSize: 12, fontFamily: petTypography.body }}>
                  Restoring from chain…
                </Text>
              </View>
            )}
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
