import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

function InfoCard({ title, children }: InfoCardProps) {
  return (
    <View className="bg-neutral-800 rounded-2xl p-4 mb-4">
      <Text className="text-xs font-semibold text-neutral-500 tracking-wider mb-3">{title}</Text>
      {children}
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ label, value, valueColor = 'text-white' }: InfoRowProps) {
  return (
    <View className="flex-row justify-between py-2.5 border-b border-neutral-700/50 last:border-b-0">
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
    <ScrollView className="flex-1 bg-neutral-900 px-5 pt-4">
      {/* Header */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 bg-neutral-800 rounded-full items-center justify-center mb-3">
          <Text className="text-4xl">👤</Text>
        </View>
        <Text className="text-xl font-bold text-white">Profile</Text>
      </View>

      {/* Wallet Info */}
      <InfoCard title="WALLET">
        <InfoRow label="Address" value={shortAddress} />
        <InfoRow label="Balance" value={`${balance.toFixed(2)} SOL`} valueColor="text-emerald-400" />
        <InfoRow label="Network" value="Devnet" valueColor="text-violet-400" />
      </InfoCard>

      {/* Pet Info */}
      <InfoCard title="COMPANION">
        <InfoRow label="Name" value={name} />
        <InfoRow label="NFT Mint" value={shortMintAddress} />
        <InfoRow label="Skin Equipped" value={skinDisplayName} valueColor="text-violet-400" />
      </InfoCard>

      {/* App Info */}
      <InfoCard title="APP">
        <InfoRow label="Version" value="1.0.0 (MVP)" />
        <InfoRow label="Build" value="Development" valueColor="text-amber-400" />
      </InfoCard>

      {/* Disconnect Button */}
      <TouchableOpacity
        onPress={handleDisconnect}
        activeOpacity={0.8}
        className="bg-red-500/20 py-4 rounded-2xl mb-8"
      >
        <Text className="text-center text-red-400 font-semibold text-base">Disconnect Wallet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
