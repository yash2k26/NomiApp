import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';

interface InfoCardProps {
  title: string;
  icon: string;
  accent: string;
  children: React.ReactNode;
}

function InfoCard({ title, icon, accent, children }: InfoCardProps) {
  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{
        shadowColor: '#1F2E45',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View className={`${accent} px-5 py-3 flex-row items-center`}>
        <Text className="text-base mr-2">{icon}</Text>
        <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">{title}</Text>
      </View>
      <View className="px-5 py-2">{children}</View>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ label, value, valueColor = 'text-gray-800' }: InfoRowProps) {
  return (
    <View className="flex-row justify-between py-3.5 border-b border-gray-100 last:border-b-0">
      <Text className="text-[12px] font-semibold text-gray-500">{label}</Text>
      <Text className={`text-[12px] font-black ${valueColor}`}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { address, balance, disconnectWallet } = useWalletStore();
  const { name, mintAddress, skin, clearPet, streakDays } = usePetStore();

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
  const shortMintAddress = mintAddress ? `${mintAddress.slice(0, 6)}...${mintAddress.slice(-4)}` : 'N/A';

  const handleDisconnect = () => {
    clearPet();
    disconnectWallet();
  };

  const skinDisplayName = skin === 'default' ? 'Default' : skin.charAt(0).toUpperCase() + skin.slice(1);

  return (
    <View className="flex-1 bg-pet-background">
      <View className="absolute -top-6 -right-8 w-36 h-36 rounded-full bg-pet-blue-light/30" />
      <View className="absolute top-60 -left-8 w-40 h-40 rounded-full bg-pet-blue-light/20" />

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="items-center mb-7">
          <View
            className="w-24 h-24 bg-white rounded-[30px] items-center justify-center mb-3 border border-pet-blue-light/50"
            style={{
              shadowColor: '#4FB0C6',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.16,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <Text className="text-5xl">{'\u{1F464}'}</Text>
          </View>
          <Text className="text-[30px] font-black text-gray-800">Profile</Text>
          <Text className="text-[13px] text-gray-500 font-semibold">Everything about your wallet and companion.</Text>
        </View>

        <InfoCard title="Wallet" icon={'\u{1F4B0}'} accent="bg-pet-blue-dark">
          <InfoRow label="Address" value={shortAddress} />
          <InfoRow label="Balance" value={`${balance.toFixed(2)} SOL`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Network" value="Solana Devnet" valueColor="text-pet-blue-dark" />
        </InfoCard>

        <InfoCard title="Companion" icon={'\u{1F43E}'} accent="bg-pet-blue">
          <InfoRow label="Name" value={name} />
          <InfoRow label="NFT Mint" value={shortMintAddress} />
          <InfoRow label="Outfit" value={skinDisplayName} valueColor="text-pet-blue" />
          <InfoRow label="Streak" value={`${streakDays} day${streakDays === 1 ? '' : 's'}`} valueColor="text-pet-blue-dark" />
        </InfoCard>

        <InfoCard title="App" icon={'\u2699'} accent="bg-pet-blue-dark">
          <InfoRow label="Version" value="2.1.0" />
          <InfoRow label="Build" value="Design Refresh" valueColor="text-pet-blue-dark" />
        </InfoCard>

        <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.9}>
          <View
            className="py-4 rounded-2xl mb-10 border border-pet-blue-dark/30 bg-white flex-row items-center justify-center"
            style={{
              shadowColor: '#4FB0C6',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="logout" size={18} color="#3792A6" />
            <Text className="ml-2 text-pet-blue-dark font-black text-[13px] tracking-[0.6px] uppercase">Disconnect Wallet</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
