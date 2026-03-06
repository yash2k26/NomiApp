import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, ADVENTURE_ZONES, type LootReward, type AdventureZone } from '../store/adventureStore';
import { usePetStore } from '../store/petStore';
import { useXpStore } from '../store/xpStore';
import { petTypography } from '../theme/typography';

const EXPLORING_IMG = require('../../assets/Photos/Exploring-removebg-preview.png');
const EXPLORE_EARTH_IMG = require('../../assets/Photos/exploreEarth-removebg-preview.png');

function formatTime(ms: number): string {
  if (ms <= 0) return 'Done!';
  const totalSec = Math.ceil(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${min}m`;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

const RARITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  common: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Common' },
  uncommon: { bg: 'bg-pet-green-light/40', text: 'text-pet-green-dark', label: 'Uncommon' },
  rare: { bg: 'bg-pet-purple-light/40', text: 'text-pet-purple-dark', label: 'Rare!' },
  legendary: { bg: 'bg-pet-gold-light/60', text: 'text-pet-gold-dark', label: 'LEGENDARY!' },
};

function LootRevealModal({ loot, visible, onClose }: { loot: LootReward | null; visible: boolean; onClose: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !loot) return;
    scaleAnim.setValue(0.3);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(
      loot.rarity === 'legendary' ? Haptics.NotificationFeedbackType.Success :
      loot.rarity === 'rare' ? Haptics.NotificationFeedbackType.Success :
      Haptics.NotificationFeedbackType.Warning
    );
  }, [visible, loot, scaleAnim, opacityAnim]);

  if (!loot) return null;
  const rarity = RARITY_COLORS[loot.rarity];

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={{ opacity: opacityAnim }} className="flex-1 bg-black/50 items-center justify-center px-8">
        <Animated.View
          style={{ transform: [{ scale: scaleAnim }], shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 20 }}
          className="bg-white rounded-[36px] items-center px-8 py-10 w-full"
        >
          <Text className="text-[48px] mb-4">{'\u{1F381}'}</Text>
          <View className={`px-4 py-1.5 rounded-full mb-3 ${rarity.bg}`}>
            <Text className={`text-[14px] font-black uppercase tracking-[1px] ${rarity.text}`}>{rarity.label}</Text>
          </View>

          <Text className="text-[28px] font-black text-gray-800 mb-4" style={{ fontFamily: petTypography.display }}>Loot Found!</Text>

          <View className="w-full mb-6" style={{ gap: 4 }}>
            <View className="flex-row justify-between py-2.5 border-b border-gray-100">
              <Text className="text-gray-500 font-semibold">XP Earned</Text>
              <Text className="font-black text-pet-blue-dark">+{loot.xp} XP</Text>
            </View>
            {loot.coins > 0 && (
              <View className="flex-row justify-between py-2.5 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Coins</Text>
                <Text className="font-black text-pet-blue-dark">+{loot.coins.toFixed(2)} SOL</Text>
              </View>
            )}
            {loot.skr > 0 && (
              <View className="flex-row justify-between py-2.5 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">SKR Tokens</Text>
                <Text className="font-black text-purple-600">+{loot.skr.toFixed(2)} SKR</Text>
              </View>
            )}
            {loot.shard && (
              <View className="flex-row justify-between py-2.5 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Evolution Shard</Text>
                <Text className="font-black text-pet-blue-dark">+1</Text>
              </View>
            )}
            {loot.freeItem && (
              <View className="flex-row justify-between py-2.5 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Bonus</Text>
                <Text className="font-black text-pet-blue-dark">Free Item Token</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} className="w-full">
            <LinearGradient colors={['#4FABC9', '#3E8AB3']} className="py-3.5 items-center" style={{ borderRadius: 18 }}>
              <Text className="text-white text-[14px] font-black uppercase tracking-[1px]">Collect!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function ZoneCard({ zone, onSelect, locked }: { zone: AdventureZone; onSelect: () => void; locked: boolean }) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={locked}
      activeOpacity={0.85}
      style={{ marginBottom: 10 }}
    >
      <View
        className={`p-4 border ${locked ? 'bg-gray-50 border-gray-200' : 'bg-white border-pet-blue-light/40'}`}
        style={{
          borderRadius: 18,
          ...(locked ? {} : { shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }),
        }}
      >
        <View className="flex-row items-center">
          <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${locked ? 'bg-gray-100' : 'bg-pet-blue-light/30'}`}>
            <Text className="text-[24px]">{locked ? '\u{1F512}' : zone.emoji}</Text>
          </View>
          <View className="flex-1 mr-3">
            <Text className={`text-[14px] font-black ${locked ? 'text-gray-400' : 'text-gray-800'}`}>{zone.name}</Text>
            <Text className={`text-[11px] ${locked ? 'text-gray-300' : 'text-gray-500'}`} numberOfLines={2}>
              {locked ? `Unlocks at Level ${zone.levelRequired}` : zone.description}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center mt-2.5 ml-15" style={{ marginLeft: 60, gap: 8 }}>
          <View className={`px-2.5 py-1 rounded-full ${locked ? 'bg-gray-100' : 'bg-pet-blue-light/30 border border-pet-blue-light/60'}`}>
            <Text className={`text-[10px] font-bold ${locked ? 'text-gray-300' : 'text-pet-blue-dark'}`}>{zone.durationLabel}</Text>
          </View>
          <View className={`px-2.5 py-1 rounded-full ${locked ? 'bg-gray-100' : 'bg-pet-blue-light/30 border border-pet-blue-light/60'}`}>
            <Text className={`text-[10px] font-bold ${locked ? 'text-gray-300' : 'text-pet-blue-dark'}`}>{zone.xpRange[0]}-{zone.xpRange[1]} XP</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function AdventureCard() {
  const { activeAdventure, pendingLoot, checkAdventureComplete, claimAdventureLoot, startAdventure } = useAdventureStore();
  const { hunger, happiness, energy } = usePetStore();
  const level = useXpStore((s) => s.level);
  const [remaining, setRemaining] = useState(0);
  const [showZones, setShowZones] = useState(false);
  const [lootModal, setLootModal] = useState(false);
  const [claimedLoot, setClaimedLoot] = useState<LootReward | null>(null);

  useEffect(() => {
    if (!activeAdventure) return;
    const update = () => {
      const r = activeAdventure.endsAt - Date.now();
      setRemaining(r);
      if (r <= 0) checkAdventureComplete();
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeAdventure, checkAdventureComplete]);

  useEffect(() => {
    if (pendingLoot && !lootModal) {
      setClaimedLoot(pendingLoot);
      setLootModal(true);
    }
  }, [pendingLoot, lootModal]);

  const handleClaimLoot = () => {
    claimAdventureLoot();
    setLootModal(false);
  };

  const handleSelectZone = (zone: AdventureZone) => {
    const success = startAdventure(zone.id, { hunger, happiness, energy });
    if (success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setShowZones(false);
    }
  };

  const statsOk = hunger >= 30 && happiness >= 30 && energy >= 30;
  const activeZone = activeAdventure ? ADVENTURE_ZONES.find(z => z.id === activeAdventure.zoneId) : null;

  const adventureDuration = activeAdventure ? activeAdventure.endsAt - activeAdventure.startedAt : 0;
  const progress = activeAdventure && adventureDuration > 0
    ? Math.max(0, Math.min(100, ((adventureDuration - remaining) / adventureDuration) * 100))
    : 0;

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white rounded-[28px] overflow-hidden border border-pet-blue-light/50"
        style={{ shadowColor: '#2E6E93', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 5 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#4FABC9', '#72C8DA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Image source={EXPLORING_IMG} style={{ width: 108, height: 48, marginRight: 8 }} resizeMode="contain" />
            <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Adventures</Text>
          </View>
          {activeAdventure && (
            <View className="bg-white/20 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-white">{formatTime(remaining)}</Text>
            </View>
          )}
        </LinearGradient>

        <View className="p-5">
          {activeAdventure && activeZone ? (
            // Active adventure
            <View className="items-center">
              <Image source={EXPLORING_IMG} style={{ width: 56, height: 56, marginBottom: 12 }} resizeMode="contain" />
              <Text className="text-[16px] font-black text-gray-800 mb-0.5" style={{ fontFamily: petTypography.heading }}>{activeZone.name}</Text>
              <Text className="text-[12px] text-gray-400 font-semibold mb-4">Nomi is out exploring...</Text>

              {/* Progress bar */}
              <View className="w-full h-2.5 rounded-full bg-pet-blue-light/35 overflow-hidden">
                <View
                  className="h-full rounded-full bg-pet-blue"
                  style={{ width: `${progress}%` }}
                />
              </View>
              <Text className="text-[11px] font-bold text-pet-blue-dark mt-2">
                {remaining > 0 ? formatTime(remaining) + ' remaining' : 'Adventure complete!'}
              </Text>

              {remaining <= 0 && (
                <TouchableOpacity
                  onPress={() => checkAdventureComplete()}
                  className="mt-4 w-full"
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#4FABC9', '#3E8AB3']} className="py-3.5 items-center" style={{ borderRadius: 18 }}>
                    <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px]">Open Loot</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : showZones ? (
            // Zone selection
            <View>
              <Text className="text-[14px] font-black text-gray-800 mb-3" style={{ fontFamily: petTypography.heading }}>Choose a Zone</Text>
              {!statsOk && (
                <View className="bg-red-50 px-3 py-2 rounded-xl mb-3 border border-red-100">
                  <Text className="text-[11px] text-red-500 font-semibold">
                    All stats must be above 30% to depart
                  </Text>
                </View>
              )}
              {ADVENTURE_ZONES.map(zone => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  locked={level < zone.levelRequired || !statsOk}
                  onSelect={() => handleSelectZone(zone)}
                />
              ))}
              <TouchableOpacity onPress={() => setShowZones(false)} className="items-center mt-2">
                <Text className="text-[12px] font-bold text-gray-400">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Idle
            <View className="items-center">
              <Image source={EXPLORE_EARTH_IMG} style={{ width: 404, height: 104, marginBottom: 12 }} resizeMode="contain" />
              <Text className="text-[16px] font-black text-gray-800 mb-1" style={{ fontFamily: petTypography.heading }}>
                Send Nomi Exploring
              </Text>
              <Text className="text-[12px] text-gray-400 font-semibold mb-5">
                Earn XP, coins, and evolution shards
              </Text>

              {/* Quick info pills */}
              <View className="flex-row mb-5" style={{ gap: 8 }}>
                <View className="bg-pet-blue-light/30 px-3 py-1.5 rounded-full border border-pet-blue-light/60">
                  <Text className="text-[10px] font-bold text-pet-blue-dark">5-60 XP</Text>
                </View>
                <View className="bg-pet-blue-light/30 px-3 py-1.5 rounded-full border border-pet-blue-light/60">
                  <Text className="text-[10px] font-bold text-pet-blue-dark">3 Zones</Text>
                </View>
                <View className="bg-pet-blue-light/30 px-3 py-1.5 rounded-full border border-pet-blue-light/60">
                  <Text className="text-[10px] font-bold text-pet-blue-dark">Rare Loot</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setShowZones(true)} activeOpacity={0.85} className="w-full">
                <LinearGradient colors={['#4FABC9', '#3E8AB3']} className="py-3.5 items-center" style={{ borderRadius: 18 }}>
                  <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px]">Choose Zone</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <LootRevealModal loot={claimedLoot} visible={lootModal} onClose={handleClaimLoot} />
    </View>
  );
}
