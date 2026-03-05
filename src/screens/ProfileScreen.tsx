import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '../store/walletStore';
import { usePetStore } from '../store/petStore';
import { useXpStore, getTitleForLevel } from '../store/xpStore';
import { useAdventureStore, EVOLUTION_STAGES } from '../store/adventureStore';
import { useTxHistoryStore, type LabeledTransaction } from '../store/txHistoryStore';
import { XpBar } from '../components/XpBar';
import { AchievementBadge } from '../components/AchievementBadge';
import { PremiumCard } from '../components/PremiumCard';
import { usePremiumStore } from '../store/premiumStore';
import { TIER_CONFIGS } from '../data/premiumTiers';
import { useShopStore } from '../store/shopStore';
import { useNotificationStore } from '../store/notificationStore';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { requestAirdrop } from '../lib/solanaTransactions';
import { getSolscanTxUrl, getSolscanNftUrl, getSolscanAddressUrl } from '../lib/solanaClient';
import { writeMemo } from '../lib/solanaTransactions';
import { claimTestSkr } from '../lib/skrToken';

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
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-pet-blue-light/70"
      style={{
        shadowColor: '#2D6B90',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View className="bg-pet-blue-dark px-5 py-3 flex-row items-center">
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
          <View className="px-3 py-1 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{totalXp}</Text>
          </View>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Total XP</Text>
        </View>
        <View className="items-center">
          <View className="px-3 py-1 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{title}</Text>
          </View>
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Title</Text>
        </View>
        <View className="items-center">
          <View className="px-3 py-1 rounded-full bg-pet-blue-light/40 border border-pet-blue-light/90">
            <Text className="text-[15px] font-black text-pet-blue-dark">{unlockedCount}</Text>
          </View>
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
      style={{ shadowColor: '#2D6B90', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}
    >
      <LinearGradient
        colors={['#4FABC9', '#6CBAD8']}
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
          <View className="bg-pet-blue-light/30 rounded-2xl p-4 mb-3 border border-pet-blue-light/70">
            <Text className="text-[12px] font-black text-gray-700 mb-2">Next: {nextStage.name}</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-[11px] text-gray-500 font-semibold">Level {level}/{nextStage.levelRequired}</Text>
              <Text className="text-[11px] text-gray-500 font-semibold">{'\u{1F48E}'} {evolutionShards}/{nextStage.shardsRequired} Shards</Text>
            </View>
            <View className="h-2 rounded-full bg-pet-blue-light/50 overflow-hidden">
              <View
                className="h-full rounded-full bg-pet-blue"
                style={{ width: `${Math.min(100, (evolutionShards / nextStage.shardsRequired) * 100)}%` }}
              />
            </View>
          </View>
        )}

        {/* Evolve button */}
        {canDoEvolve && (
          <TouchableOpacity onPress={handleEvolve} activeOpacity={0.85}>
            <LinearGradient colors={['#4FABC9', '#3E8AB3']} className="py-3 rounded-2xl items-center">
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

function TransactionHistoryCard({ address }: { address: string }) {
  const { transactions, isLoading, fetchHistory } = useTxHistoryStore();

  useEffect(() => {
    if (address) {
      fetchHistory(address);
    }
  }, [address, fetchHistory]);

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() / 1000) - ts);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{ shadowColor: '#1F2E45', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4 }}
    >
      <View className="bg-pet-blue px-5 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{'\u{1F4DC}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">Recent Transactions</Text>
        </View>
        <TouchableOpacity onPress={() => fetchHistory(address)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View className="px-5 py-2">
        {isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator size="small" color="#3792A6" />
            <Text className="text-[11px] text-gray-400 mt-2">Loading from chain...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View className="py-6 items-center">
            <Text className="text-[12px] text-gray-400 font-semibold">No transactions yet</Text>
          </View>
        ) : (
          transactions.slice(0, 10).map((tx) => (
            <TouchableOpacity
              key={tx.signature}
              onPress={() => Linking.openURL(getSolscanTxUrl(tx.signature))}
              activeOpacity={0.7}
              className="flex-row items-center py-3 border-b border-gray-100"
            >
              <View className={`w-7 h-7 rounded-full items-center justify-center ${tx.err ? 'bg-red-100' : 'bg-pet-blue-light/40'}`}>
                <MaterialCommunityIcons
                  name={tx.err ? 'close-circle-outline' : 'check-circle-outline'}
                  size={16}
                  color={tx.err ? '#dc2626' : '#3792A6'}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[12px] font-bold text-gray-700" numberOfLines={1}>{tx.label}</Text>
                <Text className="text-[10px] text-gray-400 font-medium">{tx.signature.slice(0, 8)}...{tx.signature.slice(-6)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-gray-400 font-semibold">{formatTime(tx.timestamp)}</Text>
                <MaterialCommunityIcons name="open-in-new" size={12} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function CollectiblesRow() {
  const items = useShopStore((s) => s.items);
  const owned = items.filter((i) => i.owned);
  const byRarity = {
    common: owned.filter((i) => i.rarity === 'common').length,
    rare: owned.filter((i) => i.rarity === 'rare').length,
    epic: owned.filter((i) => i.rarity === 'epic').length,
    legendary: owned.filter((i) => i.rarity === 'legendary').length,
  };

  return (
    <View className="py-3.5 border-b border-gray-100">
      <Text className="text-[12px] font-semibold text-gray-500 mb-2">Collectibles</Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {byRarity.common > 0 && (
          <View className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-black text-gray-500">{byRarity.common} Common</Text>
          </View>
        )}
        {byRarity.rare > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.rare} Rare</Text>
          </View>
        )}
        {byRarity.epic > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.epic} Epic</Text>
          </View>
        )}
        {byRarity.legendary > 0 && (
          <View className="bg-pet-blue-light/40 px-2.5 py-1 rounded-full border border-pet-blue-light/90">
            <Text className="text-[10px] font-black text-pet-blue-dark">{byRarity.legendary} Legendary</Text>
          </View>
        )}
        {owned.length === 0 && (
          <Text className="text-[11px] text-gray-400 font-semibold">No items yet</Text>
        )}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { address, balance, skrBalance, disconnectWallet, refreshBalance, refreshSkrBalance, authToken } = useWalletStore();
  const { name, ownerName, mintAddress, mintTxSignature, skin, clearPet, streakDays, hunger, happiness, energy } = usePetStore();
  const premium = usePremiumStore((s) => s.isPremium);
  const tier = usePremiumStore((s) => s.tier);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [skrClaimLoading, setSkrClaimLoading] = useState(false);
  const [memoLoading, setMemoLoading] = useState(false);
  const [lastMemoTime, setLastMemoTime] = useState<string | null>(null);
  const notificationsEnabled = useNotificationStore((s) => s.enabled);
  const toggleNotifications = useNotificationStore((s) => s.setEnabled);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected';
  const shortMintAddress = mintAddress ? `${mintAddress.slice(0, 6)}...${mintAddress.slice(-4)}` : 'N/A';

  const handleDisconnect = () => {
    clearPet();
    disconnectWallet();
  };

  const handleAirdrop = useCallback(async () => {
    if (!address || airdropLoading) return;
    setAirdropLoading(true);
    try {
      await requestAirdrop(address, 1);
      await refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Airdrop Received', '1 SOL has been airdropped to your wallet!');
    } catch (err: any) {
      Alert.alert('Airdrop Failed', err?.message || 'Devnet airdrop failed. Try again later.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAirdropLoading(false);
    }
  }, [address, airdropLoading, refreshBalance]);

  const handleClaimSkr = useCallback(async () => {
    if (!authToken || skrClaimLoading) return;
    setSkrClaimLoading(true);
    try {
      const txSig = await claimTestSkr(authToken);
      try {
        const { labelTransaction } = require('../store/txHistoryStore');
        labelTransaction(txSig, 'Claimed SKR Tokens');
      } catch {}
      await refreshSkrBalance();
      await refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('SKR Claimed!', '100 SKR tokens have been minted to your wallet.');
    } catch (err: any) {
      Alert.alert('Claim Failed', err?.message || 'Failed to claim SKR tokens.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSkrClaimLoading(false);
    }
  }, [authToken, skrClaimLoading, refreshSkrBalance, refreshBalance]);

  const handleSyncPetState = useCallback(async () => {
    if (!authToken || memoLoading) return;
    setMemoLoading(true);
    try {
      const petState = JSON.stringify({
        pet: name,
        hunger: Math.round(hunger),
        happiness: Math.round(happiness),
        energy: Math.round(energy),
        ts: Date.now(),
      });
      const txSig = await writeMemo(authToken, petState);
      try {
        const { labelTransaction } = require('../store/txHistoryStore');
        labelTransaction(txSig, 'Pet State Sync');
      } catch {}
      setLastMemoTime(new Date().toLocaleTimeString());
      await refreshBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.message || 'Failed to write pet state on-chain.');
    } finally {
      setMemoLoading(false);
    }
  }, [authToken, memoLoading, name, hunger, happiness, energy, refreshBalance]);

  const skinDisplayName = skin === 'default' ? 'Default' : skin.charAt(0).toUpperCase() + skin.slice(1);

  return (
    <View className="flex-1 bg-pet-background">
      <LinearGradient
        colors={['#EFF7FF', '#E8F3FD', '#F5FAFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      <View className="absolute -top-6 -right-8 w-36 h-36 rounded-full bg-pet-blue-light/30" />
      <View className="absolute top-52 -left-10 w-44 h-44 rounded-full bg-pet-blue-light/20" />
      <View className="absolute top-[520px] -right-12 w-48 h-48 rounded-full bg-pet-blue-light/25" />

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={premium ? `${TIER_CONFIGS[tier].label} Member` : 'Player Card'}
          title="Profile"
          subtitle="Wallet, title progress, and companion identity."
          badge={premium ? `${TIER_CONFIGS[tier].emoji} Nomi Plus` : 'All synced \u00B7 v2'}
          rightSlot={(
            <View className="w-14 h-14 rounded-2xl bg-white/20 border border-white/40 items-center justify-center">
              <Text className="text-2xl">{premium ? TIER_CONFIGS[tier].emoji : '\u{1F984}'}</Text>
            </View>
          )}
        />

        <ProgressCard />

        <EvolutionCard />

        <PremiumCard />

        <View className="mt-1" />

        <InfoCard title="Wallet" icon={'\u{1F4B0}'} accent="bg-pet-blue-dark">
          <TouchableOpacity onPress={() => address && Linking.openURL(getSolscanAddressUrl(address))} activeOpacity={0.7}>
            <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
              <Text className="text-[12px] font-semibold text-gray-500">Address</Text>
              <View className="flex-row items-center">
                <Text className="text-[12px] font-black text-gray-800 mr-1">{shortAddress}</Text>
                <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />
              </View>
            </View>
          </TouchableOpacity>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Balance</Text>
            <View className="flex-row items-center">
              <Text className="text-[12px] font-black text-pet-blue-dark mr-2">{balance.toFixed(4)} SOL</Text>
              <TouchableOpacity onPress={refreshBalance} activeOpacity={0.7}>
                <MaterialCommunityIcons name="refresh" size={14} color="#3792A6" />
              </TouchableOpacity>
            </View>
          </View>
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">SKR Balance</Text>
            <View className="flex-row items-center">
              <Text className="text-[12px] font-black text-purple-600 mr-2">{skrBalance.toFixed(2)} SKR</Text>
              <TouchableOpacity onPress={refreshSkrBalance} activeOpacity={0.7}>
                <MaterialCommunityIcons name="refresh" size={14} color="#9333ea" />
              </TouchableOpacity>
            </View>
          </View>
          <InfoRow label="Network" value="Solana Devnet" valueColor="text-pet-blue-dark" />
          <View className="py-3" style={{ gap: 8 }}>
            <TouchableOpacity onPress={handleClaimSkr} disabled={skrClaimLoading} activeOpacity={0.85}>
              <LinearGradient
                colors={['#9333ea', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-2.5 rounded-xl items-center flex-row justify-center"
              >
                {skrClaimLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white text-[11px] font-black ml-2">Minting SKR...</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-white text-[11px] font-black uppercase tracking-[0.5px]">{'\u{1F48E}'} Claim 100 Test SKR</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAirdrop} disabled={airdropLoading} activeOpacity={0.85}>
              <LinearGradient
                colors={['#4FABC9', '#3E8AB3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-2.5 rounded-xl items-center flex-row justify-center"
              >
                {airdropLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white text-[11px] font-black ml-2">Requesting...</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="water" size={14} color="#fff" />
                    <Text className="text-white text-[11px] font-black ml-1.5 uppercase tracking-[0.5px]">Request 1 SOL Airdrop</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </InfoCard>

        <InfoCard title="Companion" icon={'\u{1F43E}'} accent="bg-pet-blue">
          <InfoRow label="Name" value={name} />
          {ownerName ? <InfoRow label="Owner" value={ownerName} valueColor="text-pet-blue-dark" /> : null}
          <TouchableOpacity
            onPress={() => mintAddress && Linking.openURL(getSolscanNftUrl(mintAddress))}
            activeOpacity={0.7}
            disabled={!mintAddress}
          >
            <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
              <Text className="text-[12px] font-semibold text-gray-500">NFT Mint</Text>
              <View className="flex-row items-center">
                <Text className="text-[12px] font-black text-gray-800 mr-1">{shortMintAddress}</Text>
                {mintAddress && <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" />}
              </View>
            </View>
          </TouchableOpacity>
          {premium && (
            <InfoRow
              label="Tier"
              value={`${TIER_CONFIGS[tier].emoji} ${TIER_CONFIGS[tier].label}`}
              valueColor="text-pet-blue-dark"
            />
          )}
          <InfoRow label="Outfit" value={skinDisplayName} valueColor="text-pet-blue" />
          <InfoRow label="Streak" value={`${streakDays} day${streakDays === 1 ? '' : 's'}`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Adventures" value={`${useAdventureStore.getState().completedAdventures} completed`} valueColor="text-pet-blue-dark" />
          <InfoRow label="Mini-Games" value={`${useAdventureStore.getState().miniGamesWon} won`} valueColor="text-pet-blue-dark" />
          <CollectiblesRow />
          <View className="py-3">
            <TouchableOpacity onPress={handleSyncPetState} disabled={memoLoading} activeOpacity={0.85}>
              <View className="py-2.5 rounded-xl items-center flex-row justify-center bg-pet-blue-light/40 border border-pet-blue-light/80">
                {memoLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#3792A6" />
                    <Text className="text-pet-blue-dark text-[11px] font-black ml-2">Syncing on-chain...</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={14} color="#3792A6" />
                    <Text className="text-pet-blue-dark text-[11px] font-black ml-1.5 uppercase tracking-[0.5px]">Sync Pet State On-Chain</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            {lastMemoTime && (
              <Text className="text-[10px] text-gray-400 font-semibold text-center mt-1.5">Last sync: {lastMemoTime}</Text>
            )}
          </View>
        </InfoCard>

        {address && <TransactionHistoryCard address={address} />}

        <InfoCard title="App" icon={'\u2699'} accent="bg-pet-blue-dark">
          <InfoRow label="Version" value="2.1.0" />
          <InfoRow label="Build" value="Design Refresh" valueColor="text-pet-blue-dark" />
          <View className="flex-row justify-between py-3.5 border-b border-gray-100 items-center">
            <Text className="text-[12px] font-semibold text-gray-500">Notifications</Text>
            <TouchableOpacity
              onPress={() => toggleNotifications(!notificationsEnabled)}
              activeOpacity={0.7}
            >
              <View className={`px-3 py-1 rounded-full ${notificationsEnabled ? 'bg-pet-green' : 'bg-gray-300'}`}>
                <Text className="text-[10px] font-black text-white">
                  {notificationsEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </InfoCard>

        <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.9}>
          <View
            className="py-4 rounded-2xl mb-5 border border-pet-blue-dark/30 bg-white flex-row items-center justify-center"
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

        {/* Solana branding for hackathon judges */}
        <View className="items-center mb-10 py-4">
          <LinearGradient
            colors={['#9945FF', '#14F195']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center px-5 py-2.5 rounded-2xl"
          >
            <Text className="text-[16px] mr-2">{'\u{26A1}'}</Text>
            <Text className="text-[12px] font-black text-white uppercase tracking-[0.8px]">Powered by Solana</Text>
          </LinearGradient>
          <Text className="text-[10px] text-gray-400 font-semibold mt-2">
            Real on-chain transactions {'\u00B7'} Devnet {'\u00B7'} Mobile Wallet Adapter
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}


