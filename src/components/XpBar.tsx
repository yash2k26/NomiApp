import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useXpStore, getTitleForLevel, getNextPerkLevel, LEVEL_PERKS } from '../store/xpStore';
import { usePremiumStore } from '../store/premiumStore';
import { TIER_CONFIGS } from '../data/premiumTiers';

export function XpBar() {
  const level = useXpStore((s) => s.level);
  const xpInCurrentLevel = useXpStore((s) => s.xpInCurrentLevel);
  const totalXp = useXpStore((s) => s.totalXp);
  const getXpToNextLevel = useXpStore((s) => s.getXpToNextLevel);
  const getLevelProgress = useXpStore((s) => s.getLevelProgress);

  const premiumTier = usePremiumStore((s) => s.tier);

  const xpNeeded = getXpToNextLevel();
  const progress = getLevelProgress();
  const title = getTitleForLevel(level);
  const nextPerk = getNextPerkLevel(level);
  const tierConfig = premiumTier !== 'none' ? TIER_CONFIGS[premiumTier] : null;

  const widthAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Bar-fill highlight when XP comes in. Was previously a quiet spring you
  // could blink and miss — now we briefly brighten the fill so every XP
  // gain (care, quests, achievements, mini-games, login, streak, wellness)
  // has at least a flicker of acknowledgement on the bar itself.
  const fillFlashAnim = useRef(new Animated.Value(0)).current;

  // ── Floating "+X XP" indicator ──
  // Surfaces on the bar for EVERY XP gain, not just care actions. Care
  // actions already had a separate float on the action buttons; XP from
  // quests/achievements/mini-games/login/streak/wellness was previously
  // invisible — users earned XP and saw nothing change in the moment.
  const prevTotalXpRef = useRef(totalXp);
  const [floatDelta, setFloatDelta] = useState<{ amount: number; key: number } | null>(null);
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prev = prevTotalXpRef.current;
    prevTotalXpRef.current = totalXp;
    if (totalXp <= prev) return; // hydration / disconnect resets / no change
    const delta = totalXp - prev;
    if (delta <= 0) return;
    setFloatDelta({ amount: delta, key: Date.now() });

    // Quick attention pulse on the bar fill itself.
    fillFlashAnim.setValue(1);
    Animated.timing(fillFlashAnim, {
      toValue: 0,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [totalXp, fillFlashAnim]);

  useEffect(() => {
    if (!floatDelta) return;
    floatOpacity.setValue(1);
    floatTranslate.setValue(0);
    Animated.parallel([
      Animated.timing(floatTranslate, { toValue: -28, duration: 900, useNativeDriver: true }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start(() => setFloatDelta(null));
  }, [floatDelta, floatOpacity, floatTranslate]);

  // Track level so we can play a different animation on level-up. Without
  // this, leveling visually looks like "bar suddenly drops to almost
  // empty" — feels like XP got eaten. Now we fill to 100% first, hold,
  // then drop to the leftover, which reads as a clear "completed the
  // level, starting fresh."
  const prevLevelRef = useRef(level);
  useEffect(() => {
    const prevLevel = prevLevelRef.current;
    prevLevelRef.current = level;

    if (level > prevLevel) {
      Animated.sequence([
        Animated.timing(widthAnim, { toValue: 1, duration: 320, useNativeDriver: false }),
        Animated.timing(widthAnim, { toValue: progress, duration: 520, useNativeDriver: false }),
      ]).start();
      return;
    }

    // Tighter spring than before (was friction:9/tension:42 — too sluggish
    // for small XP gains). 6/55 lands the fill in ~250ms which actually
    // reads as "the bar moved" instead of a near-static crawl.
    Animated.spring(widthAnim, {
      toValue: progress,
      friction: 6,
      tension: 55,
      useNativeDriver: false,
    }).start();
  }, [progress, level, widthAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View
      className="bg-white rounded-[22px] border border-pet-blue-light/75"
      style={{
        shadowColor: '#2E6E93',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View className="flex-row items-center px-4 py-2.5">
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }], width: 48, height: 48, borderRadius: 999 }}
          className="items-center justify-center mr-3 border-2 border-pet-blue-light"
        >
          <LinearGradient
            colors={tierConfig ? tierConfig.gradientColors : ['#4A9ECB', '#3A84AF']}
            className="w-full h-full items-center justify-center"
            style={{ borderRadius: 999 }}
          >
            <Text className="text-white text-[16px] font-black">{level}</Text>
          </LinearGradient>
          {tierConfig && (
            <View
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full items-center justify-center border-2 border-white"
              style={{ backgroundColor: tierConfig.badgeColor }}
            >
              <Text className="text-[8px]">{tierConfig.emoji}</Text>
            </View>
          )}
        </Animated.View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-[11px] font-black text-pet-blue-dark uppercase tracking-[0.6px]">
              {title}
            </Text>
            <View className="px-2.5 py-1 rounded-full bg-pet-blue-light/45 border border-pet-blue-light/90">
              <Text className="text-[10px] font-black text-pet-blue-dark">
                {xpInCurrentLevel} / {xpNeeded} XP
              </Text>
            </View>
          </View>

          <View className="h-[6px] bg-pet-blue-light/45 rounded-full overflow-hidden relative">
            <Animated.View
              style={{
                width: widthAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                height: '100%',
                borderRadius: 999,
              }}
            >
              <LinearGradient
                colors={['#4A9ECB', '#78C1E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: 999 }}
              />
              {/* Brief brightness pulse layered on top of the fill — fades
                  out over 700ms after each XP gain to draw the eye. */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF',
                  opacity: fillFlashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                }}
              />
            </Animated.View>
          </View>

          {/* Floating "+N XP" indicator — fires on every totalXp increase. */}
          {floatDelta && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 4,
                top: -4,
                opacity: floatOpacity,
                transform: [{ translateY: floatTranslate }],
              }}
            >
              <View className="bg-pet-blue-dark rounded-full px-2 py-0.5">
                <Text className="text-white text-[10px] font-black">+{floatDelta.amount} XP</Text>
              </View>
            </Animated.View>
          )}

          {nextPerk && (
            <View className="self-start mt-1 px-2 py-0.5 rounded-full bg-white border border-pet-blue-light/70">
              <Text className="text-[9px] font-semibold text-pet-blue-dark">
                Next perk: Lv.{nextPerk} - {LEVEL_PERKS[nextPerk].label}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
