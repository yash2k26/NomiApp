import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useXpStore, getTitleForLevel, LEVEL_REWARDS, LEVEL_PERKS, getNextPerkLevel } from '../store/xpStore';
import { playSfx } from '../lib/soundManager';

export function LevelUpModal() {
  const pendingLevelUp = useXpStore((s) => s.pendingLevelUp);
  const clearPendingLevelUp = useXpStore((s) => s.clearPendingLevelUp);

  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starRotate = useRef(new Animated.Value(0)).current;

  const visible = pendingLevelUp !== null;
  const level = pendingLevelUp ?? 1;
  const title = getTitleForLevel(level);
  const rewards = LEVEL_REWARDS[level];
  const perk = LEVEL_PERKS[level];
  const nextPerk = getNextPerkLevel(level);

  useEffect(() => {
    if (!visible) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx('levelup');

    scaleAnim.setValue(0.3);
    opacityAnim.setValue(0);
    starRotate.setValue(0);

    const anim = Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(starRotate, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, scaleAnim, opacityAnim, starRotate]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSfx('happy');
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => clearPendingLevelUp());
  };

  if (!visible) return null;

  const spin = starRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View
        style={{ opacity: opacityAnim }}
        className="flex-1 bg-black/50 items-center justify-center px-8"
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            shadowColor: '#9381FF',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 20,
          }}
          className="bg-white rounded-[36px] items-center px-8 py-10 w-full"
        >
          {/* Spinning star background */}
          <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute', top: -20 }}>
            <Text className="text-[60px]">{'\u{2B50}'}</Text>
          </Animated.View>

          {/* Level badge */}
          <View className="mt-8 mb-4">
            <LinearGradient
              colors={['#FFD700', '#CCA800']}
              className="items-center justify-center"
              style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: '#FFD700' }}
            >
              <Text className="text-white text-[36px] font-black">{level}</Text>
            </LinearGradient>
          </View>

          <Text className="text-[28px] font-black text-gray-800 mb-1">
            Level Up!
          </Text>

          <Text className="text-[16px] font-bold text-pet-purple mb-2">
            {title}
          </Text>

          {rewards && rewards.length > 0 && (
            <View className="bg-pet-gold-light/50 px-5 py-2.5 rounded-2xl mb-3">
              {rewards.map((r, i) => (
                <Text key={i} className="text-[13px] font-bold text-pet-gold-dark text-center">
                  {r.type === 'title' ? `New Title: "${r.value}"` : `Unlocked: ${r.value}`}
                </Text>
              ))}
            </View>
          )}

          {perk && (
            <View className="bg-pet-purple-light/30 px-5 py-3 rounded-2xl mb-3 border border-pet-purple/20">
              <Text className="text-[11px] font-black text-pet-purple-dark text-center uppercase tracking-[0.5px] mb-1">
                New Perk Unlocked
              </Text>
              <Text className="text-[15px] font-black text-pet-purple text-center">
                {perk.label}
              </Text>
            </View>
          )}

          {nextPerk && (
            <Text className="text-[11px] font-semibold text-gray-400 text-center mb-2">
              Next perk at Level {nextPerk}: {LEVEL_PERKS[nextPerk].label}
            </Text>
          )}

          <TouchableOpacity onPress={handleDismiss} activeOpacity={0.85} className="w-full mt-2">
            <LinearGradient
              colors={['#9381FF', '#766BD1']}
              className="py-3.5 rounded-[18px] items-center"
            >
              <Text className="text-white text-[14px] font-black uppercase tracking-[1px]">
                Awesome!
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
