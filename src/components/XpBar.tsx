import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useXpStore, getTitleForLevel, getNextPerkLevel, LEVEL_PERKS } from '../store/xpStore';
import { usePremiumStore } from '../store/premiumStore';
import { TIER_CONFIGS } from '../data/premiumTiers';

export function XpBar() {
  const level = useXpStore((s) => s.level);
  const xpInCurrentLevel = useXpStore((s) => s.xpInCurrentLevel);
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

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: progress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  // Subtle pulse on the level badge
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const content = (
    <View className="flex-row items-center px-4 py-2">
      {/* Level Badge */}
      <Animated.View
        style={{ transform: [{ scale: pulseAnim }] }}
        className="w-12 h-12 rounded-full items-center justify-center mr-3 border-2 border-pet-gold"
      >
        <LinearGradient
          colors={tierConfig ? tierConfig.gradientColors : ['#9381FF', '#766BD1']}
          className="w-full h-full rounded-full items-center justify-center"
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

      {/* XP Bar + Info */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[11px] font-black text-pet-purple-dark uppercase tracking-[0.6px]">
            {title}
          </Text>
          <Text className="text-[10px] font-bold text-gray-400">
            {xpInCurrentLevel} / {xpNeeded} XP
          </Text>
        </View>

        {/* Bar Track */}
        <View className="h-[6px] bg-pet-purple-light/30 rounded-full overflow-hidden">
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
              colors={['#9381FF', '#B8AFF9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
        </View>

        {nextPerk && (
          <Text className="text-[9px] font-semibold text-gray-400 mt-1">
            Next perk: Lv.{nextPerk} — {LEVEL_PERKS[nextPerk].label}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View
      className="bg-white rounded-[20px] border border-gray-100"
      style={{
        shadowColor: '#22314A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {content}
    </View>
  );
}
