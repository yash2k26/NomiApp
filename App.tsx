import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, LogBox } from 'react-native';
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

// Also suppress console.log for these messages
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
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
  return (
    <View className="flex-row bg-black border-t border-neutral-800 pb-6 pt-2">
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onTabPress(tab.key)}
          activeOpacity={0.7}
          className="flex-1 items-center py-2"
        >
          <Text className={`text-2xl mb-1 ${activeTab !== tab.key ? 'opacity-40' : ''}`}>
            {tab.icon}
          </Text>
          <Text className={`text-xs font-medium ${activeTab === tab.key ? 'text-white' : 'text-neutral-500'}`}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [hydrated, setHydrated] = useState(false);
  const connected = useWalletStore((s) => s.connected);
  const hasPet = usePetStore((s) => s.hasPet);

  // Hydrate persisted pet state from AsyncStorage on launch
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
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-neutral-900 items-center justify-center" edges={['top']}>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!connected) {
    return (
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-neutral-900" edges={['top']}>
          <WalletConnect />
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!hasPet) {
    return (
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-neutral-900" edges={['top']}>
          <MintScreen />
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-neutral-900" edges={['top']}>
        {renderScreen()}
        <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
