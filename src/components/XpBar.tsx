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
      friction: 9,
      tension: 42,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

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
          style={{ transform: [{ scale: pulseAnim }] }}
          className="w-12 h-12 rounded-full items-center justify-center mr-3 border-2 border-pet-blue-light"
        >
          <LinearGradient
            colors={tierConfig ? tierConfig.gradientColors : ['#4A9ECB', '#3A84AF']}
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

          <View className="h-[6px] bg-pet-blue-light/45 rounded-full overflow-hidden">
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
            </Animated.View>
          </View>

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
