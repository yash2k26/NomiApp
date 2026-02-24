import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';

interface InfoCardProps {
  title: string;
  icon: string;
  color: string;
  children: React.ReactNode;
}

function InfoCard({ title, icon, color, children }: InfoCardProps) {
  return (
    <View
      className="bg-white rounded-4xl p-6 mb-5 border-2 border-gray-50 shadow-lg"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View className="flex-row items-center mb-5">
        <View className={`w-10 h-10 rounded-2xl ${color} items-center justify-center mr-3.5 border-b-4 border-black/10`}>
          <Text className="text-lg">{icon}</Text>
        </View>
        <Text className="text-sm font-black text-gray-400 tracking-widest uppercase">{title}</Text>
      </View>
      {children}
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
    <View className="flex-row justify-between py-4 border-b border-gray-50 last:border-b-0">
      <Text className="text-sm font-bold text-gray-400">{label}</Text>
      <Text className={`text-sm font-black ${valueColor}`}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { address, balance, disconnectWallet } = useWalletStore();
  const { name, mintAddress, skin, clearPet } = usePetStore();

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
  const shortMintAddress = mintAddress ? `${mintAddress.slice(0, 6)}...${mintAddress.slice(-4)}` : 'N/A';

  const handleDisconnect = () => {
    clearPet();
    disconnectWallet();
  };

  const skinDisplayName = skin === 'default' ? 'Default' : skin.charAt(0).toUpperCase() + skin.slice(1);

  return (
    <View className="flex-1 bg-pet-background">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center mb-8">
          <View
            className="w-24 h-24 bg-pet-blue rounded-[32px] items-center justify-center mb-4 border-b-[8px] border-pet-blue-dark"
            style={{
              shadowColor: '#4FB0C6',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <Text className="text-5xl">{'\u{1F464}'}</Text>
          </View>
          <Text className="text-2xl font-black text-gray-800 uppercase tracking-widest">My Profile</Text>
        </View>

        {/* Wallet Info */}
        <InfoCard title="Wallet" icon={'\u{1F4B0}'} color="bg-pet-green">
          <InfoRow label="Address" value={shortAddress} />
          <InfoRow label="Balance" value={`${balance.toFixed(2)} SOL`} valueColor="text-pet-green-dark" />
          <InfoRow label="Network" value="Devnet" valueColor="text-pet-blue" />
        </InfoCard>

        {/* Pet Info */}
        <InfoCard title="Companion" icon={'\u{1F43E}'} color="bg-pet-pink">
          <InfoRow label="Name" value={name} />
          <InfoRow label="NFT Mint" value={shortMintAddress} />
          <InfoRow label="Outfit" value={skinDisplayName} valueColor="text-pet-purple" />
        </InfoCard>

        {/* App Info */}
        <InfoCard title="Oracle Pet" icon={'\u{2699}'} color="bg-pet-purple">
          <InfoRow label="Version" value="2.0.0 (Revamp)" />
          <InfoRow label="Build" value="Playful" valueColor="text-pet-yellow-dark" />
        </InfoCard>

        {/* Disconnect Button */}
        <TouchableOpacity
          onPress={handleDisconnect}
          activeOpacity={0.9}
        >
          <View
            className="bg-white py-5 rounded-4xl mb-10 border-2 border-pet-pink border-b-[6px] border-pet-pink-dark"
            style={{
              shadowColor: '#FF8FAB',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Text className="text-center text-pet-pink-dark font-black text-base uppercase tracking-widest">Disconnect Wallet</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

