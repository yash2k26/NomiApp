// Polyfills MUST be imported before anything else
import './src/polyfills';

import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, LogBox, AppState } from 'react-native';
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
import { WalletConnect } from './src/components';
import { HomeScreen, ProfileScreen, MintScreen, ShopScreen } from './src/screens';
import { GamesScreen } from './src/screens/GamesScreen';

import './global.css';

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

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home', icon: '\u{1F3E0}', label: 'HOME' },
  { key: 'games', icon: '\u{1F3AE}', label: 'GAMES' },
  { key: 'shop', icon: '\u{1F6CD}\uFE0F', label: 'SHOP' },
  { key: 'profile', icon: '\u{1F464}', label: 'ME' },
];

function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
  return (
    <View
      className="flex-row bg-white rounded-t-[30px] pb-7 pt-2.5 border-t border-pet-blue-light/40"
      style={{
        shadowColor: '#22314A',
        shadowOffset: { width: 0, height: -6 },
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
            <View className={`px-6 py-1.5 rounded-[16px] mb-1 ${isActive ? 'bg-pet-blue/20 border border-pet-blue-light' : ''}`}>
              <Text className={`text-[21px] ${!isActive ? 'opacity-35' : ''}`}>
                {tab.icon}
              </Text>
            </View>
            <View className="items-center">
              <Text className={`text-[10px] font-bold uppercase tracking-[0.6px] ${isActive ? 'text-pet-blue-dark' : 'text-gray-300'}`}>
                {tab.label}
              </Text>
              <View className={`mt-1 h-1 rounded-full ${isActive ? 'w-5 bg-pet-blue' : 'w-1 bg-transparent'}`} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [hydrated, setHydrated] = useState(false);
  const connected = useWalletStore((s) => s.connected);
  const hasPet = usePetStore((s) => s.hasPet);

  const hydrateWallet = useWalletStore((s) => s.hydrateWallet);
  const hydrateShop = useShopStore((s) => s.hydrateShop);
  const hydrateXp = useXpStore((s) => s.hydrateXp);
  const hydrateAdventure = useAdventureStore((s) => s.hydrateAdventure);
  const hydratePremium = usePremiumStore((s) => s.hydratePremium);
  const hydratePersonality = usePersonalityStore((s) => s.hydratePersonality);
  const hydrateEvents = useEventStore((s) => s.hydrateEvents);
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications);
  const requestNotificationPermission = useNotificationStore((s) => s.requestPermission);
  const scheduleReturnNotifications = useNotificationStore((s) => s.scheduleReturnNotifications);

  useEffect(() => {
    Promise.all([hydratePetStore(), hydrateWallet(), hydrateShop(), hydrateXp(), hydrateAdventure(), hydratePremium(), hydratePersonality(), hydrateEvents(), hydrateNotifications()]).finally(() => setHydrated(true));
  }, [hydrateWallet, hydrateShop, hydrateXp, hydrateAdventure, hydratePremium, hydratePersonality, hydrateEvents, hydrateNotifications]);

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

  const renderScreen = () => {
    switch (activeTab) {
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
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!connected) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-pet-background" edges={['top']}>
            <WalletConnect />
            <StatusBar style="dark" />
          </SafeAreaView>
        </SafeAreaProvider>
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
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-pet-background" edges={['top']}>
          <View className="flex-1">
            {renderScreen()}
          </View>
          <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
