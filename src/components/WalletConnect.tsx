import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalletStore } from '../store/walletStore';

export function WalletConnect() {
  const { connectWallet } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    await connectWallet();
    setIsConnecting(false);
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#f0e6ff', '#fce7f3', '#fef3c7', '#e0f2fe']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="flex-1 px-6 justify-center items-center">
        {/* Logo */}
        <View
          className="w-28 h-28 bg-white rounded-3xl items-center justify-center mb-8"
          style={{
            shadowColor: '#c084fc',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Text className="text-6xl">{'\u{1F43E}'}</Text>
        </View>

        {/* Title */}
        <Text className="text-4xl font-bold text-violet-900 mb-2">Nomi</Text>
        <Text className="text-base text-violet-400 mb-2">Your Companion on Solana</Text>

        {/* Dev badge */}
        <View className="bg-emerald-100 px-3 py-1 rounded-lg mb-10">
          <Text className="text-xs font-bold text-emerald-600 tracking-wider">DEV MODE</Text>
        </View>

        {/* Features */}
        <View
          className="w-full bg-white/70 rounded-2xl p-5 mb-8"
          style={{
            shadowColor: '#c084fc',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View className="flex-row items-center mb-4">
            <Text className="text-xl mr-3">{'\u{1F49A}'}</Text>
            <View>
              <Text className="text-sm font-semibold text-neutral-800">Care for your companion</Text>
              <Text className="text-xs text-neutral-400">Feed, play, and rest together</Text>
            </View>
          </View>
          <View className="flex-row items-center mb-4">
            <Text className="text-xl mr-3">{'\u{1FA9E}'}</Text>
            <View>
              <Text className="text-sm font-semibold text-neutral-800">Daily reflection</Text>
              <Text className="text-xs text-neutral-400">Share your day with your pet</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <Text className="text-xl mr-3">{'\u{1F510}'}</Text>
            <View>
              <Text className="text-sm font-semibold text-neutral-800">True ownership</Text>
              <Text className="text-xs text-neutral-400">Your pet is an NFT on Solana</Text>
            </View>
          </View>
        </View>

        {/* Connect button */}
        <TouchableOpacity
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.8}
          className="w-full"
        >
          <LinearGradient
            colors={['#8b5cf6', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 rounded-2xl items-center"
            style={{
              opacity: isConnecting ? 0.7 : 1,
              shadowColor: '#8b5cf6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {isConnecting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="text-white text-lg font-bold">Connect Wallet</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
