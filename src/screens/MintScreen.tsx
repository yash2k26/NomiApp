import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';

export function MintScreen() {
  const balance = useWalletStore((s) => s.balance);
  const mintPet = usePetStore((s) => s.mintPet);
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = async () => {
    setIsMinting(true);
    await new Promise((r) => setTimeout(r, 1500));
    mintPet();
    setIsMinting(false);
  };

  return (
    <View className="flex-1 px-6 justify-center items-center bg-neutral-900">
      {/* Pet Preview */}
      <View className="w-36 h-36 bg-violet-500/20 rounded-full items-center justify-center mb-6">
        <Text className="text-7xl">🐾</Text>
      </View>
      
      <Text className="text-3xl font-bold text-white mb-2">Meet Nomi</Text>
      <Text className="text-base text-neutral-400 mb-8">Your companion awaits</Text>

      {/* Info Card */}
      <View className="w-full bg-neutral-800 rounded-2xl p-5 mb-6">
        <View className="flex-row justify-between py-3 border-b border-neutral-700">
          <Text className="text-base text-neutral-400">Type</Text>
          <Text className="text-base font-semibold text-white">Companion NFT</Text>
        </View>
        <View className="flex-row justify-between py-3 border-b border-neutral-700">
          <Text className="text-base text-neutral-400">Network</Text>
          <Text className="text-base font-semibold text-violet-400">Solana (Devnet)</Text>
        </View>
        <View className="flex-row justify-between py-3 border-b border-neutral-700">
          <Text className="text-base text-neutral-400">Mint Cost</Text>
          <Text className="text-lg font-bold text-emerald-400">0.01 SOL</Text>
        </View>
        <View className="flex-row justify-between py-3">
          <Text className="text-base text-neutral-400">Your Balance</Text>
          <Text className="text-base font-semibold text-white">{balance.toFixed(2)} SOL</Text>
        </View>
      </View>

      {/* Features */}
      <View className="w-full mb-8">
        <View className="flex-row items-center mb-3">
          <Text className="text-lg mr-3">💚</Text>
          <Text className="text-sm text-neutral-300">Care for your companion daily</Text>
        </View>
        <View className="flex-row items-center mb-3">
          <Text className="text-lg mr-3">🪞</Text>
          <Text className="text-sm text-neutral-300">Reflect and grow together</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-lg mr-3">🎨</Text>
          <Text className="text-sm text-neutral-300">Customize with NFT skins</Text>
        </View>
      </View>

      {/* Mint Button */}
      <TouchableOpacity
        onPress={handleMint}
        disabled={isMinting}
        activeOpacity={0.8}
        className={`w-full bg-violet-500 py-4 rounded-2xl items-center ${isMinting ? 'opacity-70' : ''}`}
      >
        {isMinting ? (
          <View className="flex-row items-center">
            <ActivityIndicator color="#FFF" size="small" />
            <Text className="text-white text-lg font-bold ml-2">Minting...</Text>
          </View>
        ) : (
          <Text className="text-white text-lg font-bold">Mint Nomi NFT</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
