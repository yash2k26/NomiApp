import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWalletStore } from '../store/walletStore';
import { ScreenHeader } from './ui/ScreenHeader';

export function WalletConnect() {
  const { connectWallet, isConnecting, error } = useWalletStore();

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#E7F6FF', '#D7EEFF', '#EAF8FF']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      <View className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-pet-blue-light/45" />
      <View className="absolute top-56 -left-12 w-48 h-48 rounded-full bg-pet-blue-light/30" />

      <View className="flex-1 px-6 pt-6 pb-8">
        <ScreenHeader
          eyebrow="Welcome"
          title="Nomi"
          subtitle="Connect your wallet to start your companion journey."
          badge="Solana Devnet · v2"
          rightSlot={(
            <View className="w-12 h-12 rounded-2xl bg-white/20 border border-white/40 items-center justify-center">
              <Text className="text-2xl">{'\u{1F43E}'}</Text>
            </View>
          )}
        />

        <View className="flex-1 justify-center">
          <View
            className="w-full bg-white rounded-[28px] p-5 border border-gray-100"
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
              <View className="ml-2.5 flex-1">
                <Text className="text-[13px] font-bold text-gray-800">Care loop gameplay</Text>
                <Text className="text-[11px] text-gray-500">Feed, play, rest and keep stats balanced.</Text>
              </View>
            </View>
            <View className="flex-row items-center mb-4">
              <MaterialCommunityIcons name="account-voice" size={18} color="#4FB0C6" />
              <View className="ml-2.5 flex-1">
                <Text className="text-[13px] font-bold text-gray-800">Reflective companion</Text>
                <Text className="text-[11px] text-gray-500">Your responses shape mood and growth.</Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="shield-check" size={18} color="#3792A6" />
              <View className="ml-2.5 flex-1">
                <Text className="text-[13px] font-bold text-gray-800">Wallet-owned pet NFT</Text>
                <Text className="text-[11px] text-gray-500">Progress stays with your wallet.</Text>
              </View>
            </View>
          </View>

          {!!error && (
            <View className="w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mt-4">
              <Text className="text-[12px] text-red-600 font-semibold text-center">{error}</Text>
              {error.includes('No Solana wallet') && (
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://phantom.app/download')}
                  className="mt-2"
                >
                  <Text className="text-[11px] text-pet-blue-dark font-bold text-center underline">
                    Get Phantom Wallet
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity onPress={connectWallet} disabled={isConnecting} activeOpacity={0.9} className="w-full">
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


