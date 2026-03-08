import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAdventureStore, SPIN_SEGMENTS, type SpinResult } from '../store/adventureStore';
import { useWalletStore } from '../store/walletStore';
import { petTypography } from '../theme/typography';
import { playSfx } from '../lib/soundManager';

const SPIN_DURATION_MS = 4500;
const SEGMENT_COUNT = SPIN_SEGMENTS.length;
const SEGMENT_ANGLE_DEG = 360 / SEGMENT_COUNT;

const WHEEL_SIZE = Math.min(300, Math.max(260, Dimensions.get('window').width * 0.72));
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2;

// Alternating app-blue tones
const SEGMENT_COLORS = [
  '#4FABC9', '#D9F0F7', '#3E8AB3', '#EAF6FB', '#67BCD6',
  '#4FABC9', '#D9F0F7', '#3E8AB3', '#EAF6FB', '#67BCD6',
];

const RARITY_CONFIGS = {
  epic: { bg: ['#4FABC9', '#3E8AB3'] as [string, string], label: 'EPIC', glow: '#4FABC9' },
  rare: { bg: ['#67BCD6', '#3E8AB3'] as [string, string], label: 'RARE', glow: '#67BCD6' },
  common: { bg: ['#86CFE2', '#4FABC9'] as [string, string], label: 'COMMON', glow: '#86CFE2' },
};

/* ── Result Modal ── */
function SpinResultModal({ result, visible, onClaim }: { result: SpinResult | null; visible: boolean; onClaim: () => void }) {
  if (!visible || !result) return null;
  const config = RARITY_CONFIGS[result.rarity] ?? RARITY_CONFIGS.common;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 32,
            width: '100%',
            alignItems: 'center',
            paddingHorizontal: 28,
            paddingVertical: 36,
            borderWidth: 1,
            borderColor: '#f3f4f6',
            shadowColor: config.glow,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.2,
            shadowRadius: 30,
            elevation: 16,
          }}
        >
          <View
            style={{
              backgroundColor: config.glow + '15',
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

          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: config.glow + '12',
              borderWidth: 2,
              borderColor: config.glow + '25',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 48 }}>{result.emoji}</Text>
          </View>

          <Text style={{ fontSize: 22, color: '#1f2937', marginBottom: 6, textAlign: 'center', fontFamily: petTypography.display }}>
            {result.label}
          </Text>

          <View
            style={{
              width: '100%',
              backgroundColor: '#f9fafb',
              borderRadius: 18,
              paddingHorizontal: 20,
              paddingVertical: 14,
              marginTop: 10,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#f3f4f6',
            }}
          >
            {result.xp > 0 && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#3E8AB3', marginBottom: 3, fontFamily: petTypography.strong }}>
                +{result.xp} XP
              </Text>
            )}
            {result.staminaRefill && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#3E8AB3', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u26A1'} Stamina Refilled
              </Text>
            )}
            {result.doubleXpMinutes > 0 && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#3E8AB3', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u2728'} 2x XP for {result.doubleXpMinutes}min
              </Text>
            )}
            {result.freeItem && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#3E8AB3', marginBottom: 3, fontFamily: petTypography.strong }}>
                {'\u{1F381}'} Free Item Token
              </Text>
            )}
            {result.shard && (
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#3E8AB3', fontFamily: petTypography.strong }}>
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

/* ── Insufficient Funds Modal ── */
function InsufficientFundsSpinModal({ visible, required, available, onClose }: { visible: boolean; required: number; available: number; onClose: () => void }) {
  if (!visible) return null;
  const shortage = Math.max(0, required - available);
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/50 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 28,
            width: '100%',
            paddingHorizontal: 24,
            paddingVertical: 28,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#f3f4f6',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 14,
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#f3f0ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 36 }}>{'\u{1F4B8}'}</Text>
          </View>

          <Text style={{ fontSize: 20, color: '#1f2937', marginBottom: 6, fontFamily: petTypography.display }}>
            Insufficient SOL
          </Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 18, fontFamily: petTypography.body }}>
            You need more SOL to spin the wheel.
          </Text>

          <View style={{ width: '100%', backgroundColor: '#f9fafb', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: petTypography.body }}>Spin Cost</Text>
              <Text style={{ fontSize: 12, color: '#374151', fontFamily: petTypography.strong }}>{required} SOL</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: petTypography.body }}>Your Balance</Text>
              <Text style={{ fontSize: 12, color: '#374151', fontFamily: petTypography.strong }}>{available.toFixed(4)} SOL</Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#EF4444', fontFamily: petTypography.strong }}>Shortage</Text>
              <Text style={{ fontSize: 12, color: '#EF4444', fontFamily: petTypography.strong }}>{shortage.toFixed(4)} SOL</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ width: '100%' }}>
            <LinearGradient colors={['#6b7280', '#4b5563']} style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13, fontFamily: petTypography.strong, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Got It
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/*
 * ── Wheel built with pure RN Views ──
 *
 * Each segment is a tall rectangle (width = sliceWidth, height = RADIUS)
 * anchored at the center and rotated to its position. The outer container
 * clips everything into a circle via borderRadius. This is the same
 * technique the app originally used — proven to work on Android/iOS.
 */
function WheelView() {
  const sliceWidth = 2 * RADIUS * Math.tan((SEGMENT_ANGLE_DEG * Math.PI) / 360);

  return (
    <View
      style={{
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        borderRadius: RADIUS,
        overflow: 'hidden',
        backgroundColor: '#F1F9FC',
      }}
    >
      {/* Outer ring */}
      <View
        style={{
          position: 'absolute',
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          borderRadius: RADIUS,
          borderWidth: 5,
          borderColor: '#4FABC9',
          zIndex: 20,
        }}
        pointerEvents="none"
      />

      {/* Segments */}
      {SPIN_SEGMENTS.map((seg, i) => {
        const rotation = i * SEGMENT_ANGLE_DEG;
        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        const isDark = !(color.startsWith('#D') || color.startsWith('#E') || color.startsWith('#F'));

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: WHEEL_SIZE,
              height: WHEEL_SIZE,
              transform: [{ rotate: `${rotation}deg` }],
            }}
          >
            {/* Colored slice */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: CENTER - sliceWidth / 2,
                width: sliceWidth,
                height: RADIUS,
                backgroundColor: color,
              }}
            />
            {/* Divider line */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: CENTER - 0.5,
                width: 1,
                height: RADIUS,
                backgroundColor: 'rgba(255,255,255,0.35)',
              }}
            />
            {/* Emoji + label */}
            <View
              style={{
                position: 'absolute',
                top: RADIUS * 0.1,
                left: 0,
                width: WHEEL_SIZE,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(79,171,201,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 2,
                }}
              >
                <Text style={{ fontSize: 15 }}>{seg.emoji}</Text>
              </View>
              <Text
                style={{
                  color: isDark ? '#fff' : '#2D6B90',
                  fontSize: 7,
                  fontWeight: '800',
                  textAlign: 'center',
                  letterSpacing: 0.2,
                  textShadowColor: isDark ? 'rgba(0,0,0,0.3)' : 'transparent',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: isDark ? 2 : 0,
                }}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Decorative dots around the rim */}
      {Array.from({ length: SEGMENT_COUNT * 2 }).map((_, i) => {
        const angle = (i * (360 / (SEGMENT_COUNT * 2)) * Math.PI) / 180;
        const dotR = RADIUS - 10;
        const x = CENTER + dotR * Math.sin(angle) - 2.5;
        const y = CENTER - dotR * Math.cos(angle) - 2.5;
        return (
          <View
            key={`dot-${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: i % 2 === 0 ? 'rgba(79,171,201,0.75)' : 'rgba(255,255,255,0.7)',
              zIndex: 15,
            }}
            pointerEvents="none"
          />
        );
      })}

      {/* Center hub */}
      <View
        style={{
          position: 'absolute',
          top: CENTER - 30,
          left: CENTER - 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 25,
          borderWidth: 3,
          borderColor: '#4FABC9',
          shadowColor: '#4FABC9',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Text style={{ fontSize: 22 }}>{'\u{1F3B0}'}</Text>
      </View>
    </View>
  );
}

/* ── Pointer ── */
function Pointer() {
  return (
    <View style={{ zIndex: 30, alignItems: 'center', marginBottom: -8 }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 15,
          borderRightWidth: 15,
          borderTopWidth: 26,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#4FABC9',
          shadowColor: '#4FABC9',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        }}
      />
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#A7D7E6',
          marginTop: -5,
        }}
      />
    </View>
  );
}

/* ── Main SpinWheel ── */
export function SpinWheel() {
  const { canSpinToday, doSpin, claimSpinReward, lastSpinDate, extraSpinsToday } = useAdventureStore();
  const balance = useWalletStore((s) => s.balance);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isFreeSpin = lastSpinDate !== today;
  const canSpin = canSpinToday() && !spinning;
  const paidSpinsRemaining = Math.max(0, 3 - extraSpinsToday);
  const PAID_SPIN_COST = 0.002;

  useEffect(() => {
    pulseLoop.current?.stop();
    if (!canSpin) {
      pulseAnim.setValue(1);
      return;
    }
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.035, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, [canSpin, pulseAnim]);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;

    if (!isFreeSpin && balance < PAID_SPIN_COST) {
      setShowFundsModal(true);
      return;
    }

    const spinResult = doSpin();
    if (!spinResult) return;

    setResult(spinResult);
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const idx = Math.max(0, SPIN_SEGMENTS.findIndex((s) => s.label === spinResult.label));
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const segmentOffset = idx * SEGMENT_ANGLE_DEG + SEGMENT_ANGLE_DEG / 2;
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
      playSfx('reward');
    });
  }, [canSpin, isFreeSpin, balance, doSpin, spinAnim]);

  const rotateInterpolate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const buttonLabel = spinning
    ? 'Spinning...'
    : !canSpinToday()
      ? 'No Spins Left'
      : isFreeSpin
        ? 'Free Spin!'
        : 'Spin (0.002 SOL)';

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
      <View
        className="bg-white rounded-[28px] overflow-hidden border border-gray-100"
        style={{
          shadowColor: '#2D6B90',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 4,
        }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#4FABC9', '#3E8AB3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>{'\u{1F3B0}'}</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.9, textTransform: 'uppercase' }}>Spin To Win</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
              {isFreeSpin ? '\u2728 FREE SPIN' : `${paidSpinsRemaining} LEFT`}
            </Text>
          </View>
        </LinearGradient>

        {/* Body */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, alignItems: 'center' }}>
          <Text style={{ color: '#6D8798', fontSize: 12, fontFamily: petTypography.body, textAlign: 'center', marginBottom: 14 }}>
            Spin the wheel for exclusive assured rewards
          </Text>

          {/* Pointer */}
          <Pointer />

          {/* Wheel */}
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <WheelView />
          </Animated.View>

          {/* Spin button */}
          <Animated.View style={{ width: '100%', paddingHorizontal: 8, marginTop: 20, transform: [{ scale: canSpin && !spinning ? pulseAnim : 1 }] }}>
            <TouchableOpacity onPress={handleSpin} disabled={!canSpin} activeOpacity={0.85}>
              <LinearGradient
                colors={canSpin
                  ? (spinning ? ['#3E8AB3', '#32779E'] : ['#4FABC9', '#3E8AB3'])
                  : ['#d1d5db', '#9ca3af']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 18,
                  alignItems: 'center',
                  shadowColor: canSpin ? '#3E8AB3' : '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: canSpin ? 0.3 : 0.05,
                  shadowRadius: 10,
                  elevation: canSpin ? 5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, letterSpacing: 1, fontFamily: petTypography.strong, textTransform: 'uppercase' }}>
                  {buttonLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Text style={{ fontSize: 10, color: '#7A95A6', marginTop: 12, fontFamily: petTypography.body, textAlign: 'center' }}>
            {isFreeSpin ? 'Your free spin is ready today.' : `${paidSpinsRemaining} paid spin${paidSpinsRemaining !== 1 ? 's' : ''} remaining today.`}
          </Text>
        </View>
      </View>

      <SpinResultModal result={result} visible={showResult} onClaim={() => {
        if (result) claimSpinReward(result);
        setShowResult(false);
        playSfx('happy');
      }} />

      <InsufficientFundsSpinModal
        visible={showFundsModal}
        required={PAID_SPIN_COST}
        available={balance}
        onClose={() => setShowFundsModal(false)}
      />
    </View>
  );
}
