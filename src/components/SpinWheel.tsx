import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, SPIN_SEGMENTS, type SpinResult } from '../store/adventureStore';
import { useWalletStore } from '../store/walletStore';

const SEGMENT_COUNT = SPIN_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

const SEGMENT_COLORS = [
  '#8DC4E2', '#76B7DB', '#65ACD3', '#4FA0CC', '#3F91BE',
  '#8ABEDC', '#74AFD2', '#5F9FC6', '#4D92BC', '#3A84B1',
];

function SpinResultModal({ result, visible, onClose }: { result: SpinResult | null; visible: boolean; onClose: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  if (!visible || !result) return null;

  const rarityConfig =
    result.rarity === 'epic'
      ? { chipBg: 'bg-pet-blue-light/55', chipText: 'text-pet-blue-dark', label: 'EPIC', btn: ['#3E8AB3', '#2F7CA7'] as [string, string] }
      : result.rarity === 'rare'
        ? { chipBg: 'bg-pet-blue-light/45', chipText: 'text-pet-blue-dark', label: 'RARE', btn: ['#4A9ECB', '#3B8CB5'] as [string, string] }
        : { chipBg: 'bg-pet-blue-light/35', chipText: 'text-pet-blue-dark', label: 'COMMON', btn: ['#67B6D6', '#4A9ECB'] as [string, string] };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View
          className="bg-white rounded-[36px] items-center px-8 py-10 w-full"
          style={{ shadowColor: '#2E6E93', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 14 }}
        >
          <View className={`px-3 py-1 rounded-full mb-2 ${rarityConfig.chipBg}`}>
            <Text className={`text-[10px] font-black ${rarityConfig.chipText}`}>{rarityConfig.label}</Text>
          </View>
          <Text className="text-[56px] mb-3">{result.emoji}</Text>
          <Text className="text-[24px] font-black text-gray-800 mb-2">{result.label}</Text>

          {result.xp > 0 && (
            <Text className="text-[16px] font-bold text-pet-blue-dark mb-1">+{result.xp} XP</Text>
          )}
          {result.staminaRefill && (
            <Text className="text-[16px] font-bold text-pet-blue-dark mb-1">{'\u{26A1}'} Stamina Refilled!</Text>
          )}
          {result.doubleXpMinutes > 0 && (
            <Text className="text-[16px] font-bold text-pet-blue-dark mb-1">{'\u{1F525}'} 2x XP for 1 hour!</Text>
          )}
          {result.freeItem && (
            <Text className="text-[16px] font-bold text-pet-blue-dark mb-1">{'\u{1F381}'} Free Shop Item!</Text>
          )}
          {result.shard && (
            <Text className="text-[16px] font-bold text-pet-blue-dark mb-1">{'\u{1F48E}'} Evolution Shard!</Text>
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} className="w-full mt-4">
            <LinearGradient colors={rarityConfig.btn} className="py-3.5 rounded-2xl items-center">
              <Text className="text-white text-[14px] font-black uppercase tracking-[1px]">Nice!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function SpinWheel() {
  const { canSpinToday, doSpin, lastSpinDate, extraSpinsToday } = useAdventureStore();
  const balance = useWalletStore((s) => s.balance);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const currentRotation = useRef(0);

  const today = new Date().toISOString().slice(0, 10);
  const isFreeSpin = lastSpinDate !== today;
  const canSpin = canSpinToday() && !spinning;
  const needsPayment = !isFreeSpin;

  const handleSpin = useCallback(() => {
    if (!canSpin) return;

    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const spinResult = doSpin();
    if (!spinResult) {
      setSpinning(false);
      return;
    }

    // Find segment index
    const segIndex = SPIN_SEGMENTS.findIndex(s => s.label === spinResult.label);
    const targetAngle = segIndex * SEGMENT_ANGLE;
    // Spin 5-8 full rotations + land on target segment
    const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
    const finalAngle = currentRotation.current + fullRotations + (360 - targetAngle);

    Animated.timing(rotateAnim, {
      toValue: finalAngle,
      duration: 3500,
      useNativeDriver: true,
    }).start(() => {
      currentRotation.current = finalAngle % 360;
      setSpinning(false);
      setResult(spinResult);
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  }, [canSpin, doSpin, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white rounded-[28px] overflow-hidden border border-gray-100"
        style={{ shadowColor: '#2E6E93', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
      >
        <LinearGradient
          colors={['#4A9ECB', '#6EB4DA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Text className="text-base mr-2">{'\u{1F3B0}'}</Text>
            <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Lucky Wheel</Text>
          </View>
          {isFreeSpin && (
            <View className="bg-white/25 px-2.5 py-1 rounded-full border border-white/40">
              <Text className="text-[10px] font-black text-white">FREE SPIN!</Text>
            </View>
          )}
        </LinearGradient>

        <View className="p-5 items-center">
          {/* Wheel */}
          <View className="w-52 h-52 items-center justify-center mb-4">
            {/* Pointer */}
            <View className="absolute top-0 z-10">
              <Text className="text-[24px]">{'\u{1F53D}'}</Text>
            </View>

            <Animated.View
              style={{ transform: [{ rotate: spin }], width: 200, height: 200 }}
              className="rounded-full border-4 border-pet-blue items-center justify-center bg-white"
            >
              <View className="absolute w-[184px] h-[184px] rounded-full border border-pet-blue-light/70" />
              {SPIN_SEGMENTS.map((seg, i) => {
                const angle = i * SEGMENT_ANGLE;
                const rad = (angle - 90) * (Math.PI / 180);
                const r = 70;
                const x = Math.cos(rad) * r;
                const y = Math.sin(rad) * r;

                return (
                  <View
                    key={i}
                    className="absolute items-center"
                    style={{ transform: [{ translateX: x }, { translateY: y }] }}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center border border-white"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                    >
                      <Text className="text-[16px]">{seg.emoji}</Text>
                    </View>
                    <Text className="text-[7px] font-black text-gray-600 mt-0.5" numberOfLines={1}>{seg.label}</Text>
                  </View>
                );
              })}
              {/* Center circle */}
              <LinearGradient
                colors={['#4A9ECB', '#3E8AB3']}
                className="w-14 h-14 rounded-full items-center justify-center border border-white/60"
              >
                <Text className="text-white font-black text-[10px]">SPIN</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Spin button */}
          <TouchableOpacity
            onPress={handleSpin}
            disabled={!canSpin}
            activeOpacity={0.85}
            className="w-full"
          >
            <LinearGradient
              colors={canSpin ? ['#4A9ECB', '#3E8AB3'] : ['#D1D5DB', '#9CA3AF']}
              className="py-3.5 rounded-2xl items-center"
            >
              <Text className="text-white text-[14px] font-black uppercase tracking-[1px]">
                {spinning ? 'Spinning...' :
                 !canSpinToday() ? 'No Spins Left' :
                 isFreeSpin ? 'Free Spin!' :
                 `Spin (0.2 SOL)`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {!isFreeSpin && canSpinToday() && (
            <Text className="text-[10px] text-gray-400 font-semibold mt-2">
              {3 - extraSpinsToday} paid spin{3 - extraSpinsToday !== 1 ? 's' : ''} remaining
            </Text>
          )}
        </View>
      </View>

      <SpinResultModal result={result} visible={showResult} onClose={() => setShowResult(false)} />
    </View>
  );
}
