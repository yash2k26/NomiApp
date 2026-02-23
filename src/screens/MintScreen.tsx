import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
    <View className="flex-1">
      <LinearGradient
        colors={['#f0e6ff', '#fce7f3', '#fef3c7', '#e0f2fe']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="flex-1 px-6 justify-center items-center">
        {/* Pet Preview */}
        <View
          className="w-36 h-36 bg-violet-100 rounded-full items-center justify-center mb-6"
          style={{
            shadowColor: '#c084fc',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Text className="text-7xl">{'\u{1F43E}'}</Text>
        </View>

        <Text className="text-3xl font-bold text-violet-900 mb-2">Meet Nomi</Text>
        <Text className="text-base text-violet-400 mb-8">Your companion awaits</Text>

        {/* Info Card */}
        <View
          className="w-full bg-white/80 rounded-2xl p-5 mb-6"
          style={{
            shadowColor: '#c084fc',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <View className="flex-row justify-between py-3 border-b border-violet-100">
            <Text className="text-base text-neutral-400">Type</Text>
            <Text className="text-base font-semibold text-neutral-800">Companion NFT</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-violet-100">
            <Text className="text-base text-neutral-400">Network</Text>
            <Text className="text-base font-semibold text-violet-500">Solana (Devnet)</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-violet-100">
            <Text className="text-base text-neutral-400">Mint Cost</Text>
            <Text className="text-lg font-bold text-emerald-500">0.01 SOL</Text>
          </View>
          <View className="flex-row justify-between py-3">
            <Text className="text-base text-neutral-400">Your Balance</Text>
            <Text className="text-base font-semibold text-neutral-800">{balance.toFixed(2)} SOL</Text>
          </View>
        </View>

        {/* Features */}
        <View className="w-full mb-8">
          <View className="flex-row items-center mb-3">
            <Text className="text-lg mr-3">{'\u{1F49A}'}</Text>
            <Text className="text-sm text-neutral-600">Care for your companion daily</Text>
          </View>
          <View className="flex-row items-center mb-3">
            <Text className="text-lg mr-3">{'\u{1FA9E}'}</Text>
            <Text className="text-sm text-neutral-600">Reflect and grow together</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-lg mr-3">{'\u{1F3A8}'}</Text>
            <Text className="text-sm text-neutral-600">Customize with NFT skins</Text>
          </View>
        </View>

        {/* Mint Button */}
        <TouchableOpacity
          onPress={handleMint}
          disabled={isMinting}
          activeOpacity={0.8}
          className="w-full"
        >
          <LinearGradient
            colors={['#8b5cf6', '#a78bfa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 rounded-2xl items-center"
            style={{
              opacity: isMinting ? 0.7 : 1,
              shadowColor: '#8b5cf6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {isMinting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#FFF" size="small" />
                <Text className="text-white text-lg font-bold ml-2">Minting...</Text>
              </View>
            ) : (
              <Text className="text-white text-lg font-bold">Mint Nomi NFT</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
