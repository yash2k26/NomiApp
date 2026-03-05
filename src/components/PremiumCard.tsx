import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePremiumStore } from '../store/premiumStore';
import { useWalletStore } from '../store/walletStore';
import { type PremiumTier, TIER_CONFIGS, TIER_ORDER, getTierOrdinal, getUpgradeCost } from '../data/premiumTiers';
import { getSolscanTxUrl } from '../lib/solanaClient';

const TIER_PERKS: Record<Exclude<PremiumTier, 'none'>, { emoji: string; text: string }[]> = {
  silver: [
    { emoji: '\u26A1', text: '1.5x stamina regen speed' },
    { emoji: '\u{23F1}', text: '25% faster cooldowns' },
    { emoji: '\u{2B50}', text: '+25% XP bonus' },
    { emoji: '\u{1F3B0}', text: '2 free spins/day' },
  ],
  gold: [
    { emoji: '\u26A1', text: '2x stamina regen speed' },
    { emoji: '\u{23F1}', text: '50% faster cooldowns' },
    { emoji: '\u{2B50}', text: '+50% XP bonus' },
    { emoji: '\u{1F3B0}', text: '3 free spins/day' },
    { emoji: '\u{1F4E6}', text: '+10% rare & legendary loot' },
    { emoji: '\u{1F31F}', text: 'Exclusive gold items' },
  ],
  diamond: [
    { emoji: '\u26A1', text: '3x stamina regen speed' },
    { emoji: '\u{23F1}', text: '75% faster cooldowns' },
    { emoji: '\u{2B50}', text: '+75% XP bonus' },
    { emoji: '\u{1F3B0}', text: '5 free spins/day' },
    { emoji: '\u{1F4E6}', text: '+20% rare & legendary loot' },
    { emoji: '\u{1F451}', text: 'All accessories free' },
    { emoji: '\u{1F48E}', text: 'Diamond-exclusive items' },
    { emoji: '\u{1F3AE}', text: 'No mini-game cooldowns' },
  ],
};

interface TierOptionProps {
  tier: Exclude<PremiumTier, 'none'>;
  currentTier: PremiumTier;
  onPurchase: (tier: PremiumTier) => void;
  purchasing?: boolean;
}

function TierOption({ tier, currentTier, onPurchase, purchasing }: TierOptionProps) {
  const config = TIER_CONFIGS[tier];
  const isActive = currentTier === tier;
  const isBelow = getTierOrdinal(currentTier) > getTierOrdinal(tier);
  const cost = getUpgradeCost(currentTier, tier);
  const perks = TIER_PERKS[tier];
  const isPopular = tier === 'gold';

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4 border-2"
      style={{
        borderColor: isActive ? config.badgeColor : '#E5E7EB',
        opacity: isBelow ? 0.5 : 1,
      }}
    >
      {/* Tier header */}
      <LinearGradient
        colors={config.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-4 py-2.5 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{config.emoji}</Text>
          <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">{config.label}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isPopular && !isActive && !isBelow && (
            <View className="bg-white/30 px-2 py-0.5 rounded-full">
              <Text className="text-white text-[9px] font-black">POPULAR</Text>
            </View>
          )}
          {isActive ? (
            <View className="bg-white/30 px-2.5 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold">{'\u2705'} Active</Text>
            </View>
          ) : (
            <View className="bg-white/20 px-2.5 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold">{config.price} SOL</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Perks list */}
      <View className="bg-white px-4 py-3">
        {perks.map((perk, i) => (
          <View key={i} className="flex-row items-center py-1">
            <Text className="text-[12px] mr-2">{perk.emoji}</Text>
            <Text className="text-[11px] font-semibold text-gray-600 flex-1">{perk.text}</Text>
            {isActive && <Text className="text-[10px] text-green-500 font-bold">{'\u2713'}</Text>}
          </View>
        ))}

        {/* Purchase/upgrade button */}
        {!isActive && !isBelow && (
          purchasing ? (
            <View style={{ marginTop: 8, paddingVertical: 14, borderRadius: 18, alignItems: 'center', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color="#3792A6" />
              <Text className="text-gray-600 font-black text-[11px] uppercase tracking-[0.5px] ml-2">Confirm in Phantom...</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => onPurchase(tier)}
              activeOpacity={0.85}
              style={{ marginTop: 8 }}
            >
              <LinearGradient
                colors={config.gradientColors}
                style={{ paddingVertical: 14, borderRadius: 18, alignItems: 'center' }}
              >
                <Text className="text-white font-black text-[13px] uppercase tracking-[0.5px]">
                  {currentTier === 'none'
                    ? `Get ${config.label} for ${config.price} SOL`
                    : `Upgrade for ${cost} SOL`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

export function PremiumCard() {
  const tier = usePremiumStore((s) => s.tier);
  const purchaseTier = usePremiumStore((s) => s.purchaseTier);
  const balance = useWalletStore((s) => s.balance);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = (targetTier: PremiumTier) => {
    if (purchasing) return;
    const config = TIER_CONFIGS[targetTier];
    const cost = getUpgradeCost(tier, targetTier);

    if (balance < cost) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not Enough SOL', `You need ${cost} SOL but only have ${balance.toFixed(2)} SOL.`);
      return;
    }

    const action = tier === 'none' ? 'Get' : 'Upgrade to';
    Alert.alert(
      `${action} ${config.label}`,
      `${action} ${config.label} tier for ${cost} SOL?\nThis will open Phantom for approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `${action}!`,
          onPress: async () => {
            setPurchasing(true);
            try {
              const txSig = await purchaseTier(targetTier);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Upgrade Complete!',
                `Welcome to ${config.label} tier!`,
                [
                  { text: 'View on Solscan', onPress: () => txSig && Linking.openURL(getSolscanTxUrl(txSig)) },
                  { text: 'OK' },
                ],
              );
            } catch (err: any) {
              const msg = err?.message || 'Purchase failed';
              if (msg.includes('User rejected') || msg.includes('declined')) {
                Alert.alert('Cancelled', 'Transaction cancelled in wallet.');
              } else {
                Alert.alert('Purchase Failed', msg);
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      className="bg-white rounded-[28px] overflow-hidden mb-5 border border-gray-100"
      style={{
        shadowColor: tier !== 'none' ? TIER_CONFIGS[tier].badgeColor : '#9381FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 5,
      }}
    >
      {/* Main header */}
      <LinearGradient
        colors={tier !== 'none' ? TIER_CONFIGS[tier].gradientColors : ['#9381FF', '#766BD1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-5 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center">
          <Text className="text-base mr-2">{tier !== 'none' ? TIER_CONFIGS[tier].emoji : '\u{1F31F}'}</Text>
          <Text className="text-[11px] font-black text-white tracking-[0.9px] uppercase">
            Nomi Plus
          </Text>
        </View>
        {tier !== 'none' && (
          <View className="bg-white/30 px-2.5 py-0.5 rounded-full">
            <Text className="text-white text-[10px] font-bold">{TIER_CONFIGS[tier].label} Member</Text>
          </View>
        )}
      </LinearGradient>

      <View className="px-4 py-4">
        {tier === 'diamond' ? (
          <View className="items-center mb-2">
            <Text className="text-[18px] font-black text-gray-800">
              {'\u{1F48E}'} Diamond Member
            </Text>
            <Text className="text-[12px] text-gray-500 font-semibold mt-1">
              All perks active. You're legendary!
            </Text>
          </View>
        ) : (
          <View className="items-center mb-4">
            <Text className="text-[18px] font-black text-gray-800">
              {tier === 'none' ? 'Upgrade Your Experience' : 'Go Higher'}
            </Text>
            <Text className="text-[12px] text-gray-500 font-semibold mt-1">
              {tier === 'none'
                ? 'Choose a tier to unlock premium perks'
                : 'Upgrade to the next tier for more perks'}
            </Text>
          </View>
        )}

        {/* Tier options — show tiers above current */}
        {(TIER_ORDER.filter(t => t !== 'none') as Exclude<PremiumTier, 'none'>[]).map((t) => (
          <TierOption
            key={t}
            tier={t}
            currentTier={tier}
            onPurchase={handlePurchase}
            purchasing={purchasing}
          />
        ))}
      </View>
    </View>
  );
}
