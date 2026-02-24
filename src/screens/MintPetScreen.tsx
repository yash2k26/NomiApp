import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useWalletStore } from '@/store/walletStore';
import { usePetStore } from '@/store/petStore';

const MINT_COST = 0.01;

export function MintPetScreen() {
  const { address, balance } = useWalletStore();
  const { mintPet } = usePetStore();
  const [isMinting, setIsMinting] = useState(false);

  const canMint = balance >= MINT_COST && !isMinting;

  const handleMint = async () => {
    if (!address || !canMint) return;
    setIsMinting(true);
    // Simulate network delay for minting
    setTimeout(() => {
      mintPet();
      setIsMinting(false);
    }, 2000);
  };

  return (
    <View className="flex-1 bg-pet-background justify-center px-6">
      <View className="items-center mb-10">
        <View
          className="w-40 h-40 bg-pet-yellow-light/30 rounded-[60px] items-center justify-center mb-6 border-b-[10px] border-pet-yellow/20"
          style={{
            shadowColor: '#FFD93D',
            shadowOffset: { width: 0, height: 15 },
            shadowOpacity: 0.15,
            shadowRadius: 25,
            elevation: 10,
          }}
        >
          <View className="absolute inset-0 bg-white/40 rounded-[60px]" />
          <Text className="text-7xl">🐾</Text>
        </View>
        <Text className="text-4xl font-black text-gray-800 tracking-tighter uppercase mb-2">Meet Nomi</Text>
        <Text className="text-base font-bold text-gray-400">Your companion awaits!</Text>
      </View>

      <View className="bg-white rounded-5xl p-8 mb-8 border-2 border-gray-50 shadow-xl" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 6,
      }}>
        <View className="flex-row justify-between items-center py-4 border-b border-gray-50">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest">Name</Text>
          <Text className="text-base font-black text-gray-800">Nomi</Text>
        </View>
        <View className="flex-row justify-between items-center py-4 border-b border-gray-50">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest">Type</Text>
          <Text className="text-base font-black text-gray-800">Companion</Text>
        </View>
        <View className="flex-row justify-between items-center py-4 border-b border-gray-50">
          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest">Network</Text>
          <Text className="text-base font-black text-pet-green-dark">Solana</Text>
        </View>

        <View className="mt-4 pt-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mint Cost</Text>
            <Text className="text-xl font-black text-pet-blue">{MINT_COST} SOL</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Balance</Text>
            <Text className={`text-sm font-black ${balance < MINT_COST ? 'text-pet-pink' : 'text-gray-500'}`}>
              {balance.toFixed(2)} SOL
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleMint}
        disabled={!canMint}
        activeOpacity={0.9}
      >
        <View className={`h-16 rounded-3xl items-center justify-center border-b-[6px] ${!canMint ? 'bg-gray-100 border-gray-200' : 'bg-pet-yellow border-pet-yellow-dark'}`}>
          {isMinting ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="#FFF" className="mr-3" />
              <Text className="text-white text-lg font-black uppercase tracking-widest">Minting...</Text>
            </View>
          ) : (
            <Text className={`text-lg font-black uppercase tracking-widest ${!canMint ? 'text-gray-300' : 'text-white'}`}>Mint Nomi NFT</Text>
          )}
        </View>
      </TouchableOpacity>

      {!canMint && !isMinting && balance < MINT_COST && (
        <Text className="text-center text-pet-pink text-[10px] font-black uppercase tracking-widest mt-4">Insufficient Balance</Text>
      )}
    </View>
  );
}

