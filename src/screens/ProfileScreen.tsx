import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

function InfoCard({ title, children }: InfoCardProps) {
  return (
    <View
      className="bg-white/80 rounded-2xl p-4 mb-4"
      style={{
        shadowColor: '#c084fc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text className="text-xs font-semibold text-violet-400 tracking-wider mb-3">{title}</Text>
      {children}
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ label, value, valueColor = 'text-neutral-800' }: InfoRowProps) {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-violet-100 last:border-b-0">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className={`text-sm font-semibold ${valueColor}`}>{value}</Text>
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
    <View className="flex-1">
      <LinearGradient
        colors={['#f0e6ff', '#fce7f3', '#fef3c7', '#e0f2fe']}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <ScrollView className="flex-1 px-5 pt-4">
        {/* Header */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 bg-white rounded-full items-center justify-center mb-3"
            style={{
              shadowColor: '#c084fc',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-4xl">{'\u{1F464}'}</Text>
          </View>
          <Text className="text-xl font-bold text-violet-900">Profile</Text>
        </View>

        {/* Wallet Info */}
        <InfoCard title="WALLET">
          <InfoRow label="Address" value={shortAddress} />
          <InfoRow label="Balance" value={`${balance.toFixed(2)} SOL`} valueColor="text-emerald-500" />
          <InfoRow label="Network" value="Devnet" valueColor="text-violet-500" />
        </InfoCard>

        {/* Pet Info */}
        <InfoCard title="COMPANION">
          <InfoRow label="Name" value={name} />
          <InfoRow label="NFT Mint" value={shortMintAddress} />
          <InfoRow label="Skin Equipped" value={skinDisplayName} valueColor="text-violet-500" />
        </InfoCard>

        {/* App Info */}
        <InfoCard title="APP">
          <InfoRow label="Version" value="1.0.0 (MVP)" />
          <InfoRow label="Build" value="Development" valueColor="text-amber-500" />
        </InfoCard>

        {/* Disconnect Button */}
        <TouchableOpacity
          onPress={handleDisconnect}
          activeOpacity={0.8}
          className="bg-red-50 border border-red-200 py-4 rounded-2xl mb-8"
        >
          <Text className="text-center text-red-500 font-semibold text-base">Disconnect Wallet</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
