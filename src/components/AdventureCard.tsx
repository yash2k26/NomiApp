import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, ADVENTURE_ZONES, type LootReward, type AdventureZone } from '../store/adventureStore';
import { usePetStore } from '../store/petStore';
import { useXpStore } from '../store/xpStore';

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
          style={{ transform: [{ scale: scaleAnim }], shadowColor: '#9381FF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20 }}
          className="bg-white rounded-[36px] items-center px-8 py-10 w-full"
        >
          <Text className="text-[48px] mb-4">{'\u{1F381}'}</Text>
          <View className={`px-4 py-1.5 rounded-full mb-3 ${rarity.bg}`}>
            <Text className={`text-[14px] font-black uppercase tracking-[1px] ${rarity.text}`}>{rarity.label}</Text>
          </View>

          <Text className="text-[28px] font-black text-gray-800 mb-4">Loot Found!</Text>

          <View className="w-full space-y-2 mb-6">
            <View className="flex-row justify-between py-2 border-b border-gray-100">
              <Text className="text-gray-500 font-semibold">XP Earned</Text>
              <Text className="font-black text-pet-purple">+{loot.xp} XP</Text>
            </View>
            {loot.coins > 0 && (
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Coins</Text>
                <Text className="font-black text-pet-gold-dark">+{loot.coins.toFixed(2)} SOL</Text>
              </View>
            )}
            {loot.skr > 0 && (
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">SKR Tokens</Text>
                <Text className="font-black text-purple-600">{'\u{1F48E}'} +{loot.skr.toFixed(2)} SKR</Text>
              </View>
            )}
            {loot.shard && (
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Evolution Shard</Text>
                <Text className="font-black text-pet-purple">{'\u{1F48E}'} +1</Text>
              </View>
            )}
            {loot.freeItem && (
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-500 font-semibold">Bonus</Text>
                <Text className="font-black text-pet-pink">{'\u{1F381}'} Free Item Token</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} className="w-full">
            <LinearGradient colors={['#9381FF', '#766BD1']} className="py-3.5 rounded-2xl items-center">
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
      className="mb-3"
    >
      <View
        className={`flex-row items-center p-4 rounded-2xl border ${locked ? 'bg-gray-50 border-gray-200' : 'bg-white border-pet-blue-light/40'}`}
        style={!locked ? { shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 } : undefined}
      >
        <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${locked ? 'bg-gray-100' : 'bg-pet-blue-light/30'}`}>
          <Text className="text-[24px]">{locked ? '\u{1F512}' : zone.emoji}</Text>
        </View>
        <View className="flex-1">
          <Text className={`text-[14px] font-black ${locked ? 'text-gray-400' : 'text-gray-800'}`}>{zone.name}</Text>
          <Text className={`text-[11px] ${locked ? 'text-gray-300' : 'text-gray-500'}`}>
            {locked ? `Unlocks at Level ${zone.levelRequired}` : zone.description}
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-[10px] font-bold ${locked ? 'text-gray-300' : 'text-pet-blue-dark'}`}>{zone.durationLabel}</Text>
          <Text className={`text-[10px] font-semibold ${locked ? 'text-gray-300' : 'text-pet-purple'}`}>{zone.xpRange[0]}-{zone.xpRange[1]} XP</Text>
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

  // Update timer
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

  // Show loot modal when loot is pending
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

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white rounded-[28px] overflow-hidden border border-gray-100"
        style={{ shadowColor: '#1A2A40', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4 }}
      >
        <LinearGradient
          colors={['#FF9F43', '#FFB76B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Text className="text-base mr-2">{'\u{1F5FA}\uFE0F'}</Text>
            <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Adventures</Text>
          </View>
          {activeAdventure && (
            <View className="bg-white/20 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-white">{'\u{23F3}'} {formatTime(remaining)}</Text>
            </View>
          )}
        </LinearGradient>

        <View className="p-5">
          {activeAdventure && activeZone ? (
            // Active adventure
            <View className="items-center">
              <Text className="text-[40px] mb-2">{activeZone.emoji}</Text>
              <Text className="text-[16px] font-black text-gray-800 mb-1">{activeZone.name}</Text>
              <Text className="text-[13px] text-gray-500 mb-3">Nomi is exploring...</Text>
              <View className="w-full h-3 rounded-full bg-pet-orange-light/40 overflow-hidden">
                <View
                  className="h-full rounded-full bg-pet-orange"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((activeAdventure.endsAt - activeAdventure.startedAt - remaining) / (activeAdventure.endsAt - activeAdventure.startedAt)) * 100))}%`,
                  }}
                />
              </View>
              <Text className="text-[12px] font-bold text-pet-orange-dark mt-2">
                {remaining > 0 ? formatTime(remaining) + ' remaining' : 'Adventure complete! Tap to collect.'}
              </Text>
              {remaining <= 0 && (
                <TouchableOpacity
                  onPress={() => checkAdventureComplete()}
                  className="mt-3"
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#FF9F43', '#E88A2D']} className="px-8 py-3 rounded-2xl">
                    <Text className="text-white font-black text-[13px] uppercase tracking-[0.8px]">Open Loot</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : showZones ? (
            // Zone selection
            <View>
              <Text className="text-[14px] font-black text-gray-800 mb-1">Choose a Zone</Text>
              {!statsOk && (
                <Text className="text-[11px] text-pet-pink-dark font-semibold mb-3">
                  {'\u26A0\uFE0F'} All stats must be above 30% to depart
                </Text>
              )}
              {ADVENTURE_ZONES.map(zone => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  locked={level < zone.levelRequired || !statsOk}
                  onSelect={() => handleSelectZone(zone)}
                />
              ))}
              <TouchableOpacity onPress={() => setShowZones(false)} className="items-center mt-1">
                <Text className="text-[12px] font-bold text-gray-400">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Idle — show "Send on Adventure" button
            <View className="items-center">
              <Text className="text-[40px] mb-2">{'\u{1F30D}'}</Text>
              <Text className="text-[14px] font-black text-gray-800 mb-1">Send Nomi Exploring</Text>
              <Text className="text-[12px] text-gray-500 mb-4">
                Earn XP, coins, and evolution shards!
              </Text>
              <TouchableOpacity onPress={() => setShowZones(true)} activeOpacity={0.85}>
                <LinearGradient colors={['#FF9F43', '#E88A2D']} className="px-8 py-3 rounded-2xl">
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
