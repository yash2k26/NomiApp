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
  { key: 'home', icon: '\u{1F3E0}', label: 'HOME' },
  { key: 'profile', icon: '\u{1F464}', label: 'ME' },
];

function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
  return (
    <View
      className="flex-row bg-white rounded-t-[34px] pb-8 pt-3 border-t border-pet-blue-light/40"
      style={{
        shadowColor: '#22314A',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 12,
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
            <View className={`px-7 py-2 rounded-[20px] mb-1 ${isActive ? 'bg-pet-blue/20 border border-pet-blue-light' : ''}`}>
              <Text className={`text-[23px] ${!isActive ? 'opacity-35' : ''}`}>
                {tab.icon}
              </Text>
            </View>
            <Text className={`text-[10px] font-bold uppercase tracking-[0.8px] ${isActive ? 'text-pet-blue-dark' : 'text-gray-300'}`}>
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
