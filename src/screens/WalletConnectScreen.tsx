import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useWalletStore } from '@/store/walletStore';

export function WalletConnectScreen() {
  const { connectWallet } = useWalletStore();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await connectWallet();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-pet-background justify-center px-6">
      <View className="items-center mb-12">
        <View
          className="w-24 h-24 bg-pet-blue rounded-5xl items-center justify-center mb-6 border-b-[8px] border-pet-blue-dark"
          style={{
            shadowColor: '#4FB0C6',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 15,
            elevation: 10,
          }}
        >
          <Text className="text-5xl">🐾</Text>
        </View>
        <Text className="text-5xl font-black text-gray-800 tracking-tighter uppercase mb-2">Nomi</Text>
        <Text className="text-lg font-bold text-pet-blue-dark/60 tracking-wide">Your Digital Bestie ✨</Text>
      </View>

      <View className="bg-white rounded-5xl p-8 mb-12 border-2 border-gray-50 shadow-xl" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 6,
      }}>
        <Text className="text-2xl font-black text-gray-800 text-center mb-2 uppercase tracking-tight">Welcome!</Text>
        <Text className="text-sm font-bold text-gray-400 text-center mb-8">Connect your wallet to start playing with your new friend!</Text>

        <TouchableOpacity
          onPress={handleConnect}
          disabled={loading}
          activeOpacity={0.9}
        >
          <View className={`h-16 rounded-3xl items-center justify-center border-b-[6px] ${loading ? 'bg-gray-200 border-gray-300' : 'bg-pet-blue border-pet-blue-dark'}`}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="text-white text-lg font-black uppercase tracking-widest">Connect Wallet</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>


      <View className="flex-row justify-around">
        <View className="items-center">
          <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mb-2 shadow-sm border border-gray-50">
            <Text className="text-2xl">🎮</Text>
          </View>
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Care</Text>
        </View>
        <View className="items-center">
          <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mb-2 shadow-sm border border-gray-50">
            <Text className="text-2xl">👕</Text>
          </View>
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Skins</Text>
        </View>
        <View className="items-center">
          <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mb-2 shadow-sm border border-gray-50">
            <Text className="text-2xl">🔐</Text>
          </View>
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">NFT</Text>
        </View>
      </View>
    </View>
  );
}

