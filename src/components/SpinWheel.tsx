import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, SPIN_SEGMENTS, type SpinResult } from '../store/adventureStore';
import { useWalletStore } from '../store/walletStore';

const SEGMENT_COUNT = SPIN_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

const SEGMENT_COLORS = [
  '#FF9F43', '#9381FF', '#FF8FAB', '#4FB0C6',
  '#FFD700', '#88C057', '#E07A94', '#766BD1',
];

function SpinResultModal({ result, visible, onClose }: { result: SpinResult | null; visible: boolean; onClose: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  if (!visible || !result) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View
          className="bg-white rounded-[36px] items-center px-8 py-10 w-full"
          style={{ shadowColor: '#FFD700', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20 }}
        >
          <Text className="text-[56px] mb-3">{result.emoji}</Text>
          <Text className="text-[24px] font-black text-gray-800 mb-2">{result.label}</Text>

          {result.xp > 0 && (
            <Text className="text-[16px] font-bold text-pet-purple mb-1">+{result.xp} XP</Text>
          )}
          {result.staminaRefill && (
            <Text className="text-[16px] font-bold text-pet-green-dark mb-1">{'\u{26A1}'} Stamina Refilled!</Text>
          )}
          {result.doubleXpMinutes > 0 && (
            <Text className="text-[16px] font-bold text-pet-orange-dark mb-1">{'\u{1F525}'} 2x XP for 1 hour!</Text>
          )}
          {result.freeItem && (
            <Text className="text-[16px] font-bold text-pet-pink mb-1">{'\u{1F381}'} Free Shop Item!</Text>
          )}
          {result.shard && (
            <Text className="text-[16px] font-bold text-pet-purple mb-1">{'\u{1F48E}'} Evolution Shard!</Text>
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} className="w-full mt-4">
            <LinearGradient colors={['#FFD700', '#CCA800']} className="py-3.5 rounded-2xl items-center">
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
        style={{ shadowColor: '#FFD700', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}
      >
        <LinearGradient
          colors={['#9381FF', '#A797FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Text className="text-base mr-2">{'\u{1F3B0}'}</Text>
            <Text className="text-[12px] font-black text-white tracking-[0.8px] uppercase">Lucky Wheel</Text>
          </View>
          {isFreeSpin && (
            <View className="bg-pet-gold px-2.5 py-1 rounded-full">
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
              className="rounded-full border-4 border-pet-purple items-center justify-center"
            >
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
                    <Text className="text-[18px]">{seg.emoji}</Text>
                    <Text className="text-[7px] font-black text-gray-600 mt-0.5" numberOfLines={1}>{seg.label}</Text>
                  </View>
                );
              })}
              {/* Center circle */}
              <View className="w-14 h-14 rounded-full bg-pet-purple items-center justify-center">
                <Text className="text-white font-black text-[10px]">SPIN</Text>
              </View>
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
              colors={canSpin ? ['#9381FF', '#766BD1'] : ['#D1D5DB', '#9CA3AF']}
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
