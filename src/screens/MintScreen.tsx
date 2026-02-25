import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
        colors={['#EAF7FF', '#DFF0FF', '#F1F9FF']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="absolute top-12 -right-10 w-44 h-44 rounded-full bg-pet-blue-light/35" />
      <View className="absolute top-80 -left-10 w-40 h-40 rounded-full bg-pet-blue-light/35" />

      <View className="flex-1 px-6 justify-center items-center">
        <View
          className="w-36 h-36 bg-white rounded-[36px] items-center justify-center mb-6 border border-pet-blue-light/50"
          style={{
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Text className="text-7xl">{'\u{1F43E}'}</Text>
        </View>

        <Text className="text-[36px] leading-[38px] font-black text-gray-800">Mint Your Nomi</Text>
        <Text className="text-[14px] text-gray-500 font-semibold mb-7 mt-1">Start your on-chain companion journey.</Text>

        <View
          className="w-full bg-white rounded-[28px] p-5 mb-7 border border-gray-100"
          style={{
            shadowColor: '#22314A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.07,
            shadowRadius: 14,
            elevation: 4,
          }}
        >
          <View className="flex-row justify-between py-3 border-b border-gray-100">
            <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Type</Text>
            <Text className="text-[13px] font-black text-gray-800">Companion NFT</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-gray-100">
            <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Network</Text>
            <Text className="text-[13px] font-black text-pet-blue-dark">Solana Devnet</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-gray-100">
            <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Mint Cost</Text>
            <Text className="text-[16px] font-black text-pet-blue-dark">0.01 SOL</Text>
          </View>
          <View className="flex-row justify-between py-3">
            <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-gray-500">Your Balance</Text>
            <Text className="text-[13px] font-black text-gray-800">{balance.toFixed(2)} SOL</Text>
          </View>
        </View>

        <View className="w-full mb-7">
          <View className="flex-row items-center mb-2.5">
            <MaterialCommunityIcons name="sparkles" size={16} color="#3792A6" />
            <Text className="ml-2 text-[12px] text-gray-600 font-medium">Daily care and mood-driven model states</Text>
          </View>
          <View className="flex-row items-center mb-2.5">
            <MaterialCommunityIcons name="hanger" size={16} color="#4FB0C6" />
            <Text className="ml-2 text-[12px] text-gray-600 font-medium">Customize Nomi with new blue-themed outfits</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="shield-star" size={16} color="#3792A6" />
            <Text className="ml-2 text-[12px] text-gray-600 font-medium">Wallet-owned pet with persistent progress</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleMint} disabled={isMinting} activeOpacity={0.9} className="w-full">
          <LinearGradient
            colors={['#3792A6', '#4FB0C6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 rounded-2xl items-center"
            style={{
              opacity: isMinting ? 0.75 : 1,
              shadowColor: '#3792A6',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {isMinting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#FFF" size="small" />
                <Text className="text-white text-[16px] font-black ml-2">Minting...</Text>
              </View>
            ) : (
              <Text className="text-white text-[16px] font-black tracking-[0.6px] uppercase">Mint Nomi NFT</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
