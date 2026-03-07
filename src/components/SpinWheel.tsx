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
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SEGMENT_COLORS = ['#1E6B92', '#2A7EA8', '#3592BD', '#41A3CC', '#4BB3D8', '#2F8AB1'];

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

function WheelView({ size }: { size: number }) {
  const radius = size / 2;
  const sliceWidth = radius * Math.tan((SEGMENT_ANGLE * Math.PI) / 360) * 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: SEGMENT_COLORS[0],
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 8,
          borderColor: '#0F4868',
          zIndex: 20,
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: size - 20,
          height: size - 20,
          borderRadius: (size - 20) / 2,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.35)',
          zIndex: 21,
        }}
        pointerEvents="none"
      />

      {SPIN_SEGMENTS.map((seg, i) => {
        const rotation = i * SEGMENT_ANGLE;
        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

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
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: radius - sliceWidth / 2,
                width: sliceWidth,
                height: radius,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: radius - 0.5,
                width: 1,
                height: radius,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: radius * 0.16,
                left: 0,
                width: size,
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 16, marginBottom: 2 }}>{seg.emoji}</Text>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 8,
                  fontFamily: petTypography.strong,
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.45)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
            </View>
          </View>
        );
      })}

      {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
        const angle = (i * SEGMENT_ANGLE * Math.PI) / 180;
        const dotRadius = radius - 14;
        const x = radius + dotRadius * Math.sin(angle) - 2.5;
        const y = radius - dotRadius * Math.cos(angle) - 2.5;
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
              backgroundColor: 'rgba(255,255,255,0.85)',
              zIndex: 15,
            }}
            pointerEvents="none"
          />
        );
      })}

      <View
        style={{
          position: 'absolute',
          top: radius - 36,
          left: radius - 36,
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: '#0F4868',
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
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#CCE6F5',
          }}
        >
          <Text style={{ fontSize: 24 }}>{'\u{1F3B0}'}</Text>
        </View>
      </View>
    </View>
  );
}

function Pointer() {
  return (
    <View style={{ zIndex: 30, alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 13,
          borderRightWidth: 13,
          borderTopWidth: 22,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#0F4868',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 6,
        }}
      />
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: '#0F4868',
          marginTop: -3,
        }}
      />
    </View>
  );
}

function InsufficientFundsSpinModal({ visible, required, available, onClose }: { visible: boolean; required: number; available: number; onClose: () => void }) {
  if (!visible) return null;
  const shortage = Math.max(0, required - available);
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/60 items-center justify-center px-7">
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 28,
            width: '100%',
            paddingHorizontal: 24,
            paddingVertical: 28,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 14,
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 36 }}>{'\u{1F4B8}'}</Text>
          </View>

          <Text style={{ fontSize: 20, color: '#1F3A4D', marginBottom: 6, fontFamily: petTypography.display }}>
            Insufficient SOL
          </Text>
          <Text style={{ fontSize: 13, color: '#7892A2', textAlign: 'center', marginBottom: 18, fontFamily: petTypography.body }}>
            You need more SOL to spin the wheel.
          </Text>

          <View style={{ width: '100%', backgroundColor: '#FEF2F2', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: petTypography.body }}>Spin Cost</Text>
              <Text style={{ fontSize: 12, color: '#374151', fontFamily: petTypography.strong }}>{required} SOL</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: petTypography.body }}>Your Balance</Text>
              <Text style={{ fontSize: 12, color: '#374151', fontFamily: petTypography.strong }}>{available.toFixed(4)} SOL</Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#FECACA', marginVertical: 4 }} />
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
  const PAID_SPIN_COST = 0.2;

  const wheelSize = Math.min(292, Math.max(248, Dimensions.get('window').width * 0.67));

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

    // Check balance for paid spins before attempting
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
        : 'Spin (0.2 SOL)';

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: '#D8E8F3',
          shadowColor: '#10344A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 5,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={{ color: '#194760', fontSize: 18, fontFamily: petTypography.display }}>Lucky Wheel</Text>
            <Text style={{ color: '#6D8494', fontSize: 11, fontFamily: petTypography.body, marginTop: 1 }}>
              Spin daily for rewards and rare drops
            </Text>
          </View>
          <View style={{ backgroundColor: isFreeSpin ? '#FFEEC1' : '#E8F2F8', borderWidth: 1, borderColor: isFreeSpin ? '#EBCB75' : '#D2E3EE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 }}>
            <Text style={{ color: isFreeSpin ? '#8B6500' : '#2D5D79', fontSize: 10, fontFamily: petTypography.strong, letterSpacing: 0.8 }}>
              {isFreeSpin ? 'FREE SPIN' : `${paidSpinsRemaining} LEFT`}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: '#F3FAFF', borderRadius: 22, borderWidth: 1, borderColor: '#DDECF6', paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ backgroundColor: '#E5F2FB', borderWidth: 1, borderColor: '#D1E7F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginRight: 6 }}>
              <Text style={{ color: '#2A6686', fontSize: 10, fontFamily: petTypography.strong }}>
                {'\u{1F3B0}'} Daily chance
              </Text>
            </View>
            <View style={{ backgroundColor: '#EAF4FB', borderWidth: 1, borderColor: '#D5E7F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ color: '#547286', fontSize: 10, fontFamily: petTypography.body }}>{'\u{1F48E}'} Rare drops</Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', justifyContent: 'center', width: wheelSize + 24, height: wheelSize + 52 }}>
            <Pointer />
            <View
              style={{
                marginTop: 10,
                width: wheelSize + 20,
                height: wheelSize + 20,
                borderRadius: (wheelSize + 20) / 2,
                backgroundColor: '#E7F3FB',
                borderWidth: 1,
                borderColor: '#CFE5F3',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <WheelView size={wheelSize} />
              </Animated.View>
            </View>
          </View>

          <Animated.View style={{ width: '100%', paddingHorizontal: 16, marginTop: 14, transform: [{ scale: canSpin && !spinning ? pulseAnim : 1 }] }}>
            <TouchableOpacity onPress={handleSpin} disabled={!canSpin} activeOpacity={0.85}>
              <LinearGradient
                colors={canSpin ? ['#1B6389', '#2F8BB7'] : ['#C5CDD5', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 14,
                  borderRadius: 18,
                  alignItems: 'center',
                  borderWidth: canSpin ? 1 : 0,
                  borderColor: canSpin ? '#90C9E4' : 'transparent',
                  shadowColor: canSpin ? '#1A5A7A' : '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: canSpin ? 0.22 : 0.08,
                  shadowRadius: 10,
                  elevation: canSpin ? 5 : 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, letterSpacing: 1.2, fontFamily: petTypography.strong, textTransform: 'uppercase' }}>
                  {buttonLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Text style={{ fontSize: 10, color: '#7892A2', marginTop: 10, fontFamily: petTypography.body }}>
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
