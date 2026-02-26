import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useXpStore, getTitleForLevel } from '../store/xpStore';

export function XpBar() {
  const level = useXpStore((s) => s.level);
  const xpInCurrentLevel = useXpStore((s) => s.xpInCurrentLevel);
  const getXpToNextLevel = useXpStore((s) => s.getXpToNextLevel);
  const getLevelProgress = useXpStore((s) => s.getLevelProgress);

  const xpNeeded = getXpToNextLevel();
  const progress = getLevelProgress();
  const title = getTitleForLevel(level);

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

  return (
    <View className="flex-row items-center px-4 py-2">
      {/* Level Badge */}
      <Animated.View
        style={{ transform: [{ scale: pulseAnim }] }}
        className="w-12 h-12 rounded-full items-center justify-center mr-3 border-2 border-pet-gold"
      >
        <LinearGradient
          colors={['#9381FF', '#766BD1']}
          className="w-full h-full rounded-full items-center justify-center"
        >
          <Text className="text-white text-[16px] font-black">{level}</Text>
        </LinearGradient>
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
      </View>
    </View>
  );
}
