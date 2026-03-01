import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventStore, type EventReward } from '../store/eventStore';

const RARITY_COLORS: Record<string, readonly [string, string]> = {
  common: ['#4FB0C6', '#67BEE4'] as const,
  uncommon: ['#9381FF', '#B8A9FF'] as const,
  rare: ['#FFD700', '#FFC107'] as const,
};

function RewardPopup({ reward, onDone }: { reward: EventReward; onDone: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2500);
    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, onDone]);

  const rewards: string[] = [];
  if (reward.xp > 0) rewards.push(`+${reward.xp} XP`);
  if (reward.coins > 0) rewards.push(`+${reward.coins} SOL`);
  if (reward.staminaRefill > 0) rewards.push(`+${reward.staminaRefill} Stamina`);
  if (reward.happiness > 0) rewards.push(`+${reward.happiness} Happiness`);
  if (reward.hunger > 0) rewards.push(`+${reward.hunger} Hunger`);
  if (reward.energy > 0) rewards.push(`+${reward.energy} Energy`);
  if (reward.shards > 0) rewards.push(`+${reward.shards} Shard!`);

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
      className="absolute inset-0 items-center justify-center z-50"
      pointerEvents="none"
    >
      <View className="bg-white rounded-3xl px-8 py-6 border border-pet-blue-light/50 items-center"
        style={{ shadowColor: '#4FB0C6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 }}
      >
        <Text className="text-3xl mb-2">{'\u2728'}</Text>
        <Text className="text-[14px] font-black text-gray-800 mb-2">Rewards!</Text>
        {rewards.map((r, i) => (
          <Text key={i} className="text-[13px] font-bold text-pet-blue-dark">{r}</Text>
        ))}
      </View>
    </Animated.View>
  );
}

export function EventOverlay() {
  const { activeEvent, resolveEvent, dismissEvent } = useEventStore();
  const [showReward, setShowReward] = useState<EventReward | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [waitProgress, setWaitProgress] = useState(0);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const event = activeEvent?.event;
  const isActive = activeEvent && !activeEvent.resolved;

  // Slide in animation
  useEffect(() => {
    if (isActive) {
      slideAnim.setValue(-200);
      fadeAnim.setValue(0);
      setTapCount(0);
      setWaitProgress(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isActive, slideAnim, fadeAnim]);

  // Auto-expire event
  useEffect(() => {
    if (!activeEvent || activeEvent.resolved || !event) return;
    const remaining = event.durationMs - (Date.now() - activeEvent.startedAt);
    if (remaining <= 0) {
      dismissEvent();
      return;
    }
    const timer = setTimeout(() => dismissEvent(), remaining);
    return () => clearTimeout(timer);
  }, [activeEvent, event, dismissEvent]);

  // Wait interaction timer
  useEffect(() => {
    if (!isActive || event?.interaction !== 'wait') return;
    setWaitProgress(0);
    const interval = setInterval(() => {
      setWaitProgress(p => {
        const next = p + 1;
        if (next >= 10) {
          clearInterval(interval);
          handleResolve();
          return 10;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, event?.interaction]);

  const handleResolve = useCallback(() => {
    const reward = resolveEvent();
    if (reward) {
      setShowReward(reward);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [resolveEvent]);

  const handleTap = useCallback(() => {
    if (!isActive || !event) return;

    if (event.interaction === 'tap' || event.interaction === 'swipe') {
      handleResolve();
    } else if (event.interaction === 'multi_tap') {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (newCount >= 5) {
        handleResolve();
      }
    }
  }, [isActive, event, tapCount, handleResolve]);

  const handleRewardDone = useCallback(() => {
    setShowReward(null);
    dismissEvent();
  }, [dismissEvent]);

  if (!isActive && !showReward) return null;

  if (showReward) {
    return <RewardPopup reward={showReward} onDone={handleRewardDone} />;
  }

  if (!event) return null;

  const colors = RARITY_COLORS[event.rarity] ?? RARITY_COLORS.common;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: fadeAnim,
      }}
      className="absolute top-16 left-4 right-4 z-40"
    >
      <TouchableOpacity onPress={handleTap} activeOpacity={0.9}>
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="rounded-3xl overflow-hidden border border-white/30"
          style={{ shadowColor: colors[0], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
        >
          <View className="px-5 py-4">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center mr-3 border border-white/30">
                <Text className="text-2xl">{event.emoji}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-[14px] font-black text-white flex-1" numberOfLines={1}>{event.title}</Text>
                  {event.rarity === 'rare' && (
                    <View className="bg-white/30 px-2 py-0.5 rounded-full ml-2">
                      <Text className="text-[8px] font-black text-white">RARE</Text>
                    </View>
                  )}
                </View>
                <Text className="text-[11px] text-white/80 font-semibold mt-0.5">{event.description}</Text>
              </View>
            </View>

            {/* Interaction hint */}
            <View className="mt-3 bg-white/15 rounded-xl px-4 py-2.5 items-center">
              {event.interaction === 'wait' ? (
                <View className="w-full">
                  <Text className="text-[11px] font-bold text-white/90 text-center mb-1.5">
                    {waitProgress >= 10 ? 'Done!' : `${event.interactionHint} (${10 - waitProgress}s)`}
                  </Text>
                  <View className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <View className="h-full rounded-full bg-white/70" style={{ width: `${(waitProgress / 10) * 100}%` }} />
                  </View>
                </View>
              ) : event.interaction === 'multi_tap' ? (
                <View className="w-full">
                  <Text className="text-[11px] font-bold text-white/90 text-center mb-1.5">
                    {event.interactionHint} ({tapCount}/5)
                  </Text>
                  <View className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <View className="h-full rounded-full bg-white/70" style={{ width: `${(tapCount / 5) * 100}%` }} />
                  </View>
                </View>
              ) : (
                <Text className="text-[12px] font-black text-white tracking-[0.5px]">
                  {event.interactionHint}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
