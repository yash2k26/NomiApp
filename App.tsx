// Polyfills MUST be imported before anything else
import './src/polyfills';

import React, { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, LogBox, AppState, BackHandler, Platform, Image, type ImageSourcePropType } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useWalletStore } from './src/store/walletStore';
import { usePetStore, hydratePetStore } from './src/store/petStore';
import { useShopStore } from './src/store/shopStore';
import { useXpStore } from './src/store/xpStore';
import { useAdventureStore } from './src/store/adventureStore';
import { usePremiumStore } from './src/store/premiumStore';
import { usePersonalityStore } from './src/store/personalityStore';
import { useEventStore } from './src/store/eventStore';
import { useNotificationStore } from './src/store/notificationStore';
import { useTxHistoryStore } from './src/store/txHistoryStore';
import { initSounds } from './src/lib/soundManager';
import { WalletConnect, WelcomeIntro } from './src/components';
import { HomeScreen, ProfileScreen, MintScreen, ShopScreen, NameInputScreen } from './src/screens';
import { GamesScreen } from './src/screens/GamesScreen';
import { petTypography } from './src/theme/typography';

import './global.css';

// Error boundary to prevent white-screen crashes during demo
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
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

function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
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
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
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
              borderRadius: 18,
              backgroundColor: isActive ? 'rgba(79, 176, 198, 0.15)' : 'transparent',
              borderWidth: isActive ? 1 : 0,
              borderColor: isActive ? 'rgba(167, 215, 230, 0.8)' : 'transparent',
              height: 60,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Image
                source={TAB_ICONS[tab.key]}
                style={{ width: 60, height: 60, opacity: isActive ? 1 : 0.35 }}
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
              <View style={{
                marginTop: 4,
                height: 6,
                borderRadius: 3,
                width: isActive ? 28 : 4,
                backgroundColor: isActive ? '#4FB0C6' : 'transparent',
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
  const connected = useWalletStore((s) => s.connected);
  const hasPet = usePetStore((s) => s.hasPet);
  const ownerName = usePetStore((s) => s.ownerName);

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
    // Hydrate local stores first (fast), then wallet reauth (slow, talks to Phantom) in background
    Promise.all([hydratePetStore(), hydrateShop(), hydrateXp(), hydrateAdventure(), hydratePremium(), hydratePersonality(), hydrateEvents(), hydrateNotifications(), hydrateTxLabels(), initSounds()])
      .finally(() => setHydrated(true));
    // Wallet reauth runs in parallel but doesn't block the UI
    hydrateWallet().then(() => refreshSkrBalance()).catch(() => {});
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

  // Request notification permission after first pet mint
  useEffect(() => {
    if (hasPet) {
      requestNotificationPermission();
    }
  }, [hasPet, requestNotificationPermission]);

  // Schedule return notifications when app goes to background, cancel when foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        scheduleReturnNotifications();
      } else if (state === 'active') {
        // Cancel return notifications when user comes back
        useNotificationStore.getState().cancelAll();
      }
    });
    return () => sub.remove();
  }, [scheduleReturnNotifications]);

  const renderScreen = (tab: Tab) => {
    switch (tab) {
      case 'home':
        return <HomeScreen onNavigateGames={() => setActiveTab('games')} />;
      case 'games':
        return <GamesScreen />;
      case 'shop':
        return <ShopScreen />;
      case 'profile':
        return <ProfileScreen />;
    }
  };

  if (!hydrated) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-pet-background items-center justify-center" edges={['top']}>
            <Image source={TAB_ICONS.profile} style={{ width: 100, height: 100, marginBottom: 12 }} resizeMode="contain" />
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!connected) {
    if (showWelcomeIntro) {
      return (
        <GestureHandlerRootView className="flex-1">
          <WelcomeIntro onContinue={() => {
            // Use requestAnimationFrame to defer the state update,
            // allowing the button press animation to complete first
            requestAnimationFrame(() => setShowWelcomeIntro(false));
          }} />
          <StatusBar style="light" />
        </GestureHandlerRootView>
      );
    }

    return (
      <GestureHandlerRootView className="flex-1">
        <WalletConnect />
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
            <View className="flex-1">{renderScreen(activeTab)}</View>
            <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
