import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useWalletStore } from './src/store/walletStore';
import { usePetStore, hydratePetStore } from './src/store/petStore';
import { WalletConnect } from './src/components';
import { HomeScreen, ProfileScreen, MintScreen } from './src/screens';

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

type Tab = 'home' | 'profile';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'home', icon: '\u{1F3E0}', label: 'Home' },
  { key: 'profile', icon: '\u{1F464}', label: 'Profile' },
];

function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
  return (
    <View
      className="flex-row bg-white/90 border-t border-violet-100 pb-6 pt-2"
      style={{
        shadowColor: '#c084fc',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
            className="flex-1 items-center py-2"
          >
            <View className={`px-5 py-1 rounded-full mb-1 ${isActive ? 'bg-violet-100' : ''}`}>
              <Text className={`text-xl ${!isActive ? 'opacity-40' : ''}`}>
                {tab.icon}
              </Text>
            </View>
            <Text className={`text-xs font-semibold ${isActive ? 'text-violet-600' : 'text-neutral-400'}`}>
              {tab.label}
            </Text>
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

  useEffect(() => {
    hydratePetStore().finally(() => setHydrated(true));
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'profile':
        return <ProfileScreen />;
    }
  };

  if (!hydrated) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-violet-50 items-center justify-center" edges={['top']}>
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
          <SafeAreaView className="flex-1 bg-violet-50" edges={['top']}>
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
          <SafeAreaView className="flex-1 bg-violet-50" edges={['top']}>
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
        <SafeAreaView className="flex-1 bg-violet-50" edges={['top']}>
          {renderScreen()}
          <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
