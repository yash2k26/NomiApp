import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, SPIN_SEGMENTS, type SpinResult } from '../store/adventureStore';
import { petTypography } from '../theme/typography';

const SPIN_DURATION_MS = 4000;
const SEGMENT_COUNT = SPIN_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 36° each

const WHEEL_COLORS = [
  '#5FAED4', '#77BEE0', '#4A9ECB', '#8CC9E6', '#3C8AB4',
  '#6EB7DB', '#4F9DC6', '#7FC3E3', '#5AA9D1', '#91CCE8',
];

function SpinResultModal({ result, visible, onClose }: { result: SpinResult | null; visible: boolean; onClose: () => void }) {
  if (!visible || !result) return null;

  const rarityConfig =
    result.rarity === 'epic'
      ? { bg: ['#4F95BF', '#3A7EA9'] as [string, string], label: 'EPIC' }
      : result.rarity === 'rare'
        ? { bg: ['#6FB5D9', '#4C9EC8'] as [string, string], label: 'RARE' }
        : { bg: ['#8CC8E6', '#62ADD4'] as [string, string], label: 'COMMON' };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/55 items-center justify-center px-8">
        <View
          className="bg-white rounded-[30px] items-center px-8 py-10 w-full"
          style={{ shadowColor: '#1F4C68', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 14 }}
        >
          <View className="px-3 py-1 rounded-full mb-3 bg-pet-blue-light/50 border border-pet-blue-light/80">
            <Text className="text-[10px] uppercase tracking-[1.2px] text-pet-blue-dark" style={{ fontFamily: petTypography.strong }}>
              {rarityConfig.label}
            </Text>
          </View>
          <Text className="text-[58px] mb-2">{result.emoji}</Text>
          <Text className="text-[22px] text-gray-800 mb-3 text-center" style={{ fontFamily: petTypography.display }}>
            {result.label}
          </Text>

          <View className="w-full bg-pet-blue-light/20 rounded-2xl px-5 py-3 mb-5 border border-pet-blue-light/60">
            {result.xp > 0 && <Text className="text-[14px] text-center text-pet-blue-dark mb-0.5" style={{ fontFamily: petTypography.strong }}>+{result.xp} XP</Text>}
            {result.staminaRefill && <Text className="text-[14px] text-center text-pet-blue-dark mb-0.5" style={{ fontFamily: petTypography.strong }}>{'\u26A1'} Stamina Refilled</Text>}
            {result.doubleXpMinutes > 0 && <Text className="text-[14px] text-center text-pet-blue-dark mb-0.5" style={{ fontFamily: petTypography.strong }}>{'\u2728'} 2x XP Active</Text>}
            {result.freeItem && <Text className="text-[14px] text-center text-pet-blue-dark mb-0.5" style={{ fontFamily: petTypography.strong }}>{'\u{1F381}'} Free Item Token</Text>}
            {result.shard && <Text className="text-[14px] text-center text-pet-blue-dark" style={{ fontFamily: petTypography.strong }}>{'\u{1F48E}'} Evolution Shard</Text>}
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} className="w-full">
            <LinearGradient colors={rarityConfig.bg} className="py-3.5 rounded-2xl items-center">
              <Text className="text-white text-[14px] uppercase tracking-[1px]" style={{ fontFamily: petTypography.strong }}>
                Awesome
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Pure RN wheel — no SVG required
function WheelView({ size }: { size: number }) {
  const radius = size / 2;

  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#3C8AB4' }}>
      {SPIN_SEGMENTS.map((seg, i) => {
        const rotation = i * SEGMENT_ANGLE;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              transform: [{ rotate: `${rotation}deg` }],
            }}
          >
            {/* Colored segment slice — a tall thin wedge from center to edge */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: radius - 1,
                width: 2,
                height: radius,
                backgroundColor: WHEEL_COLORS[i % WHEEL_COLORS.length],
                transformOrigin: 'bottom center',
                transform: [{ rotate: `${SEGMENT_ANGLE / 2}deg` }],
              }}
            />
            {/* Segment background — fill using a wide view */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: size,
                height: radius,
                backgroundColor: WHEEL_COLORS[i % WHEEL_COLORS.length],
                opacity: 0.92,
                clipPath: 'none',
                // We approximate the pie slice with a positioned label area
              }}
              pointerEvents="none"
            />
            {/* Label */}
            <View
              style={{
                position: 'absolute',
                top: radius * 0.18,
                left: 0,
                width: size,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 11,
                  fontFamily: petTypography.strong,
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.3)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
                numberOfLines={1}
              >
                {seg.emoji} {seg.label}
              </Text>
            </View>
          </View>
        );
      })}
      {/* Center circle */}
      <View
        style={{
          position: 'absolute',
          top: radius - 28,
          left: radius - 28,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#fff',
          borderWidth: 3,
          borderColor: '#E6F4FD',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>{'\u{1F3B0}'}</Text>
      </View>
    </View>
  );
}

export function SpinWheel() {
  const { canSpinToday, doSpin, lastSpinDate, extraSpinsToday } = useAdventureStore();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isFreeSpin = lastSpinDate !== today;
  const canSpin = canSpinToday() && !spinning;

  const wheelSize = Math.min(280, Math.max(240, Dimensions.get('window').width * 0.65));

  const handleSpin = useCallback(() => {
    if (!canSpin) return;

    const spinResult = doSpin();
    if (!spinResult) return;

    setResult(spinResult);
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Calculate target rotation: land on the winning segment
    const idx = Math.max(0, SPIN_SEGMENTS.findIndex((s) => s.label === spinResult.label));
    // Target angle: we want the winning segment at the top (0°/360°)
    // Each segment center is at idx * SEGMENT_ANGLE
    // We spin multiple full rotations + offset to land on that segment
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const segmentOffset = idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetDeg = currentRotation.current + fullSpins * 360 + (360 - segmentOffset);

    spinAnim.setValue(currentRotation.current);
    Animated.timing(spinAnim, {
      toValue: targetDeg,
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      currentRotation.current = targetDeg % 360;
      setSpinning(false);
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  }, [canSpin, doSpin, spinAnim]);

  const rotateInterpolate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="px-6 mt-4">
      <View
        className="bg-white rounded-[30px] overflow-hidden border border-pet-blue-light/80"
        style={{ shadowColor: '#2A678C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 5 }}
      >
        <LinearGradient
          colors={['#4A9ECB', '#76BFDF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 py-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <Text className="text-[21px] mr-2">{'\u{1F3B0}'}</Text>
            <View>
              <Text className="text-white text-[14px]" style={{ fontFamily: petTypography.display }}>Lucky Wheel</Text>
              <Text className="text-white/75 text-[10px]" style={{ fontFamily: petTypography.body }}>Daily rewards and rare drops</Text>
            </View>
          </View>
          {isFreeSpin && (
            <View className="px-2.5 py-1 rounded-full bg-white/25 border border-white/40">
              <Text className="text-white text-[10px]" style={{ fontFamily: petTypography.strong }}>FREE</Text>
            </View>
          )}
        </LinearGradient>

        <View className="items-center py-5">
          {/* Pointer/knob at top */}
          <View style={{ zIndex: 10, marginBottom: -12 }}>
            <Text style={{ fontSize: 28 }}>{'\u{1F53D}'}</Text>
          </View>

          {/* Spinning wheel */}
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <WheelView size={wheelSize} />
          </Animated.View>

          <TouchableOpacity onPress={handleSpin} disabled={!canSpin} activeOpacity={0.85} className="w-full px-5 mt-5">
            <LinearGradient
              colors={canSpin ? ['#4A9ECB', '#3A88B2'] : ['#D1D5DB', '#9CA3AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="py-3.5 rounded-2xl items-center"
            >
              <Text className="text-white text-[14px] uppercase tracking-[1px]" style={{ fontFamily: petTypography.strong }}>
                {spinning ? 'Spinning...' : !canSpinToday() ? 'No Spins Left' : isFreeSpin ? 'Free Spin' : 'Spin (0.2 SOL)'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {!isFreeSpin && canSpinToday() && (
            <Text className="text-[10px] text-gray-400 mt-2.5" style={{ fontFamily: petTypography.body }}>
              {3 - extraSpinsToday} paid spin{3 - extraSpinsToday !== 1 ? 's' : ''} remaining
            </Text>
          )}
        </View>
      </View>

      <SpinResultModal result={result} visible={showResult} onClose={() => setShowResult(false)} />
    </View>
  );
}
