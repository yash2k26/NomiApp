import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
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
    <View className="flex-1 px-6 justify-center items-center bg-neutral-900">
      {/* Logo */}
      <View className="w-28 h-28 bg-neutral-800 rounded-3xl items-center justify-center mb-8">
        <Text className="text-6xl">🐾</Text>
      </View>
      
      {/* Title */}
      <Text className="text-4xl font-bold text-white mb-2">Nomi</Text>
      <Text className="text-base text-neutral-400 mb-2">Your Companion on Solana</Text>
      
      {/* Dev badge */}
      <View className="bg-emerald-500/20 px-3 py-1 rounded-lg mb-10">
        <Text className="text-xs font-bold text-emerald-500 tracking-wider">DEV MODE</Text>
      </View>

      {/* Features */}
      <View className="w-full bg-neutral-800/50 rounded-2xl p-5 mb-8">
        <View className="flex-row items-center mb-4">
          <Text className="text-xl mr-3">💚</Text>
          <View>
            <Text className="text-sm font-semibold text-white">Care for your companion</Text>
            <Text className="text-xs text-neutral-400">Feed, play, and rest together</Text>
          </View>
        </View>
        <View className="flex-row items-center mb-4">
          <Text className="text-xl mr-3">🪞</Text>
          <View>
            <Text className="text-sm font-semibold text-white">Daily reflection</Text>
            <Text className="text-xs text-neutral-400">Share your day with your pet</Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <Text className="text-xl mr-3">🔐</Text>
          <View>
            <Text className="text-sm font-semibold text-white">True ownership</Text>
            <Text className="text-xs text-neutral-400">Your pet is an NFT on Solana</Text>
          </View>
        </View>
      </View>

      {/* Connect button */}
      <TouchableOpacity
        onPress={handleConnect}
        disabled={isConnecting}
        activeOpacity={0.8}
        className={`w-full bg-violet-500 py-4 rounded-2xl items-center ${isConnecting ? 'opacity-70' : ''}`}
      >
        {isConnecting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text className="text-white text-lg font-bold">Connect Wallet</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
