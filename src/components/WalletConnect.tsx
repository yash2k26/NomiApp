import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
        colors={['#EAF7FF', '#DFF0FF', '#F1F9FF']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-pet-blue-light/45" />
      <View className="absolute top-56 -left-12 w-48 h-48 rounded-full bg-pet-blue-light/30" />

      <View className="flex-1 px-6 justify-center items-center">
        <View
          className="w-28 h-28 bg-white rounded-[28px] items-center justify-center mb-7 border border-pet-blue-light/40"
          style={{
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Text className="text-6xl">{'\u{1F43E}'}</Text>
        </View>

        <Text className="text-[40px] leading-[42px] font-black text-gray-800">Nomi</Text>
        <Text className="text-[14px] text-gray-500 font-semibold mt-1 mb-2">A tiny companion, always on chain.</Text>

        <View className="bg-pet-blue-light/25 border border-pet-blue/30 px-3 py-1.5 rounded-full mb-8">
          <Text className="text-[10px] font-black text-pet-blue-dark tracking-[0.8px] uppercase">Solana Devnet</Text>
        </View>

        <View
          className="w-full bg-white rounded-[28px] p-5 mb-8 border border-gray-100"
          style={{
            shadowColor: '#22314A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.07,
            shadowRadius: 14,
            elevation: 4,
          }}
        >
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons name="heart-pulse" size={18} color="#3792A6" />
            <View className="ml-2.5">
              <Text className="text-[13px] font-bold text-gray-800">Care loop gameplay</Text>
              <Text className="text-[11px] text-gray-500">Feed, play, rest and keep stats balanced.</Text>
            </View>
          </View>
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons name="account-voice" size={18} color="#4FB0C6" />
            <View className="ml-2.5">
              <Text className="text-[13px] font-bold text-gray-800">Reflective companion</Text>
              <Text className="text-[11px] text-gray-500">Your responses help shape mood and growth.</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="shield-check" size={18} color="#3792A6" />
            <View className="ml-2.5">
              <Text className="text-[13px] font-bold text-gray-800">Wallet-owned pet NFT</Text>
              <Text className="text-[11px] text-gray-500">Truly yours across sessions and devices.</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleConnect} disabled={isConnecting} activeOpacity={0.9} className="w-full">
          <LinearGradient
            colors={['#3792A6', '#4FB0C6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-4 rounded-2xl items-center"
            style={{
              opacity: isConnecting ? 0.75 : 1,
              shadowColor: '#3792A6',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {isConnecting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#FFF" size="small" />
                <Text className="text-white text-[16px] font-black ml-2">Connecting...</Text>
              </View>
            ) : (
              <Text className="text-white text-[16px] font-black tracking-[0.6px] uppercase">Connect Wallet</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
