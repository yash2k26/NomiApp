import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { useAdventureStore, EVOLUTION_STAGES } from '../store/adventureStore';
import { XpBar } from '../components/XpBar';
import { AchievementBadge } from '../components/AchievementBadge';
import { ScreenHeader } from '../components/ui/ScreenHeader';

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

function ProgressCard() {
  const { level, totalXp, achievements } = useXpStore();
  const title = getTitleForLevel(level);
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{
        shadowColor: '#9381FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View className="bg-pet-purple px-5 py-3 flex-row items-center">
        <Text className="text-base mr-2">{'\u{2B50}'}</Text>
        <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Progress</Text>
        <View className="bg-white/20 px-2 py-0.5 rounded-full ml-auto">
          <Text className="text-white text-[10px] font-bold">{unlockedCount}/{achievements.length}</Text>
        </View>
      </View>

      <View className="px-2 pt-2">
        <XpBar />
      </View>

      <View className="flex-row justify-between px-5 pb-3">
        <View className="items-center">
          <Text className="text-[18px] font-black text-gray-800">{totalXp}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Total XP</Text>
        </View>
        <View className="items-center">
          <Text className="text-[18px] font-black text-pet-purple">{title}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Title</Text>
        </View>
        <View className="items-center">
          <Text className="text-[18px] font-black text-gray-800">{unlockedCount}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Badges</Text>
        </View>
      </View>

      {/* Achievement Grid */}
      <View className="px-4 pb-4">
        <Text className="text-[11px] font-black text-gray-500 uppercase tracking-[0.6px] mb-2 px-1">Achievements</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {achievements.map(a => (
            <View key={a.id} style={{ width: '23%' }}>
              <AchievementBadge achievement={a} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function EvolutionCard() {
  const { evolutionStage, evolutionShards, canEvolve, evolve } = useAdventureStore();
  const level = useXpStore((s) => s.level);
  const currentStage = EVOLUTION_STAGES[evolutionStage - 1];
  const nextStage = evolutionStage < 5 ? EVOLUTION_STAGES[evolutionStage] : null;
  const canDoEvolve = canEvolve(level);

  const handleEvolve = () => {
    if (!canDoEvolve) return;
    evolve();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{ shadowColor: '#FFD700', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 }}
    >
      <LinearGradient
        colors={['#FFD700', '#FFC107']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{'\u{1F48E}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Evolution</Text>
        </View>
        <View className="bg-white/30 px-2 py-0.5 rounded-full">
          <Text className="text-white text-[10px] font-bold">Stage {evolutionStage}/5</Text>
        </View>
      </LinearGradient>

      <View className="px-5 py-4">
        {/* Current stage */}
        <View className="items-center mb-4">
          <Text className="text-[32px] mb-1">{currentStage?.stage === 1 ? '\u{1F423}' : currentStage?.stage === 2 ? '\u{1F431}' : currentStage?.stage === 3 ? '\u{1F981}' : currentStage?.stage === 4 ? '\u{1F409}' : '\u{1F451}'}</Text>
          <Text className="text-[18px] font-black text-gray-800">{currentStage?.name}</Text>
          <Text className="text-[12px] text-gray-500 font-semibold">Scale: {currentStage?.scale}x</Text>
        </View>

        {/* Evolution progress */}
        {nextStage && (
          <View className="bg-pet-gold-light/20 rounded-2xl p-4 mb-3">
            <Text className="text-[12px] font-black text-gray-700 mb-2">Next: {nextStage.name}</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-[11px] text-gray-500 font-semibold">Level {level}/{nextStage.levelRequired}</Text>
              <Text className="text-[11px] text-gray-500 font-semibold">{'\u{1F48E}'} {evolutionShards}/{nextStage.shardsRequired} Shards</Text>
            </View>
            <View className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <View
                className="h-full rounded-full bg-pet-gold"
                style={{ width: `${Math.min(100, (evolutionShards / nextStage.shardsRequired) * 100)}%` }}
              />
            </View>
          </View>
        )}

        {/* Evolve button */}
        {canDoEvolve && (
          <TouchableOpacity onPress={handleEvolve} activeOpacity={0.85}>
            <LinearGradient colors={['#FFD700', '#CCA800']} className="py-3 rounded-2xl items-center">
              <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px]">
                {'\u2728'} Evolve Now!
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Shard sources */}
        <Text className="text-[10px] text-gray-400 font-semibold text-center mt-3">
          Earn shards from adventures, login rewards, and the lucky wheel
        </Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { address, balance, disconnectWallet, refreshBalance } = useWalletStore();
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
      <View className="absolute top-52 -left-10 w-44 h-44 rounded-full bg-pet-purple-light/20" />
      <View className="absolute top-[520px] -right-12 w-48 h-48 rounded-full bg-pet-pink-light/25" />

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Player Card"
          title="Profile"
          subtitle="Wallet, title progress, and companion identity."
          badge="All synced · v2"
          rightSlot={(
            <View className="w-14 h-14 rounded-2xl bg-white/20 border border-white/40 items-center justify-center">
              <Text className="text-2xl">{'\u{1F984}'}</Text>
            </View>
          )}
        />

        <ProgressCard />

        <EvolutionCard />

        <View className="mt-1" />

        <InfoCard title="Wallet" icon={'\u{1F4B0}'} accent="bg-pet-blue-dark">
          <InfoRow label="Address" value={shortAddress} />
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Balance</Text>
            <View className="flex-row items-center">
              <Text className="text-[12px] font-black text-pet-blue-dark mr-2">{balance.toFixed(4)} SOL</Text>
              <TouchableOpacity onPress={refreshBalance} activeOpacity={0.7}>
                <MaterialCommunityIcons name="refresh" size={14} color="#3792A6" />
              </TouchableOpacity>
            </View>
          </View>
          <InfoRow label="Network" value="Solana Devnet" valueColor="text-pet-blue-dark" />
        </InfoCard>

        <InfoCard title="Companion" icon={'\u{1F43E}'} accent="bg-pet-blue">
          <InfoRow label="Name" value={name} />
          <InfoRow label="NFT Mint" value={shortMintAddress} />
          <InfoRow label="Outfit" value={skinDisplayName} valueColor="text-pet-blue" />
          <InfoRow label="Streak" value={`${streakDays} day${streakDays === 1 ? '' : 's'}`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Adventures" value={`${useAdventureStore.getState().completedAdventures} completed`} valueColor="text-pet-orange-dark" />
          <InfoRow label="Mini-Games" value={`${useAdventureStore.getState().miniGamesWon} won`} valueColor="text-pet-purple" />
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
