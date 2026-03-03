import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, SPIN_SEGMENTS, type SpinResult } from '../store/adventureStore';
import { petTypography } from '../theme/typography';

const SPIN_DURATION_MS = 4500;
const SEGMENT_COUNT = SPIN_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

// Alternating rich colors for segments
const SEGMENT_COLORS_A = '#3A8BB8';
const SEGMENT_COLORS_B = '#4DA6D4';

// Rarity glow colors for result modal
const RARITY_CONFIGS = {
  epic: { bg: ['#2B6B8F', '#1A5577'] as [string, string], label: 'EPIC', glow: '#2B6B8F' },
  rare: { bg: ['#4A9ECB', '#367EA8'] as [string, string], label: 'RARE', glow: '#4A9ECB' },
  common: { bg: ['#6BB8D9', '#4FA3C7'] as [string, string], label: 'COMMON', glow: '#6BB8D9' },
};

function SpinResultModal({ result, visible, onClaim }: { result: SpinResult | null; visible: boolean; onClaim: () => void }) {
  if (!visible || !result) return null;
  const config = RARITY_CONFIGS[result.rarity] ?? RARITY_CONFIGS.common;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/60 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 32,
            width: '100%',
            alignItems: 'center',
            paddingHorizontal: 28,
            paddingVertical: 36,
            shadowColor: config.glow,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.35,
            shadowRadius: 30,
            elevation: 16,
          }}
        >
          {/* Rarity badge */}
          <View
            style={{
              backgroundColor: config.glow + '18',
              borderColor: config.glow + '40',
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 4,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 10, letterSpacing: 1.5, color: config.glow, fontFamily: petTypography.strong, textTransform: 'uppercase' }}>
              {config.label}
            </Text>
          </View>

          {/* Emoji with glow circle */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: config.glow + '10',
              borderWidth: 2,
              borderColor: config.glow + '25',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 48 }}>{result.emoji}</Text>
          </View>

          <Text style={{ fontSize: 22, color: '#1F3A4D', marginBottom: 6, textAlign: 'center', fontFamily: petTypography.display }}>
            {result.label}
          </Text>

          {/* Rewards list */}
          <View
            style={{
              width: '100%',
              backgroundColor: '#F0F8FF',
              borderRadius: 18,
              paddingHorizontal: 20,
              paddingVertical: 14,
              marginTop: 10,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#D6ECFA',
            }}
          >
            {result.xp > 0 && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#2B6B8F', marginBottom: 3, fontFamily: petTypography.strong }}>
                +{result.xp} XP
              </Text>
            )}
            {result.staminaRefill && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#2B6B8F', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u26A1'} Stamina Refilled
              </Text>
            )}
            {result.doubleXpMinutes > 0 && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#2B6B8F', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u2728'} 2x XP for {result.doubleXpMinutes}min
              </Text>
            )}
            {result.freeItem && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#2B6B8F', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u{1F381}'} Free Item Token
              </Text>
            )}
            {result.shard && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#2B6B8F', fontFamily: petTypography.strong }}>
                {'\u{1F48E}'} Evolution Shard
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={onClaim} activeOpacity={0.85} style={{ width: '100%' }}>
            <LinearGradient colors={config.bg} style={{ paddingVertical: 14, borderRadius: 18, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, letterSpacing: 1, fontFamily: petTypography.strong, textTransform: 'uppercase' }}>
                Claim Reward
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Wheel built from stacked half-circle slices ──
function WheelView({ size }: { size: number }) {
  const radius = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: SEGMENT_COLORS_A,
      }}
    >
      {/* Outer decorative ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 6,
          borderColor: '#2B6B8F',
          zIndex: 20,
        }}
        pointerEvents="none"
      />
      {/* Inner ring */}
      <View
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          width: size - 12,
          height: size - 12,
          borderRadius: (size - 12) / 2,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.25)',
          zIndex: 21,
        }}
        pointerEvents="none"
      />

      {/* Segment slices — each is a rotated half-plane clipped by the circle overflow */}
      {SPIN_SEGMENTS.map((seg, i) => {
        const rotation = i * SEGMENT_ANGLE;
        const color = i % 2 === 0 ? SEGMENT_COLORS_A : SEGMENT_COLORS_B;

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
            {/* Segment fill — triangle approximated as a tall narrow trapezoid from center */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: radius - radius * Math.tan((SEGMENT_ANGLE * Math.PI) / 360),
                width: radius * Math.tan((SEGMENT_ANGLE * Math.PI) / 360) * 2,
                height: radius,
                backgroundColor: color,
              }}
            />
            {/* Divider line */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: radius - 0.5,
                width: 1,
                height: radius,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            />
            {/* Emoji + label positioned along the segment radius */}
            <View
              style={{
                position: 'absolute',
                top: radius * 0.12,
                left: 0,
                width: size,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 18, marginBottom: 1 }}>{seg.emoji}</Text>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 9,
                  fontFamily: petTypography.strong,
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.4)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                  letterSpacing: 0.3,
                }}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Tick dots around edge */}
      {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
        const angle = (i * SEGMENT_ANGLE * Math.PI) / 180;
        const dotRadius = radius - 14;
        const x = radius + dotRadius * Math.sin(angle) - 3;
        const y = radius - dotRadius * Math.cos(angle) - 3;
        return (
          <View
            key={`dot-${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i % 2 === 0 ? '#FFD700' : '#fff',
              opacity: 0.85,
              zIndex: 15,
            }}
            pointerEvents="none"
          />
        );
      })}

      {/* Center hub — layered circles for depth */}
      <View
        style={{
          position: 'absolute',
          top: radius - 34,
          left: radius - 34,
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: '#2B6B8F',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 25,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#E6F4FD',
          }}
        >
          <Text style={{ fontSize: 22 }}>{'\u{1F3B0}'}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Pointer triangle ──
function Pointer() {
  return (
    <View style={{ zIndex: 30, alignItems: 'center', marginBottom: -16 }}>
      {/* Triangle pointer using borders */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 14,
          borderRightWidth: 14,
          borderTopWidth: 24,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#2B6B8F',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 6,
        }}
      />
      {/* Small circle at base of pointer */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#2B6B8F',
          marginTop: -4,
        }}
      />
    </View>
  );
}

export function SpinWheel() {
  const { canSpinToday, doSpin, claimSpinReward, lastSpinDate, extraSpinsToday } = useAdventureStore();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().slice(0, 10);
  const isFreeSpin = lastSpinDate !== today;
  const canSpin = canSpinToday() && !spinning;

  const wheelSize = Math.min(290, Math.max(250, Dimensions.get('window').width * 0.68));

  // Gentle pulse on the spin button when available
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Start pulse on mount if can spin
  useState(() => { if (canSpin) startPulse(); });

  const handleSpin = useCallback(() => {
    if (!canSpin) return;

    const spinResult = doSpin();
    if (!spinResult) return;

    setResult(spinResult);
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const idx = Math.max(0, SPIN_SEGMENTS.findIndex((s) => s.label === spinResult.label));
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const segmentOffset = idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetDeg = currentRotation.current + fullSpins * 360 + (360 - segmentOffset);

    spinAnim.setValue(currentRotation.current);
    Animated.timing(spinAnim, {
      toValue: targetDeg,
      duration: SPIN_DURATION_MS,
      easing: Easing.bezier(0.2, 0.8, 0.3, 1),
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

  const buttonLabel = spinning
    ? 'Spinning...'
    : !canSpinToday()
      ? 'No Spins Left'
      : isFreeSpin
        ? 'Free Spin!'
        : 'Spin (0.2 SOL)';

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 30,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#D6ECFA',
          shadowColor: '#1A4A68',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#2B6B8F', '#3D94BF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>{'\u{1F3B0}'}</Text>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: petTypography.display }}>Lucky Wheel</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: petTypography.body, marginTop: 1 }}>
                Spin daily for rewards & rare drops
              </Text>
            </View>
          </View>
          {isFreeSpin && (
            <View
              style={{
                backgroundColor: '#FFD700',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#1A4A68', fontSize: 10, fontFamily: petTypography.strong, letterSpacing: 0.8 }}>FREE</Text>
            </View>
          )}
        </LinearGradient>

        {/* Wheel area */}
        <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 24, backgroundColor: '#F4FAFF' }}>
          <Pointer />

          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <WheelView size={wheelSize} />
          </Animated.View>

          {/* Spin button */}
          <Animated.View style={{ width: '100%', paddingHorizontal: 20, marginTop: 20, transform: [{ scale: canSpin && !spinning ? pulseAnim : 1 }] }}>
            <TouchableOpacity onPress={handleSpin} disabled={!canSpin} activeOpacity={0.85}>
              <LinearGradient
                colors={canSpin ? ['#2B6B8F', '#1A5577'] : ['#C5CDD5', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 15, borderRadius: 18, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 15, letterSpacing: 1.2, fontFamily: petTypography.strong, textTransform: 'uppercase' }}>
                  {buttonLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Spins remaining */}
          {!isFreeSpin && canSpinToday() && (
            <Text style={{ fontSize: 10, color: '#8BA4B6', marginTop: 10, fontFamily: petTypography.body }}>
              {3 - extraSpinsToday} paid spin{3 - extraSpinsToday !== 1 ? 's' : ''} remaining
            </Text>
          )}
        </View>
      </View>

      <SpinResultModal result={result} visible={showResult} onClaim={() => {
        if (result) claimSpinReward(result);
        setShowResult(false);
      }} />
    </View>
  );
}
